import assert from "node:assert/strict";
import test from "node:test";
import { createFakeDb } from "./helpers/fake-db.js";
import { setAdminSession, getAdminSession } from "../database/admin-sessions.js";
import { handleBroadcastCallback } from "../src/telegram/admin-broadcast.js";
import { handleAdminCallback } from "../src/telegram/admin-panel.js";

// ---------- fetch stub (Telegram API) ----------

function installTelegramStub() {
  const calls = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : null;
    calls.push({ url: String(url), body });
    return {
      ok: true,
      json: async () => ({ ok: true, result: { message_id: 1 } }),
    };
  };
  return { calls, restore: () => { globalThis.fetch = original; } };
}

function fakeCtx() {
  const tasks = [];
  return { tasks, waitUntil(p) { tasks.push(p); } };
}

const ADMIN_ENV = { ADMIN_TELEGRAM_ID: "111222333", TELEGRAM_BOT_TOKEN: "test-token" };

function makeUsers(count) {
  return Array.from({ length: count }, (_, i) => ({
    telegram_id: String(i + 1),
    username: `user${i + 1}`,
    first_name: `User ${i + 1}`,
    reminder_enabled: 1,
    last_seen: "2026-08-29 10:00:00",
  }));
}

function callbackFor(chatId, data) {
  return { message: { chat: { id: chatId, type: "private" }, message_id: 42 }, from: { id: 111222333 }, data };
}

// ---------- Fix 1: ctx.waitUntil lifecycle ----------

test("confirmed broadcast is registered with ctx.waitUntil", async () => {
  const db = createFakeDb({ users: makeUsers(5) });
  await setAdminSession(db, "777", {
    flow: "broadcast", step: "preview", type: "users", filter: "all",
    selectedIds: ["1", "2", "3"], messageText: "hello fleet",
  });

  const { calls, restore } = installTelegramStub();
  const ctx = fakeCtx();
  try {
    const handled = await handleBroadcastCallback(
      ADMIN_ENV, db,
      { chatId: "777", messageId: 42, queryId: "q1", parts: ["admin", "bc", "send"], ctx }
    );
    assert.equal(handled, true);
    assert.equal(ctx.tasks.length, 1, "ctx.waitUntil must be called exactly once");
    assert.ok(ctx.tasks[0] instanceof Promise, "waitUntil must receive the broadcast Promise");

    assert.equal(await getAdminSession(db, "777"), null, "session cleared after confirmation");

    await ctx.tasks[0];
    const sends = calls.filter((c) => c.url.includes("/sendMessage"));
    assert.equal(sends.length, 4); // 3 recipients + 1 summary
  } finally {
    restore();
  }
});

test("broadcast completes after webhook returns (tracked by waitUntil)", async () => {
  const db = createFakeDb({ users: makeUsers(2) });
  await setAdminSession(db, "888", {
    flow: "broadcast", step: "preview", type: "users", filter: "all",
    selectedIds: ["1", "2"], messageText: "ping",
  });

  const { calls, restore } = installTelegramStub();
  const ctx = fakeCtx();
  try {
    await handleBroadcastCallback(
      ADMIN_ENV, db,
      { chatId: "888", messageId: 42, queryId: "q2", parts: ["admin", "bc", "send"], ctx }
    );
    await ctx.tasks[0]; // simulate response returning first, then task running
    const sends = calls.filter((c) => c.url.includes("/sendMessage"));
    assert.equal(sends.length, 3); // 2 recipients + summary
  } finally {
    restore();
  }
});

test("missing execution context is logged loudly, not silently dropped", async () => {
  const db = createFakeDb({ users: makeUsers(1) });
  await setAdminSession(db, "999", {
    flow: "broadcast", step: "preview", type: "users", filter: "all",
    selectedIds: ["1"], messageText: "x",
  });

  const { calls, restore } = installTelegramStub();
  const errors = [];
  const originalError = console.error;
  console.error = (...args) => { errors.push(String(args[0])); };
  try {
    await handleBroadcastCallback(
      ADMIN_ENV, db,
      { chatId: "999", messageId: 42, queryId: "q3", parts: ["admin", "bc", "send"], ctx: undefined }
    );
    // The untracked run keeps going; wait until it fully completes (1 deliver
    // + 1 summary) before restoring fetch so it cannot leak into other tests
    // or hit the real Telegram API.
    const deadline = Date.now() + 5000;
    while (calls.filter((c) => c.url.includes("/sendMessage")).length < 2 && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 25));
    }
    assert.ok(errors.some((e) => e.includes("BROADCAST_MISSING_EXECUTION_CONTEXT")));
  } finally {
    console.error = originalError;
    restore();
  }
});

