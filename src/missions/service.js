import { fetchFortniteDBMissions } from "./fortnitedb.js";
import { fetchFreeTheVBucksMissions } from "./freethevbucks.js";
import { fetchSTWPlannerMissions } from "./stwplanner.js";
import { mergeMissions } from "./merge.js";
import { validateMissions } from "./validate.js";

export async function getTodayVbucksMissions() {
    console.log("🔍 getTodayVbucksMissions: Fetching missions from all sources");

    const [
        fortniteDB,
        freeTheVBucks,
        stwPlanner
    ] = await Promise.all([
        fetchFortniteDBMissions(),
        fetchFreeTheVBucksMissions(),
        fetchSTWPlannerMissions()
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