import { fetchFortniteDBMissions } from "./fortnitedb.js";
import { fetchFreeTheVBucksMissions } from "./freethevbucks.js";
import { fetchSTWPlannerMissions } from "./stwplanner.js";
import { mergeMissions } from "./merge.js";
import { validateMissions } from "./validate.js";
import { MISSION_SOURCE_MODE, MISSION_SOURCE_MODES } from "../config/missionSources.js";
import { normalizeMissions } from "./normalizer.js";

export async function getTodayVbucksMissions(dependencies = {}) {
    const {
        fetchFortniteDB = fetchFortniteDBMissions,
        fetchFreeTheVBucks = fetchFreeTheVBucksMissions,
        fetchSTWPlanner = fetchSTWPlannerMissions,
    } = dependencies;

    console.log("MISSION_SOURCE_MODE:", MISSION_SOURCE_MODE);
    console.log("MISSION_FETCH_STARTED");

    if (MISSION_SOURCE_MODE === MISSION_SOURCE_MODES.STWPLANNER_ONLY) {
        console.log("DISABLED_SOURCE:", "FortniteDB");
        console.log("DISABLED_SOURCE:", "FreeTheVBucks");
        const raw = await fetchSTWPlanner();
        console.log("STWPLANNER_FETCH_COMPLETED", { count: raw.length });
        console.log("STWPLANNER_RAW_RESULT", raw.map(logMission));
        const normalized = normalizeMissions(raw);
        console.log("STWPLANNER_NORMALIZED_RESULT", normalized.map(logMission));
        const validated = validateMissions(normalized);
        console.log("FINAL_MISSIONS", validated.map(logMission));
        return validated;
    }

    const [
        fortniteDB,
        freeTheVBucks,
        stwPlanner,
    ] = await Promise.all([
        fetchFortniteDB(),
        fetchFreeTheVBucks(),
        fetchSTWPlanner(),
    ]);

    console.log(`📊 Missions fetched - Fortnite: ${fortniteDB.length}, FreeTheVBucks: ${freeTheVBucks.length}, STWPlanner: ${stwPlanner.length}`);

    const merged = mergeMissions([
        ...fortniteDB,
        ...freeTheVBucks,
        ...stwPlanner
    ]);

    console.log(`🎯 After merge: ${merged.length} unique missions`);

    const validated = validateMissions(merged);

    console.log(`✓ After validation: ${validated.length} valid missions`);

    return validated;
}

function logMission(mission) {
    return { zone: mission.zone, powerLevel: mission.powerLevel, type: mission.mission?.type, category: mission.mission?.category, reward: mission.reward?.amount };
}
