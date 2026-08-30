// Admin broadcast flow: recipient type → filter → individual selection →
// message input → preview → confirm → delivery.
//
// Security: every callback/text input has already been verified as the
// configured admin by handleAdminCallback/handleAdminTextInput. Recipient
// IDs are always re-resolved from D1 at send time — callback data only
// carries type/filter/page/index, never chat IDs.
//
// State is persisted in D1 (admin_sessions) because Workers are stateless.
// Channels are deliberately excluded from custom broadcasts: the bot usually
// only has post-permissions there, and failed posts would be noisy. The
// daily reminder pipeline already covers channels.

import { editMessageText, sendMessage, answerCallbackQuery } from "./api.js";
import { getAdminSession, setAdminSession, deleteAdminSession } from "../../database/admin-sessions.js";
import { countBroadcastRecipients, listBroadcastRecipients } from "../../database/recipients.js";
import { runBroadcast } from "../services/broadcast.js";
import { getAdminId } from "../config/admin.js";
import { escapeMarkdownV2 } from "./messages.js";

const SELECT_PAGE_SIZE = 10;
// Cloudflare Workers free plan allows ~50 subrequests per invocation; each
// delivery is one Telegram API call. 45 keeps a full broadcast safely inside
// the limit. Enforced server-side at selection AND at send time.
const MAX_RECIPIENTS = 45;

const FILTERS = ["all", "on", "off", "active", "inactive"];
const TYPES = ["users", "groups"];

function bold(value) {
  return `*${escapeMarkdownV2(value)}*`;
}
function text(value) {
  return escapeMarkdownV2(value);
}

function typeLabel(type) {
  return type === "users" ? "👤 Users" : "👥 Groups";
}

function filterLabel(filter) {
  return {
    all: "All",
    on: "🔔 Reminder ON",
    off: "🔕 Reminder OFF",
    active: "⚡ Recently active (7 days)",
    inactive: "💤 Inactive (7+ days)",
  }[filter] || filter;
}

function selectionKeyboard({ type, filter, page, hasPrev, hasNext, items }) {
  const nav = [];
  if (hasPrev) nav.push({ text: "⬅️ Previous", callback_data: `admin:bc:sel:${type}:${filter}:p${page - 1}` });
  if (hasNext) nav.push({ text: "➡️ Next", callback_data: `admin:bc:sel:${type}:${filter}:p${page + 1}` });
  return {
    inline_keyboard: [
      // Individual toggle buttons (one per recipient row).
      ...items.map((item, index) => [{
        text: `${item.selected ? "☑" : "☐"} ${item.label}`,
        callback_data: `admin:bc:tg:${type}:${filter}:p${page}:i${index}`,
      }]),
      ...(nav.length ? [nav] : []),
      [
        { text: "✅ Select Page", callback_data: `admin:bc:allp:${type}:${filter}:${page}` },
        { text: "🗑 Clear All", callback_data: `admin:bc:clear:${type}:${filter}` },
      ],
      [{ text: "➡️ Next Step", callback_data: `admin:bc:next:${type}:${filter}` }],
      [{ text: "🔙 Back", callback_data: "admin:bc" }],
    ],
  };
}

function rootKeyboard() {
  return {
    inline_keyboard: [
      [{ text: "👤 Users", callback_data: "admin:bc:type:users" }],
      [{ text: "👥 Groups", callback_data: "admin:bc:type:groups" }],
      [{ text: "🔙 Back", callback_data: "admin:root" }],
    ],
  };
}

function filterKeyboard(type) {
  return {
    inline_keyboard: [
      [{ text: "All", callback_data: `admin:bc:filter:${type}:all` }],
      [
        { text: "🔔 Reminder ON", callback_data: `admin:bc:filter:${type}:on` },
        { text: "🔕 Reminder OFF", callback_data: `admin:bc:filter:${type}:off` },
      ],
      [
        { text: "⚡ Recently Active", callback_data: `admin:bc:filter:${type}:active` },
        { text: "💤 Inactive", callback_data: `admin:bc:filter:${type}:inactive` },
      ],
      [{ text: "🔙 Back", callback_data: "admin:bc" }],
    ],
  };
}

