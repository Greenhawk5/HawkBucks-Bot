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

// ---------- Admin Panel ----------

export function adminPanelText() {
  return [
    bold("👑 Admin Panel"),
    "",
    text("Select a section:")
  ].join("\n");
}

export function adminPanelKeyboard() {
  return {
    inline_keyboard: [
      [{ text: "📊 Usage Statistics", callback_data: "admin:usage" }],
      [{ text: "🔔 Active Reminders", callback_data: "admin:rem" }],
      [{ text: "📨 Broadcast Message", callback_data: "admin:bc" }],
      [{ text: "🔙 Back", callback_data: "admin:root:back" }],
    ],
  };
}

export const ADMIN_ACCESS_DENIED_MESSAGE = [
  bold("⚠️ Access denied."),
  "",
  text("This action is restricted.")
].join("\n");

export const ADMIN_PANEL_CLOSED_MESSAGE = text("👑 Admin panel closed.");

export function adminUsagePeriodsKeyboard() {
  return {
    inline_keyboard: [
      [{ text: "📅 Today", callback_data: "admin:usage:day" }, { text: "🗓 Current Week", callback_data: "admin:usage:week" }],
      [{ text: "📆 Current Month", callback_data: "admin:usage:month" }],
      [{ text: "📈 Last 6 Months", callback_data: "admin:usage:6months" }, { text: "🗓 Last 12 Months", callback_data: "admin:usage:year" }],
      [{ text: "🔙 Back", callback_data: "admin:root" }],
    ],
  };
}

export function adminUsagePeriodText(period, stats) {
  const labels = {
    day: "Today",
    week: "Current Week",
    month: "Current Month",
    "6months": "Last 6 Months",
    year: "Last 12 Months",
  };
  return [
    bold(`📊 Usage Statistics — ${labels[period] || period}`),
    "",
    `${text("👤 Users:")} ${text(stats.users)}`,
    `${text("👥 Groups:")} ${text(stats.groups)}`,
    `${text("📢 Channels:")} ${text(stats.channels)}`,
    "",
    `${text("📈 Total:")} ${text(stats.total)}`,
    "",
    text("📎 Export PDF available below."),
  ].join("\n");
}

export function adminUsageStatsKeyboard(period) {
  return {
    inline_keyboard: [
      [{ text: "📎 Export PDF", callback_data: `admin:usage:pdf:${period}` }],
      [{ text: "🔙 Back", callback_data: "admin:usage" }],
    ],
  };
}

export function adminRemindersKeyboard(counts) {
  return {
    inline_keyboard: [
      [{ text: `👤 Users (${counts.users})`, callback_data: "admin:rem:users:p0" }],
      [{ text: `👥 Groups (${counts.groups})`, callback_data: "admin:rem:groups:p0" }],
      [{ text: `📢 Channels (${counts.channels})`, callback_data: "admin:rem:channels:p0" }],
      [{ text: "📎 Export PDF", callback_data: "admin:rem:pdf" }],
      [{ text: "🔙 Back", callback_data: "admin:root" }],
    ],
  };
}

export function adminRemindersText(counts) {
  return [
    bold("🔔 Active Reminders"),
    "",
    `${text("👤 Users:")} ${text(counts.users)}`,
    `${text("👥 Groups:")} ${text(counts.groups)}`,
    `${text("📢 Channels:")} ${text(counts.channels)}`,
    "",
    text("Select a category to view recipients."),
  ].join("\n");
}

export function adminReminderListKeyboard(category, page, hasPrev, hasNext) {
  const nav = [];
  if (hasPrev) nav.push({ text: "⬅️ Previous", callback_data: `admin:rem:${category}:p${page - 1}` });
  if (hasNext) nav.push({ text: "➡️ Next", callback_data: `admin:rem:${category}:p${page + 1}` });
  return {
    inline_keyboard: [
      ...(nav.length ? [nav] : []),
      [{ text: "🔙 Back", callback_data: "admin:rem" }],
    ],
  };
}

export const ADMIN_EMPTY_STATE_PREFIX = text("No active reminders in this category.");

export const ADMIN_PDF_FAILED_MESSAGE = text("⚠️ PDF export failed. Please try again later.");

export const ADMIN_BROADCAST_STARTED_MESSAGE = [
  bold("📨 Broadcast started."),
  "",
  text("You will receive a summary when it completes.")
].join("\n");


export const PANEL_PERMISSION_MESSAGE = text("You don't have permission to use this panel.");
// Callback alerts are not parsed with MarkdownV2, so keep these values plain.
export const PANEL_FOREIGN_MESSAGE = "This panel belongs to another user.";
export const PANEL_EXPIRED_MESSAGE = "This panel has expired. Send /panel to open a new one.";
export const PANEL_CLOSED_MESSAGE = "Panel closed.";
