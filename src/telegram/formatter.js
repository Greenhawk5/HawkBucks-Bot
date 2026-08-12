import { escapeMarkdownV2, NO_MISSIONS_MESSAGE } from "./messages.js";

function getTimeUntilReset() {

    const now = new Date();

    const reset = new Date(now);

    reset.setUTCHours(24, 0, 0, 0);

    const diff = reset - now;

    const hours = Math.floor(diff / 3600000);

    const minutes = Math.floor((diff % 3600000) / 60000);

    const seconds = Math.floor((diff % 60000) / 1000);

    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

}

export function formatMissionMessage(missions) {

    if (missions.length === 0) {
        return NO_MISSIONS_MESSAGE;
    }

    const totalVbucks =
        missions.reduce(
            (sum, mission) => sum + mission.reward.amount,
            0
        );

    let message = `🟢 *Today's V\\-Buck missions* \\(${escapeMarkdownV2(totalVbucks)}\\)\n\n`;

    for (const mission of missions) {

        message += `🔹 *${escapeMarkdownV2(mission.zone)}* — ${escapeMarkdownV2(mission.reward.amount)} V\\-Bucks\n`;
        message += `➖ ${escapeMarkdownV2(mission.mission.type)} ${escapeMarkdownV2(mission.powerLevel)}⚡\n`;

        if (mission.mission.category) {

            message += `📍 ${escapeMarkdownV2(mission.mission.category)}\n`;

        }

        message += "\n";

    }

    message +=
`⌛ *Next mission reset*\n${escapeMarkdownV2(getTimeUntilReset())}\n\n@HawkBucks\\_bot`;

    return message;

}