// ---------- Handlers ----------

export async function handleBroadcastCallback(env, db, { chatId, messageId, queryId, parts, ctx }) {
  const action = parts[2];

  if (!action) {
    // Root: pick recipient type.
    await setAdminSession(db, chatId, { flow: "broadcast", step: "type" });
    await editMessageText(
      env,
      chatId,
      messageId,
      `${bold("📨 Broadcast Message")}\n\n${text("Select recipient type:")}\n${text("(Channels receive the daily reminder automatically and are excluded from custom broadcasts.)")}`,
      { reply_markup: rootKeyboard() }
    );
    await answer(env, queryId);
    return true;
  }

  if (action === "type" && TYPES.includes(parts[3])) {
    const type = parts[3];
    await setAdminSession(db, chatId, { flow: "broadcast", step: "filter", type, selectedIds: [] });
    await editMessageText(
      env,
      chatId,
      messageId,
      `${bold("📨 Broadcast — Filter Recipients")}\n${text(`Type: ${typeLabel(type)}`)}`,
      { reply_markup: filterKeyboard(type) }
    );
    await answer(env, queryId);
    return true;
  }

  if (action === "filter" && TYPES.includes(parts[3]) && FILTERS.includes(parts[4])) {
    const [, , , type, filter] = parts;
    await setAdminSession(db, chatId, { flow: "broadcast", step: "select", type, filter, selectedIds: [] });
    return showSelectionPage(env, db, chatId, messageId, type, filter, 0, queryId);
  }

  if (action === "sel") {
    const page = parsePageInt(parts[5]);
    return showSelectionPage(env, db, chatId, messageId, parts[3], parts[4], page, queryId);
  }

  if (action === "tg") {
    // Toggle one recipient on the current page: admin:bc:tg:<type>:<filter>:p<i>:idx
    return toggleRecipient(env, db, chatId, messageId, parts[3], parts[4], parsePageInt(parts[5]), parseItemIndex(parts[6]), queryId);
  }

  if (action === "allp") {
    return selectPage(env, db, chatId, messageId, parts[3], parts[4], parsePageInt(parts[5]), queryId);
  }

  if (action === "clear") {
    const session = await getAdminSession(db, chatId);
    await setAdminSession(db, chatId, { ...(session || {}), step: "select", type: parts[3], filter: parts[4], selectedIds: [] });
    return showSelectionPage(env, db, chatId, messageId, parts[3], parts[4], 0, queryId);
  }

  if (action === "next") {
    return startMessageInput(env, db, chatId, messageId, parts[3], parts[4], queryId);
  }

  if (action === "back") {
    // Back from message-input/preview to selection.
    const session = await getAdminSession(db, chatId);
    const type = parts[3] || session?.type || "users";
    const filter = parts[4] || session?.filter || "all";
    await setAdminSession(db, chatId, { ...(session || {}), step: "select", type, filter });
    return showSelectionPage(env, db, chatId, messageId, type, filter, 0, queryId);
  }

  if (action === "send") {
    return confirmAndSend(env, db, chatId, messageId, queryId, ctx);
  }

  await answer(env, queryId, { text: "Access denied." });
  return true;
}

async function answer(env, queryId, options = {}) {
  await answerCallbackQuery(env, queryId, options);
}

// ---------- Selection views ----------

