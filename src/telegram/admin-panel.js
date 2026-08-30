// Admin Panel controller.
//
// Security model:
// - The panel is only reachable in private chats by the configured
//   administrator (ADMIN_TELEGRAM_ID Cloudflare Secret via src/config/admin.js).
// - EVERY callback with the "admin:" prefix re-verifies the actual Telegram
//   sender ID against the secret. Callback data is never trusted on its own.
// - Pagination/page numbers only select offsets; recipient data always comes
//   from D1, never from callback payloads.

import {
  answerCallbackQuery,
  deleteMessage,
  editMessageText,
  sendMessage,
  sendDocument,
} from "./api.js";
import { isAdmin } from "../config/admin.js";
import {
  getUsageStats,
  getActiveReminderCounts,
  listActiveReminderUsers,
  listActiveReminderChats,
  listActiveUsersSince,
  listActiveChatsSince,
  PERIODS,
} from "../../database/stats.js";
import { buildPdfDocument } from "../services/pdf.js";
import {
  adminPanelText,
  adminPanelKeyboard,
  adminUsagePeriodsKeyboard,
  adminUsagePeriodText,
  adminUsageStatsKeyboard,
  adminRemindersText,
  adminRemindersKeyboard,
  adminReminderListKeyboard,
  ADMIN_ACCESS_DENIED_MESSAGE,
  ADMIN_PANEL_CLOSED_MESSAGE,
  ADMIN_EMPTY_STATE_PREFIX,
  escapeMarkdownV2,
} from "./messages.js";
import { getMainKeyboard } from "./keyboards.js";
import {
  handleBroadcastCallback,
  handleBroadcastTextInput,
} from "./admin-broadcast.js";

const REMINDER_PAGE_SIZE = 10;

function isAdminCallback(data) {
  return typeof data === "string" && data.startsWith("admin:");
}

function parsePage(value) {
  const page = Number(value);
  return Number.isSafeInteger(page) && page >= 0 && page < 10000 ? page : 0;
}

function utcTimestampLabel(now = new Date()) {
  return `${now.toISOString().slice(0, 19).replace("T", " ")} UTC`;
}

function bold(value) {
  return `*${escapeMarkdownV2(value)}*`;
}

function text(value) {
  return escapeMarkdownV2(value);
}

// ---------- Usage statistics ----------

async function showUsagePeriods(env, db, chatId, messageId, queryId) {
  await editMessageText(env, chatId, messageId, adminPanelText(), {
    reply_markup: adminUsagePeriodsKeyboard(),
  });
  await answerCallbackQuery(env, queryId);
  return true;
}

async function showUsageStats(env, db, chatId, messageId, period, queryId) {
  if (!PERIODS.includes(period)) {
    await answerCallbackQuery(env, queryId, { text: "Invalid period." });
    return true;
  }
  const stats = await getUsageStats(db, period);
  if (!stats) {
    await answerCallbackQuery(env, queryId, { text: "Statistics unavailable." });
    return true;
  }
  await editMessageText(env, chatId, messageId, adminUsagePeriodText(period, stats), {
    reply_markup: adminUsageStatsKeyboard(period),
  });
  await answerCallbackQuery(env, queryId);
  return true;
}

const PERIOD_PDF_LABELS = {
  day: "Today",
  week: "Current Week",
  month: "Current Month",
  "6months": "Last 6 Months",
  year: "Last 12 Months",
};

const PERIOD_FILE_SLUGS = {
  day: "today",
  week: "current-week",
  month: "current-month",
  "6months": "last-6-months",
  year: "last-12-months",
};

function formatLastSeen(value) {
  return value ? String(value).slice(0, 16) : "—";
}

