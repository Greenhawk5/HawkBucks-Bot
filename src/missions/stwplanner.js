import { parseHTML } from "linkedom";
import { downloadPage } from "./download.js";
import { createMission } from "./models.js";

const URL = "https://stw-planner.com";

export async function fetchSTWPlannerMissions() {

    const html = await downloadPage(URL);

    const missions = parseSTWPlanner(html);
    console.log("STWPLANNER_RAW_RESULT", missions.map(logMission));
    return missions;

}

export function parseSTWPlanner(html) {

    const { document } = parseHTML(html);

    const missions = [];

    const blocks = document.querySelectorAll(".special-reward-entry");

    for (const block of blocks) {

        if (!(block.textContent ?? "").toLowerCase().includes("vbucks")) continue;
        const entries = block.querySelectorAll(".mission-entry");
        for (const entry of entries) {
        const rewardText = entry.textContent ?? "";
        const zoneElement = entry.querySelector(".mission-zone");
        const powerLevelText = entry.querySelector(".mission-pl")?.textContent?.trim();
        const zoneHTML = zoneElement?.innerHTML;

        const rewardMatch = rewardText.match(/(\d+)/);

        const powerLevelMatch =
            powerLevelText?.match(/\d+/);

        const rewardAmount =
            rewardMatch
                ? Number(rewardMatch[1])
                : 0;

        const powerLevel =
            powerLevelMatch
                ? Number(powerLevelMatch[0])
                : 0;

        let zone = "";
        let missionType = "";
        let missionCategory = "";

        if (zoneHTML) {

            const lines =
                zoneHTML
                    .split(/<br\s*\/?>/i)
                    .map(line => line.trim())
                    .filter(line => line.length > 0);

            if (lines.length >= 1) {

                zone = lines[0]
                    .replace(/<[^>]*>/g, "")
                    .trim();

            }

            if (lines.length >= 2) {

                const missionDetails =
                    lines[1]
                        .replace(/<[^>]*>/g, "")
                        .trim();

                const parts =
                    missionDetails
                        .split(" - ")
                        .map(p => p.trim());

                missionType = parts[0] ?? "";

                missionCategory = parts[1] ?? "";

            }

        }

        missions.push(

            createMission({

                zone,

                powerLevel,

                rewardAmount,

                missionType,

                missionCategory,

                source: "stwplanner"

            })

        );
        }

    }

    return missions;

}

function logMission(mission) {
    return { zone: mission.zone, powerLevel: mission.powerLevel, type: mission.mission?.type, category: mission.mission?.category, reward: mission.reward?.amount };
}