async function showSelectionPage(env, db, chatId, messageId, type, filter, page, queryId) {
  if (!TYPES.includes(type) || !FILTERS.includes(filter)) {
    await answer(env, queryId, { text: "Invalid selection." });
    return true;
  }
  const session = (await getAdminSession(db, chatId)) || {};
  const selected = new Set(session.selectedIds || []);

  const offset = page * SELECT_PAGE_SIZE;
  const rows = await listBroadcastRecipients(db, type, filter, { offset, limit: SELECT_PAGE_SIZE });
  const totalRows = await countBroadcastRecipients(db, type, filter);

  const lines = rows.map((row) => {
    const checked = selected.has(String(row.id)) ? "☑" : "☐";
    const label = type === "users"
      ? `${row.displayName}${row.username ? ` (@${row.username})` : ""}`
      : row.displayName;
    return `${checked} ${escapeMarkdownV2(String(label).slice(0, 60))}`;
  });

  const body = lines.length
    ? lines.join("\n")
    : text("No recipients match this filter.");

  const hasPrev = page > 0;
  const hasNext = offset + rows.length < totalRows;

  const items = rows.map((row) => {
    const label = type === "users"
      ? `${row.displayName}${row.username ? ` (@${row.username})` : ""}`
      : row.displayName;
    return { label: String(label).slice(0, 40), selected: selected.has(String(row.id)) };
  });

  await editMessageText(
    env,
    chatId,
    messageId,
    [
      bold("📨 Select Recipients"),
      text(`${typeLabel(type)} • ${filterLabel(filter)}`),
      "",
      body,
      "",
      text(`Selected: ${selected.size} • Page ${page + 1} • ${totalRows} matching (max ${MAX_RECIPIENTS})`),
    ].join("\n"),
    { reply_markup: selectionKeyboard({ type, filter, page, hasPrev, hasNext, items }) }
  );
  await answer(env, queryId);
  return true;
}

async function toggleRecipient(env, db, chatId, messageId, type, filter, page, index, queryId) {
  const session = await getAdminSession(db, chatId);
  if (!session || session.flow !== "broadcast" || !TYPES.includes(type) || !FILTERS.includes(filter)) {
    await answer(env, queryId, { text: "Session expired. Please restart the broadcast." });
    return true;
  }
  const offset = page * SELECT_PAGE_SIZE;
  const rows = await listBroadcastRecipients(db, type, filter, { offset, limit: SELECT_PAGE_SIZE });
  const row = rows[index];
  if (!row) {
    await answer(env, queryId, { text: "Invalid selection." });
    return true;
  }
  const selected = new Set(session.selectedIds || []);
  const id = String(row.id);
  if (selected.has(id)) selected.delete(id);
  else if (selected.size < MAX_RECIPIENTS) selected.add(id);
  else {
    await answer(env, queryId, { text: `Maximum ${MAX_RECIPIENTS} recipients per broadcast.` });
    return true;
  }
  await setAdminSession(db, chatId, { ...session, selectedIds: [...selected] });
  return showSelectionPage(env, db, chatId, messageId, type, filter, page, queryId);
}

async function selectPage(env, db, chatId, messageId, type, filter, page, queryId) {
  const session = await getAdminSession(db, chatId);
  if (!session || session.flow !== "broadcast") {
    await answer(env, queryId, { text: "Session expired. Please restart the broadcast." });
    return true;
  }
  const offset = page * SELECT_PAGE_SIZE;
  const rows = await listBroadcastRecipients(db, type, filter, { offset, limit: SELECT_PAGE_SIZE });
  const selected = new Set(session.selectedIds || []);
  for (const row of rows) {
    if (selected.size < MAX_RECIPIENTS) selected.add(String(row.id));
  }
  await setAdminSession(db, chatId, { ...session, selectedIds: [...selected] });
  return showSelectionPage(env, db, chatId, messageId, type, filter, page, queryId);
}

// ---------- Message input, preview and send ----------

async function startMessageInput(env, db, chatId, messageId, type, filter, queryId) {
  const session = await getAdminSession(db, chatId);
  if (!session || session.flow !== "broadcast" || !(session.selectedIds || []).length) {
    await answer(env, queryId, { text: "Select at least one recipient first." });
    return true;
  }
  await setAdminSession(db, chatId, { ...session, step: "message_input", type, filter });
  await editMessageText(
    env,
    chatId,
    messageId,
    [
      bold("📨 Broadcast — Message"),
      "",
      text(`Recipients selected: ${(session.selectedIds || []).length} (max ${MAX_RECIPIENTS})`),
      text("Send your message now (plain text)."),
      text("It will be delivered exactly as written, without formatting."),
      "",
      text("🔙 Use the Back button below to change recipients."),
    ].join("\n"),
    {
      inline_keyboard: [[{ text: "🔙 Back", callback_data: `admin:bc:back:${type}:${filter}` }]],
    }
  );
  await answer(env, queryId);
  return true;
}