function usagePdfBlocks(period, stats, users, groups, channels) {
  return {
    title: "Usage Statistics",
    subtitle: `Period: ${PERIOD_PDF_LABELS[period] || period}   |   Generated: ${utcTimestampLabel()} (UTC)`,
    blocks: [
      {
        type: "cards",
        items: [
          { label: "USERS", value: stats.users },
          { label: "GROUPS", value: stats.groups },
          { label: "CHANNELS", value: stats.channels },
          { label: "TOTAL", value: stats.total },
        ],
      },
      { type: "space", size: 6 },
      { type: "text", text: "Counts reflect entities whose last recorded activity falls within the selected period (UTC).", muted: true },
      { type: "heading", text: "USER ACTIVITY" },
      {
        type: "table",
        columns: [
          { label: "Name", width: 3 },
          { label: "ID", width: 2 },
          { label: "Last Used", width: 2, align: "right" },
        ],
        rows: users.map((u) => [
          u.first_name || u.username || "Unknown",
          String(u.telegram_id),
          formatLastSeen(u.last_seen),
        ]),
      },
      { type: "heading", text: "GROUP ACTIVITY" },
      {
        type: "table",
        columns: [
          { label: "Title", width: 3 },
          { label: "ID", width: 2 },
          { label: "Reminder", width: 1.2, align: "right" },
          { label: "Last Used", width: 2, align: "right" },
        ],
        rows: groups.map((g) => [
          g.title || "Unnamed",
          String(g.id),
          Number(g.reminder_enabled) === 1 ? "ON" : "OFF",
          formatLastSeen(g.last_seen),
        ]),
      },
      { type: "heading", text: "CHANNEL ACTIVITY" },
      {
        type: "table",
        columns: [
          { label: "Title", width: 3 },
          { label: "ID", width: 2 },
          { label: "Reminder", width: 1.2, align: "right" },
          { label: "Last Used", width: 2, align: "right" },
        ],
        rows: channels.map((c) => [
          c.title || "Unnamed",
          String(c.id),
          Number(c.reminder_enabled) === 1 ? "ON" : "OFF",
          formatLastSeen(c.last_seen),
        ]),
      },
      { type: "space", size: 6 },
      { type: "text", text: "Reminder column shows the current daily-reminder setting for the chat.", muted: true },
    ],
  };
}

async function exportUsagePdf(env, db, chatId, period, queryId) {
  if (!PERIODS.includes(period)) {
    await answerCallbackQuery(env, queryId, { text: "Invalid period." });
    return true;
  }
  try {
    const stats = await getUsageStats(db, period);
    if (!stats) throw new Error("stats unavailable");
    const [users, groups, channels] = await Promise.all([
      listActiveUsersSince(db, stats.since),
      listActiveChatsSince(db, "groups", stats.since),
      listActiveChatsSince(db, "channels", stats.since),
    ]);
    const pdf = buildPdfDocument(usagePdfBlocks(period, stats, users, groups, channels));
    await sendDocument(
      env,
      chatId,
      pdf,
      `hawkbucks-usage-${PERIOD_FILE_SLUGS[period] || period}.pdf`,
      `Usage statistics (${PERIOD_PDF_LABELS[period] || period})`
    );
    await answerCallbackQuery(env, queryId);
  } catch (error) {
    console.error("ADMIN_USAGE_PDF_FAILED", { period, error: error.message });
    await answerCallbackQuery(env, queryId, { text: "PDF export failed.", show_alert: true });
  }
  return true;
}

// ---------- Active reminders ----------

function formatReminderUser(user) {
  const id = escapeMarkdownV2(user.telegram_id);
  const name = user.first_name ? escapeMarkdownV2(user.first_name) : "Unknown";
  const username = user.username ? ` @${escapeMarkdownV2(user.username)}` : "";
  return `• ${name}${username} — ${text("ID")} ${id}`;
}

function formatReminderChat(chat) {
  const title = chat.title ? escapeMarkdownV2(chat.title) : "Unnamed";
  return `• ${title} — ${text("ID")} ${escapeMarkdownV2(chat.id)}`;
}

