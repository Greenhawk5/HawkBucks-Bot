import assert from "node:assert/strict";
import test from "node:test";
import { parseWorldInfo, totalVbucks } from "../src/epic/parser.js";
import { getZoneName } from "../src/epic/mappings.js";
import {
  alertWithoutMissionFixture,
  nonVbucksAlertFixture,
  worldInfoFixture,
} from "./fixtures/world-info.js";

test("parser extracts V-Buck alerts with zone, power, reward, type and category", () => {
  const missions = parseWorldInfo(worldInfoFixture);

  assert.equal(missions.length, 2);

  const plankerton = missions[0];
  assert.equal(plankerton.zone, "Plankerton");
  assert.equal(plankerton.powerLevel, 28);
  assert.deepEqual(plankerton.reward, { type: "vbucks", amount: 50 });
  assert.equal(plankerton.mission.type, "Retrieve the Data");
  assert.equal(plankerton.mission.category, "The City");

  const twine = missions[1];
  assert.equal(twine.zone, "Twine Peaks");
  assert.equal(twine.powerLevel, 82);
  assert.equal(twine.reward.amount, 50);
  assert.equal(twine.mission.type, "Fight the Storm");
  assert.equal(twine.mission.category, "Scurvy Shoals (Tropical)");
});

test("parser resolves ZT_TheForest zone theme to Forest", () => {
  // Regression: "/ZoneThemes/ZT_TheForest/BP_ZT_TheForest..." is a legitimate
  // zone theme that must resolve to "Forest", not "Unknown Zone".
  const worldData = {
    theaters: [
      {
        uniqueId: "Twine Peaks",
        displayName: { en: "Twine Peaks" },
        tiles: [
          {
            tileType: "AlwaysActive",
            zoneTheme:
              "/STW_Zones/World/ZoneThemes/ZT_TheForest/BP_ZT_TheForest.BP_ZT_TheForest_C",
          },
        ],
      },
    ],
    missions: [],
    missionAlerts: [
      {
        theaterId: "Twine Peaks",
        availableMissionAlerts: [
          {
            tileIndex: 0,
            missionAlertRewards: {
              items: [
                { itemType: "AccountResource:currency_mtxswap", quantity: 50 },
              ],
            },
          },
        ],
      },
    ],
  };

  const missions = parseWorldInfo(worldData);

  assert.equal(missions.length, 1);
  assert.equal(missions[0].mission.category, "Forest");
  assert.equal(getZoneName(
    "/STW_Zones/World/ZoneThemes/ZT_TheForest/BP_ZT_TheForest.BP_ZT_TheForest_C"
  ), "Forest");
});

test("parser resolves campaign-prefixed zone themes (BP_ZT_AD_*) to their base zone", () => {
  // Regression: tiles using campaign zone-theme assets such as
  // "/ZoneThemes/AD/BP_ZT_AD_Lakeside..." previously resolved to
  // "Unknown Zone" because the asset name carries no bare "ZT_" token.
  const worldData = {
    theaters: [
      {
        uniqueId: "Twine Peaks",
        displayName: { en: "Twine Peaks" },
        tiles: [
          {
            tileType: "AlwaysActive",
            zoneTheme:
              "/STW_Zones/World/ZoneThemes/AD/BP_ZT_AD_Lakeside.BP_ZT_AD_Lakeside_C",
          },
        ],
      },
    ],
    missions: [
      {
        theaterId: "Twine Peaks",
        availableMissions: [
          {
            tileIndex: 0,
            missionGenerator: "MissionGenerator_RtS_Dynamic",
            missionDifficultyInfo: { dataTable: "x", rowName: "Theater_Nightmare_Zone5" },
          },
        ],
      },
    ],
    missionAlerts: [
      {
        theaterId: "Twine Peaks",
        availableMissionAlerts: [
          {
            tileIndex: 0,
            missionAlertRewards: {
              items: [
                { itemType: "AccountResource:currency_mtxswap", quantity: 50 },
              ],
            },
          },
        ],
      },
    ],
  };

  const missions = parseWorldInfo(worldData);

  assert.equal(missions.length, 1);
  assert.equal(missions[0].zone, "Twine Peaks");
  assert.equal(missions[0].powerLevel, 100);
  assert.equal(missions[0].reward.amount, 50);
  assert.equal(missions[0].mission.type, "Repair the Shelter");
  assert.equal(missions[0].mission.category, "Lakeside");
});

test("parser ignores alerts without a V-Bucks reward", () => {
  const missions = parseWorldInfo(nonVbucksAlertFixture);
  assert.equal(missions.length, 0);
});

test("parser emits Unknown Mission without power level when no mission matches", () => {
  const missions = parseWorldInfo(alertWithoutMissionFixture);

  assert.equal(missions.length, 1);
  assert.equal(missions[0].zone, "Canny Valley");
  assert.equal(missions[0].mission.type, "Unknown Mission");
  assert.equal(missions[0].powerLevel, null);
  assert.equal(missions[0].reward.amount, 30);
});

test("parser deduplicates identical alerts", () => {
  const duplicated = {
    ...worldInfoFixture,
    missionAlerts: [
      worldInfoFixture.missionAlerts[0],
      worldInfoFixture.missionAlerts[0],
      worldInfoFixture.missionAlerts[1],
    ],
  };
  const missions = parseWorldInfo(duplicated);
  assert.equal(missions.length, 2);
});

test("parser handles missing or malformed structures safely", () => {
  assert.deepEqual(parseWorldInfo(null), []);
  assert.deepEqual(parseWorldInfo({}), []);
  assert.deepEqual(parseWorldInfo({ missionAlerts: "not-an-array" }), []);
  assert.deepEqual(parseWorldInfo({ missionAlerts: [null, {}] }), []);
});

test("parser rejects alerts with invalid reward quantities", () => {
  const invalid = {
    theaters: worldInfoFixture.theaters,
    missions: worldInfoFixture.missions,
    missionAlerts: [
      {
        theaterId: "theater-plankerton",
        availableMissionAlerts: [
          {
            tileIndex: 0,
            missionAlertRewards: {
              items: [
                {
                  itemType: "AccountResource:currency_mtxswap",
                  quantity: -5,
                },
              ],
            },
          },
          {
            tileIndex: 0,
            missionAlertRewards: {
              items: [
                { itemType: "AccountResource:currency_mtxswap", quantity: "abc" },
              ],
            },
          },
        ],
      },
    ],
  };
  assert.deepEqual(parseWorldInfo(invalid), []);
});

test("totalVbucks sums reward amounts", () => {
  const missions = parseWorldInfo(worldInfoFixture);
  assert.equal(totalVbucks(missions), 100);
  assert.equal(totalVbucks([]), 0);
});
