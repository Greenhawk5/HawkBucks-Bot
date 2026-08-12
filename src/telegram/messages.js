// Centralized HawkBucks Telegram messages.

export function escapeMarkdownV2(value) {
  return String(value ?? "").replace(/[\\_*[\]()~`>#+\-=|{}.!]/g, "\\$&");
}

const text = (value) => escapeMarkdownV2(value);
const bold = (value) => `*${text(value)}*`;
const code = (value) => `\`${String(value ?? "").replace(/[\\`]/g, "\\$&")}\``;

export const START_MESSAGE = [
  bold("👋 Welcome to HawkBucks 🚀"),
  "",
  text("Your Fortnite V-Bucks companion is ready."),
  "",
  text("Get daily Fortnite mission updates, V-Bucks alerts and useful tools in one place."),
  "",
  text("🤖 Use the buttons below to explore HawkBucks features.")
].join("\n");

export const WELCOME_MESSAGE = START_MESSAGE;

export const RESTART_MESSAGE = [
  bold("🔄 HawkBucks restarted successfully."),
  "",
  text("✅ All systems are operational."),
  "",
  text("Use the buttons below or type /help to continue.")
].join("\n");

export const PRIVATE_HELP_MESSAGE = [
  bold("📖 HawkBucks Help Menu"),
  "",
  bold("💰 V-Bucks Missions"),
  text("Check today's Fortnite V-Bucks missions instantly."),
  "",
  bold("🔔 Daily Reminder"),
  text("Enable personal daily mission notifications."),
  "",
  bold("👥 Add to Group"),
  text("Add HawkBucks to your Telegram groups."),
  "",
  bold("💚 Support"),
  text("Support the development of HawkBucks."),
  "",
  text("🤖 Use the buttons below anytime!"),
  "",
  text("@HawkBucks_bot")
].join("\n");

export const GROUP_HELP_MESSAGE = [
  bold("📖 HawkBucks Group Help Menu"),
  "",
  bold("✅ /vbuck"),
  text("Check today's V-Bucks missions."),
  "",
  bold("✅ /daily"),
  text("Toggle daily group reminders (admins only)."),
  "",
  text("💚 Support the project directly from the bot."),
  "",
  text("🤖 Keep your group updated with HawkBucks!"),
  "",
  text("@HawkBucks_bot")
].join("\n");

export const SUPPORT_MESSAGE = [
  bold("🙃💚 Support this project"),
  "",
  text("Your support helps maintain HawkBucks hosting, development, and future improvements."),
  "",
  bold("💳 USDT\-TRC20:"),
  code("TGrXY3Qz5bcSkgraamiezdgTaLU9eQQE17"),
  "",
  bold("💳 TON:"),
  code("UQDv4XVHzgGvmzWMXydiDG-C-m2kMjdB7INoBlLGJ-S71XY5"),
  "",
  text("🙏 Thank you for supporting HawkBucks!")
].join("\n");

export function supportMessage() {
  return SUPPORT_MESSAGE;
}

export function VBUCK_TITLE(total) {
  return `${bold("🟢 Today's V-Buck missions")} (${escapeMarkdownV2(total)})\n`;
}

export const NO_MISSIONS_MESSAGE = [
  `${text("🔴")} ${bold("NO")} ${text("V-Bucks missions are available today.")}`,
  "",
  text("@HawkBucks_bot")
].join("\n");

export const LOG_MESSAGE_HEADER = [
  bold("🗒 HawkBucks Update Log"),
  "",
  text("Latest bot changes and updates:"),
  ""
].join("\n");

export const ADD_TO_GROUP_MESSAGE = [
  bold("👥 Add HawkBucks to your group"),
  "",
  text("Invite HawkBucks to your Telegram group and receive Fortnite mission updates automatically."),
  "",
  text("🚀 Keep your community updated!")
].join("\n");

export const ADD_TO_GROUP_PROMPT = [
  bold("➕ Add HawkBucks to a group"),
  "",
  text("Tap the button below to choose a Telegram group where you have permission to add bots.")
].join("\n");

export const GROUP_WELCOME_MESSAGE = [
  bold("👋 Hello everyone!"),
  "",
  text("Thanks for adding HawkBucks Bot to this group."),
  "",
  text("I can help your community with Fortnite updates:"),
  "",
  `${bold("🤑 /vbuck")}\n${text("Check today's V-Buck missions.")}`,
  "",
  `${bold("📖 /help")}\n${text("Show available group commands.")}`,
  "",
  `${bold("⚙️ /daily")}\n${text("Manage daily reminders (admins only).")}`,
  "",
  text("Enjoy automatic Fortnite updates!"),
  "",
  text("@HawkBucks_bot")
].join("\n");

export const GROUP_DAILY_ADMIN_ONLY_MESSAGE = text("⚙️ Only group administrators can manage daily reminders.");
export function GROUP_PANEL_MESSAGE(enabled) {
  return [
    bold("⚙️ Group Daily Reminder Settings"),
    "",
    text(`Status: ${enabled ? "🟢 Enabled" : "🔴 Disabled"}`),
  ].join("\n");
}

export const REMINDER_ENABLED_MESSAGE = [
  bold("🔔 Daily reminders enabled."),
  "",
  text("You will receive HawkBucks updates every day.")
].join("\n");

export const REMINDER_DISABLED_MESSAGE = [
  bold("🔕 Daily reminders disabled."),
  "",
  text("You can enable them again anytime.")
].join("\n");

export const UNKNOWN_COMMAND_MESSAGE = [
  bold("⚙️ Unknown command."),
  "",
  text("Use /help to see available commands.")
].join("\n");

export const GENERIC_ERROR_MESSAGE = [
  bold("⚠️ Something went wrong."),
  "",
  text("Please try again later.")
].join("\n");

export const OWNER_PANEL_MESSAGE = [
  bold("👑 HawkBucks Owner Panel"),
  "",
  text("Manage bot settings and monitoring tools.")
].join("\n");

export const ADMIN_PANEL_MESSAGE = [
  bold("🛠 HawkBucks Admin Panel"),
  "",
  text("Manage group settings and bot features.")
].join("\n");

export const PANEL_PERMISSION_MESSAGE = text("You don't have permission to use this panel.");
// Callback alerts are not parsed with MarkdownV2, so keep these values plain.
export const PANEL_FOREIGN_MESSAGE = "This panel belongs to another user.";
export const PANEL_EXPIRED_MESSAGE = "This panel has expired. Send /panel to open a new one.";
export const PANEL_CLOSED_MESSAGE = "Panel closed.";
