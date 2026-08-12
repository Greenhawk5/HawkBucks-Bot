import { getTodayVbucksMissions } from "../missions/service.js";

const FORCE_FAKE_MISSIONS = false;

function fakeMissions() {
  return [
    { zone: "Stonewood", powerLevel: 9, reward: { amount: 50 }, mission: { type: "Deliver the Bomb", category: "Industrial Park" } },
    { zone: "Twine Peaks", powerLevel: 45, reward: { amount: 50 }, mission: { type: "Ride the Lightning", category: "City" } },
    { zone: "Plankerton", powerLevel: 33, reward: { amount: 50 }, mission: { type: "Ride the Lightning", category: "City" } },
    { zone: "Canny Valley", powerLevel: 12, reward: { amount: 50 }, mission: { type: "Category 3 Fight The Storm", category: "Suburbs" } },
    { zone: "Twine Peaks", powerLevel: 140, reward: { amount: 50 }, mission: { type: "Category 4 Fight The Storm", category: "Suburbs" } },
  ];
}

export async function getDailyMissions() {
  // Do not inject fallback or fake missions in production mode.
  // Honor FORCE_FAKE_MISSIONS only when explicitly enabled for development/testing.
  const missions = FORCE_FAKE_MISSIONS ? fakeMissions() : await getTodayVbucksMissions();
  return { success: missions.length > 0, missions };
}
