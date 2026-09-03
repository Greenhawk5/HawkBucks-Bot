// Cache Settings admin panel feature tests.
//
// Covers the admin-only cache count (SELECT COUNT(*) FROM mission_images) and
// the confirmed destructive delete (DELETE FROM mission_images), including the
// confirmation flow, authorization and D1 error handling.

import assert from "node:assert/strict";
import test from "node:test";
import worker from "../src/index.js";
import { createFakeDb } from "./helpers/fake-db.js";

const ADMIN_ID = 111222333;

function adminEnvWithDb(db) {
  return {
    ADMIN_TELEGRAM_ID: String(ADMIN_ID),
    TELEGRAM_BOT_TOKEN: "test-token",
    hawkbucks_db: db,
  };
}

function cacheDb(rows = []) {
  return createFakeDb({
    mission_images: rows.map((date, index) => ({
      date,
      telegram_file_id: `file-${index}`,
      missions_json: "[]",
      status: "ready",
      created_at: "2026-09-03 00:05:49",
    })),
  });
}

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

async function sendCacheCallback(env, data, ctx, fromId = ADMIN_ID, chatType = "private") {
  const request = new Request("https://worker.example/webhook", {
    method: "POST",
    body: JSON.stringify({
      callback_query: {
        id: `cb-${data}`,
        from: { id: fromId },
        message: { chat: { id: ADMIN_ID, type: chatType }, message_id: 10 },
        data,
      },
    }),
    headers: { "Content-Type": "application/json" },
  });
  return worker.fetch(request, env, ctx);
}

function answersOf(calls) {
  return calls.filter((c) => c.url.includes("/answerCallbackQuery"));
}

test("admin panel shows the Cache Settings button", async () => {
  const { adminPanelKeyboard } = await import("../src/telegram/messages.js");
  const labels = adminPanelKeyboard().inline_keyboard.flat().map((b) => b.text);
  assert.ok(labels.includes("🗄️ Cache Settings"));
  const data = adminPanelKeyboard().inline_keyboard.flat().map((b) => b.callback_data);
  assert.ok(data.includes("admin:cache"));
});

test("admin can open Cache Settings via the central dispatcher", async () => {
  const env = adminEnvWithDb(cacheDb(["2026-09-03"]));
  const { calls, restore } = installTelegramStub();
  try {
    const response = await sendCacheCallback(env, "admin:cache", fakeCtx());
    assert.equal(await response.text(), "OK");
    assert.equal(answersOf(calls).length, 1, "callback must be acknowledged");
    const edits = calls.filter((c) => c.url.includes("/editMessageText"));
    assert.equal(edits.length, 1, "cache submenu must be rendered");
    const markup = edits[0].body.reply_markup;
    const labels = markup.inline_keyboard.flat().map((b) => b.text);
    assert.ok(labels.includes("📊 Today's Cached Images"));
    assert.ok(labels.includes("🗑️ Delete All Cached Images"));
    assert.ok(labels.includes("🔙 Back"));
  } finally {
    restore();
  }
});

test("non-admin cannot open Cache Settings and nothing is edited", async () => {
  const db = cacheDb(["2026-09-03"]);
  const env = adminEnvWithDb(db);
  const { calls, restore } = installTelegramStub();
  try {
    const response = await sendCacheCallback(env, "admin:cache", fakeCtx(), 999);
    assert.equal(await response.text(), "OK");
    assert.equal(calls.filter((c) => c.url.includes("/editMessageText")).length, 0);
    assert.ok(answersOf(calls).some((c) => c.body?.text === "Access denied."));
    assert.equal(db.state.mission_images.length, 1, "no data change");
  } finally {
    restore();
  }
});

test("cache count executes COUNT(*) and displays the real value", async () => {
  const db = cacheDb(["2026-09-03", "2026-09-02", "2026-09-01"]);
  const env = adminEnvWithDb(db);
  const { calls, restore } = installTelegramStub();
  try {
    const response = await sendCacheCallback(env, "admin:cache:count", fakeCtx());
    assert.equal(await response.text(), "OK");
    const countSql = db.sqlLog.find(
      (sql) => /select\s+count\(\*\)\s+as\s+image_count\s+from\s+mission_images/i.test(sql)
    );
    assert.ok(countSql, "must run SELECT COUNT(*) AS image_count FROM mission_images");
    const edit = calls.find((c) => c.url.includes("/editMessageText"));
    assert.ok(/Today: 3 images/.test(edit.body.text), edit.body.text);
  } finally {
    restore();
  }
});

test("cache count of zero displays 'Today: 0 images'", async () => {
  const env = adminEnvWithDb(cacheDb([]));
  const { calls, restore } = installTelegramStub();
  try {
    await sendCacheCallback(env, "admin:cache:count", fakeCtx());
    const edit = calls.find((c) => c.url.includes("/editMessageText"));
    assert.ok(/Today: 0 images/.test(edit.body.text));
  } finally {
    restore();
  }
});

test("D1 count failure is handled safely", async () => {
  const db = cacheDb(["2026-09-03"]);
  db.prepare = () => {
    throw new Error("D1 unavailable");
  };
  const env = adminEnvWithDb(db);
  const { calls, restore } = installTelegramStub();
  try {
    const response = await sendCacheCallback(env, "admin:cache:count", fakeCtx());
    assert.equal(await response.text(), "OK");
    assert.equal(calls.filter((c) => c.url.includes("/editMessageText")).length, 0);
    assert.ok(answersOf(calls).some((c) => c.body?.text === "Cache count unavailable."));
  } finally {
    restore();
  }
});

