import { sendPhoto } from "../telegram/api.js";
import { getMissionImage, releaseMissionImageReservation, reserveMissionImage, storeMissionImage } from "../../database/mission-images.js";
import { formatMissionMessage } from "../telegram/formatter.js";
import { generateMissionImage } from "./mission-image.js";
import { groupAndSortMissions } from "../missions/organize.js";
import { getDailyMissions } from "./missions.js";
import { assets } from "../render/assets-loader.js";

const FORCE_NEW_MISSION_IMAGE = false;

function missionDate() {
  return new Date().toISOString().slice(0, 10);
}

function telegramFileId(message) {
  return message?.photo?.at(-1)?.file_id || null;
}

function decodeDataUri(dataUri) {
  const encoded = dataUri.split(",", 2)[1];
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function photoOptions(options) {
  return {
    parse_mode: "MarkdownV2",
    ...(options.replyToMessageId ? { reply_to_message_id: options.replyToMessageId } : {}),
  };
}

function cachedReminder(cached) {
  const missions = groupAndSortMissions(JSON.parse(cached.missions_json));
  return {
    date: cached.date,
    missions,
    caption: formatMissionMessage(missions),
    telegramFileId: cached.telegram_file_id,
    image: null,
    ownsReservation: false,
  };
}

export async function prepareMissionReminder(env, db) {
  const date = missionDate();

  if (!FORCE_NEW_MISSION_IMAGE) {
    const cached = await getMissionImage(db, date);
    if (cached?.status === "ready") {
      return cachedReminder(cached);
    }
  }

  const reserved = FORCE_NEW_MISSION_IMAGE ? true : await reserveMissionImage(db, date);
  if (!reserved) {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const pending = await getMissionImage(db, date);
      if (pending?.status === "ready") {
        return cachedReminder(pending);
      }
    }
    throw new Error("Today's mission image is still being generated; please try again shortly.");
  }

  try {
    const { missions: rawMissions } = await getDailyMissions();
    const missions = groupAndSortMissions(rawMissions);
    const image = missions.length > 0
      ? await generateMissionImage(missions, env)
      : decodeDataUri(assets.noMission);
    return {
      date,
      missions,
      caption: formatMissionMessage(missions),
      telegramFileId: null,
      image,
      ownsReservation: !FORCE_NEW_MISSION_IMAGE,
    };
  } catch (error) {
    if (!FORCE_NEW_MISSION_IMAGE) await releaseMissionImageReservation(db, date);
    throw error;
  }
}

export async function releasePreparedMissionReminder(db, reminder) {
  if (reminder?.ownsReservation && !reminder.telegramFileId) {
    await releaseMissionImageReservation(db, reminder.date);
  }
}

export async function sendPreparedMissionReminder(chatId, env, db, reminder, options = {}) {
  const photo = reminder.telegramFileId || reminder.image;
  if (!photo) throw new Error("Mission reminder does not contain a photo to send");

  const sent = await sendPhoto(env, chatId, photo, reminder.caption, photoOptions(options));
  if (!reminder.telegramFileId) {
    const fileId = telegramFileId(sent);
    if (!fileId) throw new Error("Telegram did not return a reusable photo file_id");
    await storeMissionImage(db, {
      date: reminder.date,
      telegramFileId: fileId,
      missions: reminder.missions,
    });
    reminder.telegramFileId = fileId;
    reminder.image = null;
    reminder.ownsReservation = false;
  }
  return sent;
}

export async function sendMissionReminder(chatId, env, db, options = {}) {
  const reminder = options.preparedReminder || await prepareMissionReminder(env, db);
  try {
    return await sendPreparedMissionReminder(chatId, env, db, reminder, options);
  } catch (error) {
    if (!options.preparedReminder) await releasePreparedMissionReminder(db, reminder);
    throw error;
  }
}
