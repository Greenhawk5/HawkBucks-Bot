// Pure transformation of an Epic Games "world info" payload into the bot's
// internal mission model. Mirrors fetchMissionData() in the reference
// implementation (epic/index.js).
//
// Internal mission model:
// {
//   zone:        theater name          ("Plankerton", "Twine Peaks", ...)
//   powerLevel:  number | null
//   reward:      { type: "vbucks", amount: number }
//   mission:     { type: string, category: string | null }
// }

import {
  getMissionName,
  getPowerLevel,
  getTheaterName,
  getZoneName,
} from "./mappings.js";

export const VBUCKS_ITEM_TYPE = "AccountResource:currency_mtxswap";

export function parseWorldInfo(worldData, lang = "en") {
  const results = [];
  const resultKeys = new Set();

  const theatersById = new Map(
    (Array.isArray(worldData?.theaters) ? worldData.theaters : [])
      .filter((theater) => theater?.uniqueId)
      .map((theater) => [theater.uniqueId, theater])
  );

  const missionsById = new Map(
    (Array.isArray(worldData?.missions) ? worldData.missions : [])
      .filter((missions) => missions?.theaterId)
      .map((missions) => [missions.theaterId, missions])
  );

  const missionAlerts = Array.isArray(worldData?.missionAlerts)
    ? worldData.missionAlerts
    : [];

  for (let i = 0; i < missionAlerts.length; i += 1) {
    const missionAlert = missionAlerts[i];

    if (!missionAlert || !Array.isArray(missionAlert.availableMissionAlerts)) {
      continue;
    }

    for (const availableAlert of missionAlert.availableMissionAlerts) {
      if (!availableAlert || typeof availableAlert.tileIndex !== "number") {
        continue;
      }

      const rewards = availableAlert.missionAlertRewards?.items || [];

      const vbucksReward = rewards.find(
        (reward) => reward?.itemType === VBUCKS_ITEM_TYPE
      );

      if (!vbucksReward) {
        continue;
      }

      const tileIndex = availableAlert.tileIndex;
      const quantity = Number(vbucksReward.quantity);

      if (!Number.isFinite(quantity) || quantity <= 0) {
        continue;
      }

      const theaterInfo =
        theatersById.get(missionAlert.theaterId) || worldData.theaters?.[i];

      const theaterTile = theaterInfo?.tiles?.[tileIndex];

      // The theater is the bot's "zone" (Stonewood/Plankerton/Canny Valley/
      // Twine Peaks); the zone theme inside the theater is the bot's
      // mission category ("The City", "Suburbs", ...).
      const zone = getTheaterName(theaterInfo, i, lang);
      const category = getZoneName(theaterTile?.zoneTheme);

      const missions =
        missionsById.get(missionAlert.theaterId) || worldData.missions?.[i];

      const matchingMissions = Array.isArray(missions?.availableMissions)
        ? missions.availableMissions.filter(
            (mission) => mission?.tileIndex === tileIndex
          )
        : [];

      if (matchingMissions.length === 0) {
        const resultKey =
          `${missionAlert.theaterId || i}:${tileIndex}:${quantity}`;

        if (!resultKeys.has(resultKey)) {
          results.push(createMission({
            zone,
            category,
            rewardAmount: quantity,
            missionType: "Unknown Mission",
            powerLevel: null,
          }));
          resultKeys.add(resultKey);
        }

        continue;
      }

      for (const availableMission of matchingMissions) {
        const missionGenerator = availableMission.missionGenerator;

        const missionType = getMissionName(missionGenerator, lang);
        const powerLevel = getPowerLevel(
          availableMission.missionDifficultyInfo
        );

        const resultKey =
          `${missionAlert.theaterId || i}:${tileIndex}:${quantity}:` +
          `${missionGenerator || "unknown"}`;

        if (resultKeys.has(resultKey)) {
          continue;
        }

        results.push(createMission({
          zone,
          category,
          rewardAmount: quantity,
          missionType,
          powerLevel,
        }));

        resultKeys.add(resultKey);
      }
    }
  }

  return results;
}

function createMission({ zone, category, rewardAmount, missionType, powerLevel }) {
  return {
    zone,
    powerLevel,
    reward: {
      type: "vbucks",
      amount: rewardAmount,
    },
    mission: {
      type: missionType,
      category,
    },
  };
}

export function totalVbucks(missions) {
  return missions.reduce((sum, mission) => sum + Number(mission.reward?.amount || 0), 0);
}