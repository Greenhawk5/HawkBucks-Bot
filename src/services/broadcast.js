// Broadcast delivery with per-recipient error handling, gentle pacing and a
// metadata-only audit trail. Runs inside ctx.waitUntil so the Telegram
// webhook responds immediately; delivery is sequential with a small delay to
// respect Telegram rate limits (no tight loop).

import { sendMessage } from "../telegram/api.js";
import { recordBroadcast } from "../../database/broadcasts.js";

const SEND_DELAY_MS = 150; // ~6-7 messages/second, well under Telegram limits
const RATE_LIMIT_BACKOFF_MS = 3000;
const SUMMARY_PARSE_MODE = null; // plain text: content is never bot markup

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function deliverOnce(env, chatId, messageText) {
  try {
    await sendMessage(env, chatId, messageText, { parse_mode: SUMMARY_PARSE_MODE });
    return true;
  } catch (error) {
    // Telegram 429 responses surface as thrown errors; retry once after a
    // backoff before counting the recipient as failed.
    if (/429|too many/i.test(error.message)) {
      await delay(RATE_LIMIT_BACKOFF_MS);
      await sendMessage(env, chatId, messageText, { parse_mode: SUMMARY_PARSE_MODE });
      return true;
    }
    throw error;
  }
}

export async function runBroadcast(env, db, { adminId, recipients, messageText }) {
  const broadcastId = crypto.randomUUID();
  let successCount = 0;
  let failedCount = 0;

  for (const chatId of recipients) {
    try {
      await deliverOnce(env, chatId, messageText);
      successCount += 1;
    } catch (error) {
      failedCount += 1;
      // Safe diagnostics only: no message content, no chat-specific secrets.
      console.error("BROADCAST_DELIVERY_FAILED", {
        broadcastId,
        error: error.message.slice(0, 120),
      });
    }
    await delay(SEND_DELAY_MS);
  }

  try {
    await recordBroadcast(db, {
      id: broadcastId,
      adminId,
      recipientCount: recipients.length,
      successCount,
      failedCount,
    });
  } catch (error) {
    console.error("BROADCAST_HISTORY_FAILED", { broadcastId, error: error.message });
  }

  console.log("BROADCAST_COMPLETED", { broadcastId, recipientCount: recipients.length, successCount, failedCount });

  // Summary back to the administrator (plain text).
  try {
    await sendMessage(
      env,
      adminId,
      [
        "📨 Broadcast Complete",
        "",
        `✅ Sent: ${successCount}`,
        `❌ Failed: ${failedCount}`,
        `📊 Total: ${recipients.length}`,
      ].join("\n"),
      { parse_mode: SUMMARY_PARSE_MODE }
    );
  } catch (error) {
    console.error("BROADCAST_SUMMARY_FAILED", { broadcastId, error: error.message });
  }

  return { broadcastId, successCount, failedCount, total: recipients.length };
}