// ---------- Fix 4: 45-recipient cap ----------

test("45 recipients are accepted and delivered", async () => {
  const db = createFakeDb({ users: makeUsers(45) });
  await setAdminSession(db, "800", {
    flow: "broadcast", step: "preview", type: "users", filter: "all",
    selectedIds: makeUsers(45).map((u) => u.telegram_id), messageText: "cap edge",
  });

  const { calls, restore } = installTelegramStub();
  const ctx = fakeCtx();
  try {
    await handleBroadcastCallback(
      ADMIN_ENV, db,
      { chatId: "800", messageId: 42, queryId: "q4", parts: ["admin", "bc", "send"], ctx }
    );
    assert.equal(ctx.tasks.length, 1);
    await ctx.tasks[0];
    const sends = calls.filter((c) => c.url.includes("/sendMessage"));
    assert.equal(sends.length, 46); // 45 recipients + summary
  } finally {
    restore();
  }
});

test("46 recipients are rejected server-side at send time", async () => {
  const db = createFakeDb({ users: makeUsers(46) });
  await setAdminSession(db, "801", {
    flow: "broadcast", step: "preview", type: "users", filter: "all",
    selectedIds: makeUsers(46).map((u) => u.telegram_id), messageText: "over cap",
  });

  const { calls, restore } = installTelegramStub();
  const ctx = fakeCtx();
  try {
    await handleBroadcastCallback(
      ADMIN_ENV, db,
      { chatId: "801", messageId: 42, queryId: "q5", parts: ["admin", "bc", "send"], ctx }
    );
    assert.equal(ctx.tasks.length, 0, "no broadcast may start over the cap");
    const answers = calls.filter((c) => c.url.includes("/answerCallbackQuery"));
    assert.ok(answers.some((c) => c.body?.text?.includes("45")), "cap rejection must be answered");
    assert.ok(await getAdminSession(db, "801"), "session kept so admin can adjust selection");
  } finally {
    restore();
  }
});

test("selection cap cannot be bypassed by toggling beyond 45", async () => {
  const db = createFakeDb({ users: makeUsers(46) });
  const ids = makeUsers(46).map((u) => u.telegram_id);
  await setAdminSession(db, "802", {
    flow: "broadcast", step: "select", type: "users", filter: "all",
    selectedIds: ids.slice(0, 45), // already at cap
  });

  const { calls, restore } = installTelegramStub();
  try {
    // Forged callback attempts to add the 46th recipient (page 4, index 5).
    await handleBroadcastCallback(
      ADMIN_ENV, db,
      { chatId: "802", messageId: 42, queryId: "q6", parts: ["admin", "bc", "tg", "users", "all", "p4", "i5"] }
    );
    const answers = calls.filter((c) => c.url.includes("/answerCallbackQuery"));
    assert.ok(answers.some((c) => c.body?.text?.includes("45")));
    const session = await getAdminSession(db, "802");
    assert.equal(session.selectedIds.length, 45);
  } finally {
    restore();
  }
});

// ---------- Fix: bc:filter runtime regression ----------