/** Called for admin private text messages while a broadcast session is active. */
export async function handleBroadcastTextInput(env, db, message) {
  const session = await getAdminSession(db, message.chat.id);
  if (!session || session.flow !== "broadcast") return false;

  if (session.step === "message_input") {
    const content = String(message.text || "").trim();
    if (!content) return false;
    await setAdminSession(db, message.chat.id, { ...session, step: "preview", messageText: content });
    const selectedCount = (session.selectedIds || []).length;
    await sendMessage(
      env,
      message.chat.id,
      [
        bold("📨 Broadcast Preview"),
        "",
        `${text("Recipients:")} ${text(selectedCount)}`,
        "",
        bold("Message:"),
        escapeMarkdownV2(content),
      ].join("\n"),
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "✅ Send", callback_data: "admin:bc:send" }],
            [{ text: "🔙 Back", callback_data: `admin:bc:back:${session.type}:${session.filter}` }],
          ],
        },
      }
    );
    return true;
  }

  return false;
}

async function confirmAndSend(env, db, chatId, messageId, queryId, ctx) {
  const session = await getAdminSession(db, chatId);
  if (!session || session.flow !== "broadcast" || session.step !== "preview" || !session.messageText) {
    await answer(env, queryId, { text: "Session expired. Please restart the broadcast." });
    return true;
  }

  const adminId = getAdminId(env);
  if (!adminId) {
    await answer(env, queryId, { text: "Access denied." });
    return true;
  }

  // Re-resolve recipients from D1 by ID — never trust IDs from session alone
  // for authorization, but selection IDs were built from D1 rows in this
  // session, so re-validating their existence keeps delivery accurate.
  const recipients = await resolveSelectedRecipients(db, session.type, session.selectedIds);

  // Server-side cap: never trust selection state alone.
  if (recipients.length > MAX_RECIPIENTS) {
    console.error("BROADCAST_CAP_EXCEEDED", { requested: recipients.length, cap: MAX_RECIPIENTS });
    await answer(env, queryId, { text: `Broadcast limit is ${MAX_RECIPIENTS} recipients.` });
    return true;
  }

  await editMessageText(
    env,
    chatId,
    messageId,
    [
      bold("📨 Broadcast started."),
      "",
      text(`Recipients: ${recipients.length}`),
      text("You will receive a summary when it completes."),
    ].join("\n")
  );
  await answer(env, queryId);

  await deleteAdminSession(db, chatId);

  // Register the delivery with the Worker execution context so it keeps
  // running after the webhook response returns. Never await it here.
  const execution = runBroadcast(env, db, {
    adminId,
    recipients: recipients.map((r) => String(r.id)),
    messageText: session.messageText,
  }).catch((error) => {
    console.error("BROADCAST_RUN_FAILED", { error: error.message });
  });

  if (ctx?.waitUntil) {
    ctx.waitUntil(execution);
  } else {
    // No execution context (e.g. unusual embedding): fail loudly in logs
    // instead of silently dropping the broadcast.
    console.error("BROADCAST_MISSING_EXECUTION_CONTEXT", { recipients: recipients.length });
  }

  return true;
}

async function resolveSelectedRecipients(db, type, selectedIds) {
  if (!TYPES.includes(type) || !Array.isArray(selectedIds) || !selectedIds.length) return [];
  // users are keyed by telegram_id; groups/channels by id.
  const table = type === "users" ? "users" : "groups";
  const idColumn = type === "users" ? "telegram_id" : "id";
  const placeholders = selectedIds.map(() => "?").join(",");
  const rows = await db.prepare(
    `SELECT ${idColumn} AS id FROM ${table} WHERE ${idColumn} IN (${placeholders})`
  ).bind(...selectedIds).all();
  return rows.results || [];
}

function parsePageInt(value) {
  const page = Number(String(value || "p0").replace(/^p/, ""));
  return Number.isSafeInteger(page) && page >= 0 && page < 10000 ? page : 0;
}

function parseItemIndex(value) {
  const index = Number(String(value || "i0").replace(/^i/, ""));
  return Number.isSafeInteger(index) && index >= 0 ? index : -1;
}



