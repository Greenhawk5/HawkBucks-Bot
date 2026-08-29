import { fetchMissionData } from "../epic/client.js";
import { validateMissions } from "./validate.js";
import { normalizeMissions } from "./normalizer.js";

/**
 * Returns today's validated V-Bucks missions from the official Epic Games API.
 *
 * Throws when the Epic API fails so callers can distinguish
 * "no missions today" from "mission data is unavailable".
 */
export async function getTodayVbucksMissions(dependencies = {}) {
  const fetchMissions = dependencies.fetchMissionData ?? fetchMissionData;

  console.log("MISSION_FETCH_STARTED", { source: "epic-api" });

  const data = await fetchMissions(dependencies.env);

  console.log("EPIC_MISSIONS_RECEIVED", {
    count: data.missions.length,
    totalVbucks: data.totalVbucks,
  });

  const normalized = normalizeMissions(data.missions);
  const validated = validateMissions(normalized);

  console.log("FINAL_MISSIONS", { count: validated.length });
  return validated;
}
