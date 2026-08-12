import { parseHTML } from "linkedom";
import { downloadPage } from "./download.js";
import { createMission } from "./models.js";

const URL = "https://fortnitedb.com/v2/en";

const ZONE_MAPPING = {
    "S": "Stonewood",
    "P": "Plankerton",
    "C": "Canny Valley",
    "T": "Twine Peaks"
};

export async function fetchFortniteDBMissions() {

    const html = await downloadPage(URL);

    const { document } = parseHTML(html);

    const headers = document.querySelectorAll("h5.new_block_header");
    const vbucksMissionsBlock = 
        Array.from(headers)
            .find(header => header.textContent?.includes("V-Bucks Missions"));

    if (!vbucksMissionsBlock) {
        return [];
    }

    const missions = [];

    const block = vbucksMissionsBlock.closest(".new_block_block");

    const content = block?.querySelector(".new_block_content");

    const tableRows =
        content?.querySelectorAll("table.summary-honorable tr") ?? [];

    for (const row of tableRows) {

        const zoneBadge = row.querySelector("span.badge");

        if (!zoneBadge) {
            continue;
        }

        const zoneLetter =
            zoneBadge.textContent.trim();

        const zone =
            ZONE_MAPPING[zoneLetter] ?? "";

        const tds = row.querySelectorAll("td");
        if (tds.length < 4) continue;

        const powerLevelText = tds[2]?.textContent?.trim();
        const rewardText = tds[3]?.textContent?.trim();

        const powerLevelMatch = powerLevelText?.match(/\d+/);
        const powerLevel = powerLevelMatch ? Number(powerLevelMatch[0]) : 0;

        const rewardMatch = rewardText?.match(/(\d+)/);
        const rewardAmount = rewardMatch ? Number(rewardMatch[1]) : 0;

        const missionImage =
            row.querySelector("td:nth-child(2) img");

        const alt = missionImage?.alt?.trim();

        const missionType =
            alt === "V-Bucks"
                ? ""
                : (alt ?? "");

        missions.push(

            createMission({

                zone,

                powerLevel,

                rewardAmount,

                missionType,

                missionCategory: "",

                source: "fortnitedb"

            })

        );

    }

    return missions;

}