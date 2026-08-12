import { sendMessage, sendPhoto } from "./api.js";
import { toggleReminder } from "../../database/users.js";
import {
  getMissionImage,
  releaseMissionImageReservation,
  reserveMissionImage,
  storeMissionImage,
} from "../../database/mission-images.js";
import { getMainKeyboard } from "./keyboards.js";
import { getTodayVbucksMissions } from "../missions/service.js";
import { formatMissionMessage } from "./formatter.js";
import { generateMissionImage } from "../services/mission-image.js";
import { groupAndSortMissions } from "../missions/organize.js";
import { sendMissionReminder } from "../services/notification.js";
import {
  ADD_TO_GROUP_PROMPT,
  GENERIC_ERROR_MESSAGE,
  OWNER_PANEL_MESSAGE,
  REMINDER_DISABLED_MESSAGE,
  REMINDER_ENABLED_MESSAGE,
  SUPPORT_MESSAGE,
} from "./messages.js";

const FORCE_NEW_MISSION_IMAGE = false;
const FORCE_FAKE_MISSIONS = false;


function getMissionDate() {
  // Fortnite's daily reset and the existing formatter are both UTC based.
  return new Date().toISOString().slice(0, 10);
}



function getFakeMissions() {
  return [
    {
      zone: "Stonewood",
      powerLevel: 9,
      mission: {
        type: "Deliver the Bomb",
        category: "Industrial Park",
      },
      reward: { amount: 50 },
    },
    {
      zone: "Twine Peaks",
      powerLevel: 45,
      mission: {
        type: "Ride the Lightning",
        category: "City",
      },
      reward: { amount: 50 },
    },
    {
      zone: "Plankerton",
      powerLevel: 33,
      mission: {
        type: "Ride the Lightning",
        category: "City",
      },
      reward: { amount: 50 },
    },
    {
      zone: "Canny Valley",
      powerLevel: 12,
      mission: {
        type: "Category 3 Fight The Storm",
        category: "Suburbs",
      },
      reward: { amount: 50 },
    },
    {
      zone: "Twine Peaks",
      powerLevel: 140,
      mission: {
        type: "Category 4 Fight The Storm",
        category: "Suburbs",
      },
      reward: { amount: 50 },
    },
  ];
}

async function getMissionsForImage() {
  if (FORCE_FAKE_MISSIONS) {
    console.log("🧪 FORCE FAKE MISSIONS MODE ENABLED");
    return getFakeMissions();
  }

  console.log("🌐 REAL MISSION FETCH MODE ENABLED");
  let missions = await getTodayVbucksMissions();
  // Do not inject fallback missions when no real missions are found.
  // Return the real missions array (may be empty) so callers can handle the "no missions" case.
  return missions;
}

function getTelegramFileId(message) {
  const sizes = message.photo || [];
  return sizes.at(-1)?.file_id || null;
}

// Development switch: Set to true to always generate new mission images
// Set to false for production cache mode

