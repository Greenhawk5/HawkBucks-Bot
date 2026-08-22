const VALID_ZONES = new Set([
    "Stonewood",
    "Plankerton",
    "Canny Valley",
    "Twine Peaks"
]);

import { isPlaceholderMissionType, missionTypeKey, normalizeZone } from "./normalizer.js";

export function validateMissions(missions) {
    console.log("VALIDATION_INPUT", missions.map(logMission));
    console.log("✓ validateMissions: Starting validation on", missions.length, "missions");

    const seen = new Set();
    const filtered = missions.filter(mission => {

        if (!VALID_ZONES.has(mission.zone)) {
            return false;
        }

        if (!Number.isInteger(mission.powerLevel)) {
            return false;
        }

        if (mission.powerLevel <= 0) {
            return false;
        }

        if (!Number.isInteger(mission.reward.amount)) {
            return false;
        }

        if (mission.reward.amount <= 0) {
            return false;
        }

        if (isPlaceholderMissionType(mission.mission?.type)) {
            console.log("MISSION_REJECTED", { reason: "unknown-mission-type", mission });
            return false;
        }

        const duplicateKey = [
            normalizeZone(mission.zone).toLowerCase(),
            mission.powerLevel,
            mission.reward.amount,
            missionTypeKey(mission.mission?.type),
        ].join("|");
        if (seen.has(duplicateKey)) {
            console.log("MISSION_REJECTED", { reason: "duplicate-final-mission", duplicateKey });
            return false;
        }
        seen.add(duplicateKey);

        return true;

    });

    console.log("✓ validateMissions: After validation:", filtered.length, "missions remain");
    console.log("VALIDATION_OUTPUT", filtered.map(logMission));
    return filtered;
}

function logMission(mission) {
    return { zone: mission.zone, powerLevel: mission.powerLevel, type: mission.mission?.type, category: mission.mission?.category, reward: mission.reward?.amount };
}
