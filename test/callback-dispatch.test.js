// Regression tests for webhook callback dispatch (src/index.js).
//
// Production incident: admin:* callbacks reached the Worker but were only
// ever passed to handlePanelCallback (group_panel:* router), which ignores
// them — so no answerCallbackQuery happened and the panel froze.

import assert from "node:assert/strict";
import test from "node:test";
import worker from "../src/index.js";
import { createFakeDb } from "./helpers/fake-db.js";

const ADMIN_ENV = () => ({
  ADMIN_TELEGRAM_ID: "111222333",
  TELEGRAM_BOT_TOKEN: "test-token",
  hawkbucks_db: createFakeDb({
    users: [{ telegram_id: "111222333", username: "admin", first_name: "Admin", reminder_enabled: 1, last_seen: "2026-08-29 10:00:00" }],
  }),
});

function fakeCtx() {
  const tasks = [];
  return { tasks, waitUntil(p) { tasks.push(p); } };
}

function installTelegramStub() {
  const calls = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : null;
    calls.push({ url: String(url), body });
    return { ok: true, json: async () => ({ ok: true, result: { message_id: 1 } }) };
  };
  return { calls, restore: () => { globalThis.fetch = original; } };
}

async function sendUpdate(env, update, ctx) {
  const request = new Request("https://worker.example/webhook", {
    method: "POST",
    body: JSON.stringify(update),
    headers: { "Content-Type": "application/json" },
  });
  return worker.fetch(request, env, ctx);
}

test("admin:usage callback is dispatched to the admin panel and acknowledged", async () => {
  const env = ADMIN_ENV();
  const { calls, restore } = installTelegramStub();
  try {
    const response = await sendUpdate(env, {
      callback_query: {
        id: "cb-1",
        from: { id: 111222333 },
        message: { chat: { id: 111222333, type: "private" }, message_id: 10 },
        data: "admin:usage",
      },
    }, fakeCtx());

    assert.equal(await response.text(), "OK");
    const answers = calls.filter((c) => c.url.includes("/answerCallbackQuery"));
    assert.equal(answers.length, 1, "callback must be acknowledged");
    const edits = calls.filter((c) => c.url.includes("/editMessageText"));
    assert.equal(edits.length, 1, "admin usage period submenu must be rendered");
  } finally {
    restore();
  }
});

test("admin:rem, admin:bc and admin:root:back are all dispatched", async () => {
  for (const data of ["admin:rem", "admin:bc", "admin:root:back"]) {
    const env = ADMIN_ENV();
    const { calls, restore } = installTelegramStub();
    try {
      const response = await sendUpdate(env, {
        callback_query: {
          id: `cb-${data}`,
          from: { id: 111222333 },
          message: { chat: { id: 111222333, type: "private" }, message_id: 10 },
          data,
        },
      }, fakeCtx());

      assert.equal(await response.text(), "OK");
      const answers = calls.filter((c) => c.url.includes("/answerCallbackQuery"));
      assert.equal(answers.length, 1, `${data} must be acknowledged`);
    } finally {
      restore();
    }
  }
});

test("non-admin forged admin callback is denied, not silently dropped", async () => {
  const env = ADMIN_ENV();
  const { calls, restore } = installTelegramStub();
  try {
    await sendUpdate(env, {
      callback_query: {
        id: "cb-attacker",
        from: { id: 999 },
        message: { chat: { id: 999, type: "private" }, message_id: 10 },
        data: "admin:usage",
      },
    }, fakeCtx());

    const answers = calls.filter((c) => c.url.includes("/answerCallbackQuery"));
    assert.ok(answers.some((c) => c.body?.text === "Access denied."));
    assert.equal(calls.filter((c) => c.url.includes("/editMessageText")).length, 0);
  } finally {
    restore();
  }
});

test("existing group_panel:* callbacks still reach their router", async () => {
  const env = ADMIN_ENV();
  const { calls, restore } = installTelegramStub();
  try {
    // Unknown/expired group panel session → the group router answers
    // PANEL_EXPIRED_MESSAGE. Proves group_panel data is still dispatched.
    await sendUpdate(env, {
      callback_query: {
        id: "cb-group",
        from: { id: 111222333 },
        message: { chat: { id: "-100group", type: "supergroup" }, message_id: 55 },
        data: "group_panel:toggle",
      },
    }, fakeCtx());

    const answers = calls.filter((c) => c.url.includes("/answerCallbackQuery"));
    assert.ok(answers.some((c) => c.body?.text?.includes("expired") || c.body?.text?.includes("Expired")),
      "group panel router must still handle group_panel:* callbacks");
  } finally {
    restore();
  }
});