export async function sendDailyMissionImage(env, db, chatId, options = {}) {
  const photoOptions = {
    parse_mode: "MarkdownV2",
    ...(options.replyToMessageId ? { reply_to_message_id: options.replyToMessageId } : {}),
  };
  const date = getMissionDate();
  console.log("🔧 FORCE NEW IMAGE MODE:", FORCE_NEW_MISSION_IMAGE);

  // ============ FORCE MODE: Bypass all cache logic ============
  if (FORCE_NEW_MISSION_IMAGE) {
    console.log("🚀 FORCE MODE: bypassing cache");
    console.log("📝 FORCE MODE: generating new screenshot");

    // Override any existing reservation - we want a fresh generation
    await releaseMissionImageReservation(db, date);

    // Reserve with fresh attempt (this will succeed since we just released)
    await reserveMissionImage(db, date);

    try {
      console.log("📥 FORCE MODE: fetching missions");
      const missions = groupAndSortMissions(await getMissionsForImage());

      console.log("🎨 FORCE MODE: generating new image", { missionCount: missions.length });
      const image = await generateMissionImage(missions, env);
      const sentMessage = await sendPhoto(env, chatId, image, formatMissionMessage(missions), photoOptions);
      console.log("📤 FORCE MODE: image sent", { source: "new" });

      const telegramFileId = getTelegramFileId(sentMessage);
      if (!telegramFileId) throw new Error("Telegram did not return a reusable photo file_id");

      console.log("💾 FORCE MODE: replacing cache");
      await storeMissionImage(db, { date, telegramFileId, missions });
      console.log("✅ FORCE MODE: cache replaced", { date });

    } catch (error) {
      console.error("❌ FORCE MODE: generation failed", { date, error: error.message });
      await releaseMissionImageReservation(db, date);
      throw error;
    }

    return;
  }

  // ============ PRODUCTION MODE: Use cache normally ============
  console.log("🔍 IMAGE CACHE CHECK", { date });
  try {
    const cachedImage = await getMissionImage(db, date);
    console.log("📊 CACHE RESULT", { date, found: !!cachedImage, status: cachedImage?.status });

    if (cachedImage?.status === "ready") {
      console.log("✅ CACHE HIT", { date });
      const missions = groupAndSortMissions(JSON.parse(cachedImage.missions_json));
      await sendPhoto(env, chatId, cachedImage.telegram_file_id, formatMissionMessage(missions), photoOptions);
      console.log("📤 IMAGE SENT", { source: "cache" });
      return;
    }
  } catch (error) {
    console.error("❌ CACHE CHECK FAILED", { date, error: error.message });
    throw new Error("Failed to check image cache: " + error.message);
  }

  // ============ PRODUCTION MODE: Cache miss - generate new image ============
  try {
    const reserved = await reserveMissionImage(db, date);
    console.log("🔒 RESERVATION ATTEMPT", { date, success: reserved });

    if (!reserved) {
      console.log("⏳ IMAGE GENERATION IN PROGRESS", { date });
      for (let attempt = 0; attempt < 20; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        const pendingImage = await getMissionImage(db, date);
        if (pendingImage?.status === "ready") {
          console.log("✅ RESERVATION WAIT SUCCESS", { date, attempt });
          const missions = groupAndSortMissions(JSON.parse(pendingImage.missions_json));
          await sendPhoto(env, chatId, pendingImage.telegram_file_id, formatMissionMessage(missions), photoOptions);
          console.log("📤 IMAGE SENT", { source: "cache-after-wait" });
          return;
        }
      }
      throw new Error("Today's mission image is still being generated; please try again shortly.");
    }
  } catch (error) {
    console.error("❌ RESERVATION FAILED", { date, error: error.message });
    throw new Error("Failed to reserve mission image: " + error.message);
  }

  try {
    console.log("❌ CACHE MISS", { date });
    console.log("📥 FETCHING MISSIONS");
    const missions = groupAndSortMissions(await getMissionsForImage());

    console.log("🎨 GENERATING NEW IMAGE", { missionCount: missions.length });
    const image = await generateMissionImage(missions, env);
    const sentMessage = await sendPhoto(env, chatId, image, formatMissionMessage(missions), photoOptions);
    console.log("📤 IMAGE SENT", { source: "new" });

    const telegramFileId = getTelegramFileId(sentMessage);
    if (!telegramFileId) throw new Error("Telegram did not return a reusable photo file_id");

    console.log("💾 STORING IMAGE CACHE", { date });
    await storeMissionImage(db, { date, telegramFileId, missions });
    console.log("✅ IMAGE STORED", { date });
  } catch (error) {
    console.error("💾 RELEASE RESERVATION DUE TO ERROR", { date });
    await releaseMissionImageReservation(db, date);
    console.error("❌ MISSION IMAGE GENERATION FAILED", { date, error: error.message, stack: error.stack });
    throw error;
  }
}

export async function handleButton(env, db, message) {
  const chatId = message.chat.id;

  switch (message.text) {
    case "💰 V-Bucks Missions":
      await sendMissionReminder(chatId, env, db);
      break;

    case "🔔 Daily Reminder":
    case "🔕 Daily Reminder":
    case "🟢 Daily Reminder":
    case "🔴 Daily Reminder": {
      const newStatus = await toggleReminder(db, message.from.id);
      const statusText = newStatus === 1 ? REMINDER_ENABLED_MESSAGE : REMINDER_DISABLED_MESSAGE;

      await sendMessage(env, chatId, statusText, {
        reply_markup: getMainKeyboard(false, newStatus === 1),
      });
      break;
    }

    case "➕ Add to Group":
      await sendMessage(env, chatId, ADD_TO_GROUP_PROMPT, {
        reply_markup: {
          inline_keyboard: [[{
            text: "➕ Add me to a group",
            url: `https://t.me/${env.TELEGRAM_BOT_USERNAME || "HawkBucks_bot"}?startgroup=true`,
          }]],
        },
      });
      break;

    case "💚 Support":
    case "💙 Support":
      await sendMessage(env, chatId, SUPPORT_MESSAGE);
      break;

    case "👑 Owner Panel":
      await sendMessage(env, chatId, OWNER_PANEL_MESSAGE);
      break;

    default:
      return false;
  }

  return true;
}
