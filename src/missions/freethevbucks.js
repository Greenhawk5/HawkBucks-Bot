import { parseHTML } from "linkedom";
import { downloadPage } from "./download.js";
import { createMission } from "./models.js";

const URL = "https://freethevbucks.com/timed-missions/";

export async function fetchFreeTheVBucksMissions() {

    const html = await downloadPage(URL);

    const { document } = parseHTML(html);

    const missionBlocks = [
        ...document.querySelectorAll(".hot-info .news-link")
    ].slice(1);

    const missions = [];

    for (const block of missionBlocks) {

        const jrfont = block.querySelector(".jrfont");

        if (!jrfont) continue;

        const spans = jrfont.querySelectorAll("span");

        if (spans.length < 3) continue;

        // Reward
        const rewardMatch = jrfont.textContent.match(/^\s*(\d+)/);

        if (!rewardMatch) continue;

        const rewardAmount = Number(rewardMatch[1]);

        // Power Level
        const powerLevel = Number(
            spans[0].textContent.trim()
        );

        // Mission Type
        const missionType = spans[1].textContent.trim();

        // Zone
        const zone = spans[2]
            .textContent
            .trim()
            .replace(/^in\s+/i, "");

        missions.push(
            createMission({
                zone,
                powerLevel,
                rewardAmount,
                missionType,
                missionCategory: "",
                source: "freethevbucks"
            })
        );

    }

    return missions;

}