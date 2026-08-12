import { answerCallbackQuery, deleteMessage, editMessageText, getChatMember, sendMessage } from "./api.js";
import { createPanelSession, deleteChannel, deleteGroup, deletePanelSession, disableGroupReminder, enableGroupReminder, getPanelSession, getPanelSessionForCleanup, getReminderStatus, refreshPanelSession, upsertChannel, upsertGroup } from "../../database/groups.js";
import {
  GROUP_WELCOME_MESSAGE,
  GROUP_PANEL_MESSAGE,
  PANEL_CLOSED_MESSAGE,
  PANEL_EXPIRED_MESSAGE,
  PANEL_FOREIGN_MESSAGE,
} from "./messages.js";

export const BOT_OWNER_ID = ["6726776142", "184202422"];

export function groupPanelKeyboard(enabled) {
  return {
    inline_keyboard: [[{
      text: enabled ? "🟢 Daily Reminder" : "🔴 Daily Reminder",
      callback_data: "group_panel:toggle",
    }], [{
      text: "❌ Close",
      callback_data: "group_panel:close",
    }]],
  };
}

export async function isGroupAdmin(env, chatId, userId) {
  const member = await getChatMember(env, chatId, userId);
  return member.status === "creator" || member.status === "administrator";
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function closePanelAfterInactivity(env, db, chatId, messageId, triggerMessageId) {
  const session = await getPanelSessionForCleanup(db, messageId);
  if (!session) return;

  const remaining = Math.max(0, (Number(session.expires_at) * 1000) - Date.now());
  if (remaining > 0) await wait(remaining);

  const current = await getPanelSessionForCleanup(db, messageId);
  if (!current) return;
  if (Number(current.expires_at) * 1000 > Date.now()) {
    return closePanelAfterInactivity(env, db, chatId, messageId, triggerMessageId);
  }

  await deletePanelSession(db, messageId);
  try {
    await deleteMessage(env, chatId, messageId);
  } catch (error) {
    console.error("GROUP PANEL AUTO-CLOSE FAILED", { chatId, messageId, error: error.message });
  }
  if (triggerMessageId) {
    try {
      await deleteMessage(env, chatId, triggerMessageId);
    } catch (error) {
      console.error("GROUP PANEL TRIGGER AUTO-DELETE FAILED", {
        chatId,
        messageId: triggerMessageId,
        error: error.message,
      });
    }
  }
}

function schedulePanelAutoClose(env, db, chatId, messageId, ctx, triggerMessageId) {
  const cleanup = closePanelAfterInactivity(env, db, chatId, messageId, triggerMessageId)
    .catch((error) => console.error("GROUP PANEL AUTO-CLOSE ERROR", { chatId, messageId, error: error.message }));
  if (ctx?.waitUntil) ctx.waitUntil(cleanup);
}

export async function handleMyChatMember(env, update) {
  const change = update?.my_chat_member;
  const chat = change?.chat;
  const status = change?.new_chat_member?.status;

  if (!chat || !["group", "supergroup", "channel"].includes(chat.type)) return false;

  if (["member", "administrator"].includes(status)) {
    console.log("GROUP BOT ADDED", {
      chatId: chat.id,
      title: chat.title,
      username: chat.username || null,
      status,
    });
    const db = env.hawkbucks_db;
    if (chat.type === "channel") {
      await upsertChannel(db, chat);
    } else {
      await upsertGroup(db, chat);
    }
    const previousStatus = change.old_chat_member?.status;
    if (!["member", "administrator"].includes(previousStatus) && chat.type !== "channel") {
      await sendMessage(env, chat.id, GROUP_WELCOME_MESSAGE);
    }
    return true;
  }

  if (["left", "kicked"].includes(status)) {
    console.log("GROUP BOT REMOVED", { chatId: chat.id, title: chat.title, status });
    if (chat.type === "channel") {
      await deleteChannel(env.hawkbucks_db, chat.id);
      console.log("CHANNEL_REMOVED_FROM_DATABASE", { chatId: chat.id, status });
    } else {
      await deleteGroup(env.hawkbucks_db, chat.id);
      console.log("GROUP_REMOVED_FROM_DATABASE", { chatId: chat.id, status });
    }
    return true;
  }

  return false;
}

export async function handlePanelCommand(env, db, message, ctx) {
  const chat = message.chat;
  if (!chat || !["group", "supergroup"].includes(chat.type)) return false;
  const isOwner = BOT_OWNER_ID.includes(String(message.from?.id));
  const isAdmin = isOwner || await isGroupAdmin(env, chat.id, message.from.id);
  if (!isAdmin) return { handled: true, denied: true };

  const enabled = (await getReminderStatus(db, chat.id)) !== false;
  const sent = await sendMessage(env, chat.id, GROUP_PANEL_MESSAGE(enabled), {
    reply_markup: groupPanelKeyboard(enabled),
    reply_to_message_id: message.message_id,
  });
  await createPanelSession(db, {
    messageId: sent.message_id,
    chatId: chat.id,
    openedBy: message.from.id,
    expiresAt: Math.floor(Date.now() / 1000) + 30,
  });
  let triggerDeleted = false;
  try {
    await deleteMessage(env, chat.id, message.message_id);
    triggerDeleted = true;
  } catch (error) {
    console.error("GROUP PANEL TRIGGER DELETE FAILED", {
      chatId: chat.id,
      messageId: message.message_id,
      error: error.message,
    });
  }
  schedulePanelAutoClose(env, db, chat.id, sent.message_id, ctx, triggerDeleted ? null : message.message_id);
  return { handled: true, denied: false };
}

export async function handlePanelCallback(env, db, callbackQuery, ctx) {
  const message = callbackQuery?.message;
  const from = callbackQuery?.from;
  const data = callbackQuery?.data;
  if (!message || !from || !data?.startsWith("group_panel:")) return false;

  const session = await getPanelSession(db, message.message_id);
  if (!session) {
    await answerCallbackQuery(env, callbackQuery.id, { text: PANEL_EXPIRED_MESSAGE, show_alert: true });
    return true;
  }
  if (String(session.opened_by) !== String(from.id)) {
    await answerCallbackQuery(env, callbackQuery.id, { text: PANEL_FOREIGN_MESSAGE, show_alert: true });
    return true;
  }

  if (data === "group_panel:close") {
    await deletePanelSession(db, message.message_id);
    try {
      await deleteMessage(env, message.chat.id, message.message_id);
    } catch (error) {
      console.error("GROUP PANEL CLOSE DELETE FAILED", {
        chatId: message.chat.id,
        messageId: message.message_id,
        error: error.message,
      });
    }
    await answerCallbackQuery(env, callbackQuery.id, { text: PANEL_CLOSED_MESSAGE });
    return true;
  }

  if (data === "group_panel:toggle") {
    const enabled = (await getReminderStatus(db, message.chat.id)) !== false;
    if (enabled) await disableGroupReminder(db, message.chat.id);
    else await enableGroupReminder(db, message.chat.id);
    const updated = !enabled;
    await refreshPanelSession(db, message.message_id, Math.floor(Date.now() / 1000) + 30);
    await editMessageText(
      env,
      message.chat.id,
      message.message_id,
      GROUP_PANEL_MESSAGE(updated),
      { reply_markup: groupPanelKeyboard(updated) }
    );
    schedulePanelAutoClose(env, db, message.chat.id, message.message_id, ctx);
    await answerCallbackQuery(env, callbackQuery.id);
    return true;
  }

  return false;
}