async function showReminderList(env, db, chatId, messageId, category, page, queryId) {
  const categories = ["users", "groups", "channels"];
  if (!categories.includes(category)) {
    await answerCallbackQuery(env, queryId, { text: "Invalid category." });
    return true;
  }
  const offset = page * REMINDER_PAGE_SIZE;

  let rows;
  let total;
  if (category === "users") {
    [rows, total] = await Promise.all([
      listActiveReminderUsers(db, { offset, limit: REMINDER_PAGE_SIZE }),
      db.prepare("SELECT COUNT(*) AS c FROM users WHERE reminder_enabled = 1").first(),
    ]);
  } else {
    const table = category === "groups" ? "groups" : "channels";
    [rows, total] = await Promise.all([
      listActiveReminderChats(db, table, { offset, limit: REMINDER_PAGE_SIZE }),
      db.prepare(`SELECT COUNT(*) AS c FROM ${table} WHERE reminder_enabled = 1`).first(),
    ]);
  }
  const totalRows = Number(total?.c || 0);

  const header =
    category === "users" ? bold("👤 Active Reminder Users") :
    category === "groups" ? bold("👥 Active Reminder Groups") :
    bold("📢 Active Reminder Channels");

  const body = rows.length
    ? rows.map(category === "users" ? formatReminderUser : formatReminderChat).join("\n")
    : ADMIN_EMPTY_STATE_PREFIX;

  const hasPrev = page > 0;
  const hasNext = offset + rows.length < totalRows;

  await editMessageText(
    env,
    chatId,
    messageId,
    `${header}\n\n${body}\n\n${text(`Page ${page + 1} • ${totalRows} total`)}`,
    { reply_markup: adminReminderListKeyboard(category, page, hasPrev, hasNext) }
  );
  await answerCallbackQuery(env, queryId);
  return true;
}

async function exportRemindersPdf(env, db, chatId, queryId) {
  try {
    const counts = await getActiveReminderCounts(db);
    const [users, groups, channels] = await Promise.all([
      listActiveReminderUsers(db, { offset: 0, limit: 500 }),
      listActiveReminderChats(db, "groups", { offset: 0, limit: 500 }),
      listActiveReminderChats(db, "channels", { offset: 0, limit: 500 }),
    ]);

    const pdf = buildPdfDocument({
      title: "Active Reminders",
      subtitle: `Generated: ${utcTimestampLabel()} (UTC)`,
      blocks: [
        {
          type: "cards",
          items: [
            { label: "USERS ON", value: counts.users },
            { label: "GROUPS ON", value: counts.groups },
            { label: "CHANNELS ON", value: counts.channels },
          ],
        },
        { type: "heading", text: "USERS WITH REMINDER ON" },
        {
          type: "table",
          columns: [
            { label: "Name", width: 3 },
            { label: "ID", width: 2 },
          ],
          rows: users.map((u) => [
            u.first_name || u.username || "Unknown",
            String(u.telegram_id),
          ]),
        },
        { type: "heading", text: "GROUPS WITH REMINDER ON" },
        {
          type: "table",
          columns: [
            { label: "Title", width: 3 },
            { label: "ID", width: 2 },
          ],
          rows: groups.map((g) => [g.title || "Unnamed", String(g.id)]),
        },
        { type: "heading", text: "CHANNELS WITH REMINDER ON" },
        {
          type: "table",
          columns: [
            { label: "Title", width: 3 },
            { label: "ID", width: 2 },
          ],
          rows: channels.map((c) => [c.title || "Unnamed", String(c.id)]),
        },
      ],
    });
    await sendDocument(env, chatId, pdf, "hawkbucks-active-reminders.pdf", "Active reminders");
    await answerCallbackQuery(env, queryId);
  } catch (error) {
    console.error("ADMIN_REMINDERS_PDF_FAILED", { error: error.message });
    await answerCallbackQuery(env, queryId, { text: "PDF export failed.", show_alert: true });
  }
  return true;
}

// ---------- Callback router ----------