test("delete button shows confirmation and deletes nothing", async () => {
  const db = cacheDb(["2026-09-03", "2026-09-02"]);
  const env = adminEnvWithDb(db);
  const { calls, restore } = installTelegramStub();
  try {
    const response = await sendCacheCallback(env, "admin:cache:delete", fakeCtx());
    assert.equal(await response.text(), "OK");
    const edit = calls.find((c) => c.url.includes("/editMessageText"));
    assert.ok(edit.body.text.includes("Delete Mission Image Cache?"));
    assert.ok(edit.body.text.includes("cannot be undone"));
    const markup = edit.body.reply_markup;
    const labels = markup.inline_keyboard.flat().map((b) => b.text);
    assert.deepEqual(labels, ["❌ Yes, Delete Everything", "🔙 Cancel"]);
    assert.equal(db.state.mission_images.length, 2, "nothing deleted yet");
    const deleteSql = db.sqlLog.find((sql) => /^delete/i.test(sql));
    assert.ok(!deleteSql, "no DELETE may run before confirmation");
  } finally {
    restore();
  }
});

test("cancel does not delete anything and returns to the cache menu", async () => {
  const db = cacheDb(["2026-09-03"]);
  const env = adminEnvWithDb(db);
  const { calls, restore } = installTelegramStub();
  try {
    const response = await sendCacheCallback(env, "admin:cache:delete:cancel", fakeCtx());
    assert.equal(await response.text(), "OK");
    assert.equal(db.state.mission_images.length, 1, "nothing deleted");
    const edit = calls.find((c) => c.url.includes("/editMessageText"));
    assert.ok(edit.body.text.includes("Cache Settings"));
  } finally {
    restore();
  }
});

test("confirm runs DELETE FROM mission_images and reports the real count", async () => {
  const db = cacheDb(["2026-09-03", "2026-09-02", "2026-09-01"]);
  const env = adminEnvWithDb(db);
  const { calls, restore } = installTelegramStub();
  try {
    const response = await sendCacheCallback(env, "admin:cache:delete:confirm", fakeCtx());
    assert.equal(await response.text(), "OK");
    const deleteSql = db.sqlLog.find(
      (sql) => /^delete from mission_images$/i.test(sql.replace(/\s+/g, " ").trim())
    );
    assert.ok(deleteSql, "must run DELETE FROM mission_images");
    assert.equal(db.state.mission_images.length, 0);
    const edit = calls.find((c) => c.url.includes("/editMessageText"));
    assert.ok(/Deleted: 3 cached images/.test(edit.body.text), edit.body.text);
  } finally {
    restore();
  }
});

test("delete of an empty cache reports 0 deleted", async () => {
  const db = cacheDb([]);
  const env = adminEnvWithDb(db);
  const { calls, restore } = installTelegramStub();
  try {
    await sendCacheCallback(env, "admin:cache:delete:confirm", fakeCtx());
    const edit = calls.find((c) => c.url.includes("/editMessageText"));
    assert.ok(/Deleted: 0 cached images/.test(edit.body.text));
  } finally {
    restore();
  }
});

test("D1 delete failure is handled safely", async () => {
  const db = cacheDb(["2026-09-03"]);
  const originalPrepare = db.prepare.bind(db);
  db.prepare = (sql) => {
    if (/^delete/i.test(sql)) throw new Error("D1 write failure");
    return originalPrepare(sql);
  };
  const env = adminEnvWithDb(db);
  const { calls, restore } = installTelegramStub();
  try {
    const response = await sendCacheCallback(env, "admin:cache:delete:confirm", fakeCtx());
    assert.equal(await response.text(), "OK");
    assert.equal(db.state.mission_images.length, 1, "rows survive a failed delete");
    assert.ok(answersOf(calls).some((c) => c.body?.text === "Cache clearing failed."));
  } finally {
    restore();
  }
});

test("non-admin cannot trigger the delete confirm callback directly", async () => {
  const db = cacheDb(["2026-09-03"]);
  const env = adminEnvWithDb(db);
  const { calls, restore } = installTelegramStub();
  try {
    const response = await sendCacheCallback(env, "admin:cache:delete:confirm", fakeCtx(), 999);
    assert.equal(await response.text(), "OK");
    assert.equal(db.state.mission_images.length, 1, "nothing deleted");
    assert.ok(answersOf(calls).some((c) => c.body?.text === "Access denied."));
  } finally {
    restore();
  }
});

test("admin cache callbacks are private-chat-only", async () => {
  const db = cacheDb(["2026-09-03"]);
  const env = adminEnvWithDb(db);
  const { calls, restore } = installTelegramStub();
  try {
    const response = await sendCacheCallback(env, "admin:cache:delete:confirm", fakeCtx(), ADMIN_ID, "group");
    assert.equal(await response.text(), "OK");
    assert.equal(db.state.mission_images.length, 1, "nothing deleted from a group chat");
    assert.ok(answersOf(calls).some((c) => c.body?.text === "Access denied."));
  } finally {
    restore();
  }
});

test("missing database binding fails safely", async () => {
  const env = adminEnvWithDb(undefined);
  const { calls, restore } = installTelegramStub();
  try {
    const response = await sendCacheCallback(env, "admin:cache:count", fakeCtx());
    assert.equal(await response.text(), "OK");
    assert.ok(answersOf(calls).some((c) => c.body?.text === "Cache count unavailable."));
  } finally {
    restore();
  }
});