test("bc:filter renders the selection screen for Groups → Reminder OFF (no ReferenceError)", async () => {
  const db = createFakeDb({
    groups: [
      { id: "-100111", title: "Bots", reminder_enabled: 0, last_seen: "2026-08-29 08:00:00" },
      { id: "-100222", title: "Active Group", reminder_enabled: 1, last_seen: "2026-08-29 07:00:00" },
    ],
  });

  const { calls, restore } = installTelegramStub();
  const ctx = fakeCtx();
  try {
    // Step 1: choose recipient type (creates the broadcast session).
    await handleBroadcastCallback(
      ADMIN_ENV, db,
      { chatId: "810", messageId: 42, queryId: "qf1", parts: ["admin", "bc", "type", "groups"], ctx }
    );
    // Step 2: choose the Reminder OFF filter → renders the selection page.
    await handleBroadcastCallback(
      ADMIN_ENV, db,
      { chatId: "810", messageId: 42, queryId: "qf2", parts: ["admin", "bc", "filter", "groups", "off"], ctx }
    );

    const edits = calls.filter((c) => c.url.includes("/editMessageText"));
    assert.equal(edits.length, 2, "filter selection must render the recipient screen");
    const lastBody = JSON.stringify(edits.at(-1)?.body || {});
    assert.ok(lastBody.includes("Bots"), "disabled group must appear in the selection list");
    assert.ok(lastBody.includes("45"), "cap must be communicated in the UI");

    // The exact production failure surfaced as a generic error answer.
    const bad = calls.filter(
      (c) => c.url.includes("/answerCallbackQuery") && c.body?.text === "Something went wrong."
    );
    assert.equal(bad.length, 0, "no swallowed exceptions expected");
  } finally {
    restore();
  }
});

test("bc:filter renders Users → All, Groups → All and Groups → Inactive without errors", async () => {
  for (const [type, filter] of [["users", "all"], ["groups", "all"], ["groups", "inactive"]]) {
    const db = createFakeDb({
      users: makeUsers(2),
      groups: [{ id: "-100111", title: "Bots", reminder_enabled: 0, last_seen: "2026-08-29 08:00:00" }],
    });
    const { calls, restore } = installTelegramStub();
    try {
      await handleBroadcastCallback(
        ADMIN_ENV, db,
        { chatId: "811", messageId: 42, queryId: `q-${type}-${filter}`, parts: ["admin", "bc", "type", type], ctx: fakeCtx() }
      );
      await handleBroadcastCallback(
        ADMIN_ENV, db,
        { chatId: "811", messageId: 42, queryId: `q2-${type}-${filter}`, parts: ["admin", "bc", "filter", type, filter], ctx: fakeCtx() }
      );
      const edits = calls.filter((c) => c.url.includes("/editMessageText"));
      assert.equal(edits.length, 2, `${type}/${filter} must render`);
      const bad = calls.filter((c) => c.body?.text === "Something went wrong.");
      assert.equal(bad.length, 0, `${type}/${filter} must not error`);
    } finally {
      restore();
    }
  }
});


test("non-admin forged broadcast callbacks are denied and never reach waitUntil", async () => {
  const db = createFakeDb({ users: makeUsers(5) });
  await setAdminSession(db, "901", {
    flow: "broadcast", step: "preview", type: "users", filter: "all",
    selectedIds: ["1"], messageText: "malicious",
  });

  const { calls, restore } = installTelegramStub();
  const ctx = fakeCtx();
  try {
    const handled = await handleAdminCallback(
      ADMIN_ENV, db,
      {
        message: { chat: { id: "901", type: "private" }, message_id: 42 },
        from: { id: 999 }, // attacker
        data: "admin:bc:send",
      },
      ctx
    );
    assert.equal(handled, true);
    assert.equal(ctx.tasks.length, 0);
    const answers = calls.filter((c) => c.url.includes("/answerCallbackQuery"));
    assert.ok(answers.some((c) => c.body?.text === "Access denied."));
  } finally {
    restore();
  }
});

test("admin callbacks in group chats are denied (private only)", async () => {
  const { calls, restore } = installTelegramStub();
  try {
    const handled = await handleAdminCallback(
      ADMIN_ENV, createFakeDb(),
      {
        message: { chat: { id: "-100group", type: "supergroup" }, message_id: 7 },
        from: { id: 111222333 },
        data: "admin:root",
      },
      fakeCtx()
    );
    assert.equal(handled, true);
    const answers = calls.filter((c) => c.url.includes("/answerCallbackQuery"));
    assert.ok(answers.some((c) => c.body?.text === "Access denied."));
  } finally {
    restore();
  }
});