export async function handleAdminCallback(env, db, callbackQuery, ctx) {
  const message = callbackQuery?.message;
  const from = callbackQuery?.from;
  const data = callbackQuery?.data;

  if (!message || !from || !isAdminCallback(data)) return false;

  // Private chat only, and admin only — verified from the actual sender.
  if (message.chat?.type !== "private" || !isAdmin(env, from.id)) {
    await answerCallbackQuery(env, callbackQuery.id, { text: "Access denied." });
    return true;
  }

  const chatId = message.chat.id;
  const messageId = message.message_id;
  const queryId = callbackQuery.id;
  const parts = data.split(":"); // ["admin", ...]

  try {
    if (parts[1] === "root" && parts[2] === "back") {
      try {
        await deleteMessage(env, chatId, messageId);
      } catch (error) {
        console.error("ADMIN_PANEL_CLOSE_DELETE_FAILED", { chatId, error: error.message });
      }
      await sendMessage(env, chatId, ADMIN_PANEL_CLOSED_MESSAGE, {
        reply_markup: getMainKeyboard(true, true),
      });
      await answerCallbackQuery(env, queryId);
      return true;
    }

    if (parts[1] === "root") {
      await editMessageText(env, chatId, messageId, adminPanelText(), {
        reply_markup: adminPanelKeyboard(),
      });
      await answerCallbackQuery(env, queryId);
      return true;
    }

    if (parts[1] === "usage" && parts.length === 2) {
      return await showUsagePeriods(env, db, chatId, messageId, queryId);
    }

    if (parts[1] === "usage" && parts[2] === "pdf") {
      return await exportUsagePdf(env, db, chatId, parts[3], queryId);
    }

    if (parts[1] === "usage") {
      return await showUsageStats(env, db, chatId, messageId, parts[2], queryId);
    }

    if (parts[1] === "rem" && parts.length === 2) {
      const counts = await getActiveReminderCounts(db);
      await editMessageText(env, chatId, messageId, adminRemindersText(counts), {
        reply_markup: adminRemindersKeyboard(counts),
      });
      await answerCallbackQuery(env, queryId);
      return true;
    }

    if (parts[1] === "rem" && parts[2] === "pdf") {
      return await exportRemindersPdf(env, db, chatId, queryId);
    }

    if (parts[1] === "rem") {
      // admin:rem:<category>:p<page>
      const page = parsePage((parts[3] || "p0").replace(/^p/, ""));
      return await showReminderList(env, db, chatId, messageId, parts[2], page, queryId);
    }

    if (parts[1] === "bc") {
      return await handleBroadcastCallback(env, db, { chatId, messageId, queryId, parts, from, callbackQuery, ctx }, ctx);
    }

    // Unknown admin action: deny without leaking information.
    await answerCallbackQuery(env, queryId, { text: "Access denied." });
    return true;
  } catch (error) {
    console.error("ADMIN_CALLBACK_FAILED", { action: parts.slice(1, 3).join(":"), error: error.message });
    try {
      await answerCallbackQuery(env, queryId, { text: "Something went wrong." });
    } catch {
      // ignore secondary failures
    }
    return true;
  }
}

// ---------- Entry points ----------

/** Handles the reply-keyboard "👑 Admin" button (private chat, admin only). */
export async function handleAdminButton(env, db, message) {
  const chat = message.chat;
  if (!chat || chat.type !== "private") return false;
  if (!isAdmin(env, message.from?.id)) {
    // Deny without revealing whether an administrator exists.
    await sendMessage(env, chat.id, ADMIN_ACCESS_DENIED_MESSAGE);
    return true;
  }
  await openAdminPanel(env, db, message);
  return true;
}

async function openAdminPanel(env, db, message) {
  await sendMessage(env, message.chat.id, adminPanelText(), {
    reply_markup: adminPanelKeyboard(),
  });
}

/**
 * Called from the command pipeline for private text messages. Returns true
 * when the message was consumed by an admin broadcast flow.
 */
export async function handleAdminTextInput(env, db, message) {
  const chat = message.chat;
  if (!chat || chat.type !== "private") return false;
  if (!isAdmin(env, message.from?.id)) return false;
  if (!message.text || message.text.startsWith("/")) return false;
  return handleBroadcastTextInput(env, db, message);
}