// ---------- Webhook-path broadcast execution (production regression) ----------
// Production hit BROADCAST_MISSING_EXECUTION_CONTEXT { recipients: 1 } because
// the deployed bundle predated the ctx threading. This test drives the REAL
// worker.fetch() webhook path end-to-end and proves the current tree:
//   webhook ? callback dispatch ? handleAdminCallback ? handleBroadcastCallback
//   ? confirmAndSend ? ctx.waitUntil(runBroadcast) ? history + delivery.

const { setAdminSession, getAdminSession } = await import("../database/admin-sessions.js");

test("webhook admin:bc:send runs the broadcast via ctx.waitUntil (no missing-context error)", async () => {
  const db = createFakeDb({
    groups: [
      { id: "-100111", title: "Bots", reminder_enabled: 0, last_seen: "2026-08-29 08:00:00" },
    ],
  });
  const env = { ...ADMIN_ENV(), hawkbucks_db: db };
  const ctx = fakeCtx();
  const errors = [];
  const originalError = console.error;
  console.error = (...args) => { errors.push(String(args[0])); };

  const { calls, restore } = installTelegramStub();
  try {
    // Preview session as it exists after the admin confirmed the message.
    await setAdminSession(db, "555000", {
      flow: "broadcast",
      step: "preview",
      type: "groups",
      filter: "off",
      selectedIds: ["-100111"],
      messageText: "maintenance window notice",
    });

    const response = await sendUpdate(env, {
      callback_query: {
        id: "cb-send",
        from: { id: 111222333 },
        message: { chat: { id: "555000", type: "private" }, message_id: 10 },
        data: "admin:bc:send",
      },
    }, ctx);

    assert.equal(await response.text(), "OK", "webhook must acknowledge promptly");

    // ctx.waitUntil registered exactly once with a real promise.
    assert.equal(ctx.tasks.length, 1);
    assert.ok(ctx.tasks[0] instanceof Promise);

    // The tracked promise is the actual broadcast execution: let it run.
    await ctx.tasks[0];

    // The selected group received the message (plain text).
    const sends = calls.filter((c) => c.url.includes("/sendMessage"));
    const groupSend = sends.find((c) => c.body?.chat_id === "-100111");
    assert.ok(groupSend, "selected group must receive the broadcast");
    assert.equal(groupSend.body.text, "maintenance window notice");
    assert.ok(!("parse_mode" in groupSend.body), "broadcast content is plain text");

    // Admin received the completion summary.
    const summary = sends.find((c) => c.body?.chat_id === 111222333);
    assert.ok(summary?.body?.text?.includes("Sent: 1"));

    // Broadcast history written (metadata-only).
    assert.equal(db.state.broadcast_history.length, 1);
    assert.equal(db.state.broadcast_history[0].recipient_count, 1);
    assert.ok(!("message" in db.state.broadcast_history[0]));

    // The production failure must NOT occur.
    assert.ok(!errors.some((e) => e.includes("BROADCAST_MISSING_EXECUTION_CONTEXT")),
      "BROADCAST_MISSING_EXECUTION_CONTEXT must never be logged");
  } finally {
    console.error = originalError;
    restore();
  }
});

test("webhook non-admin admin:bc:send is denied before any broadcast", async () => {
  const db = createFakeDb({
    groups: [{ id: "-100111", title: "Bots", reminder_enabled: 0, last_seen: "2026-08-29 08:00:00" }],
  });
  const env = { ...ADMIN_ENV(), hawkbucks_db: db };
  const ctx = fakeCtx();
  const { calls, restore } = installTelegramStub();
  try {
    const response = await sendUpdate(env, {
      callback_query: {
        id: "cb-evil",
        from: { id: 999 },
        message: { chat: { id: "999", type: "private" }, message_id: 10 },
        data: "admin:bc:send",
      },
    }, ctx);
    assert.equal(await response.text(), "OK");
    assert.equal(ctx.tasks.length, 0);
    assert.ok(calls.some((c) => c.body?.text === "Access denied."));
  } finally {
    restore();
  }
});
