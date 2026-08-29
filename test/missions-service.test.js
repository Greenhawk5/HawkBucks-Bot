import assert from "node:assert/strict";
import test from "node:test";
import { getTodayVbucksMissions } from "../src/missions/service.js";
import { getDailyMissions } from "../src/services/missions.js";
import { validateMissions } from "../src/missions/validate.js";
import { groupAndSortMissions } from "../src/missions/organize.js";
import { parseWorldInfo } from "../src/epic/parser.js";
import { worldInfoFixture } from "./fixtures/world-info.js";

function epicResult(missions) {
  return {
    success: true,
    status: missions.length ? "available" : "empty",
    totalVbucks: missions.reduce((sum, m) => sum + m.reward.amount, 0),
    missions,
  };
}

const plankRetrieve = parseWorldInfo(worldInfoFixture)[0];
const twineStorm = parseWorldInfo(worldInfoFixture)[1];

test("service returns validated Epic missions", async () => {
  const missions = await getTodayVbucksMissions({
    env: {},
    fetchMissionData: async () => epicResult([plankRetrieve, twineStorm]),
  });

  assert.equal(missions.length, 2);
  assert.equal(missions[0].zone, "Plankerton");
  assert.equal(missions[0].powerLevel, 28);
  assert.equal(missions[0].reward.amount, 50);
});

test("service propagates Epic API failures instead of reporting zero missions", async () => {
  await assert.rejects(() =>
    getTodayVbucksMissions({
      env: {},
      fetchMissionData: async () => {
        throw new Error("Epic world info request failed with HTTP 503");
      },
    })
  );
});

test("getDailyMissions propagates API failures (no fake zero-mission day)", async () => {
  // An empty env means Epic credentials are missing -> the client must throw,
  // so callers can tell "API unavailable" apart from "no missions today".
  await assert.rejects(() => getDailyMissions({ env: {} }));
});


test("validation filters invalid zones, power levels, rewards and placeholders", () => {
  const validated = validateMissions([
    plankRetrieve,
    { ...plankRetrieve, zone: "Unknown Area" },
    { ...plankRetrieve, powerLevel: 0 },
    { ...plankRetrieve, powerLevel: null },
    { ...plankRetrieve, reward: { type: "vbucks", amount: 0 } },
    { ...plankRetrieve, mission: { ...plankRetrieve.mission, type: "Unknown Mission" } },
  ]);

  assert.equal(validated.length, 1);
  assert.equal(validated[0].zone, "Plankerton");
});

test("validation removes duplicate missions", () => {
  const validated = validateMissions([plankRetrieve, { ...plankRetrieve }]);
  assert.equal(validated.length, 1);
});

test("validation keeps distinct storm categories separate", () => {
  const cat3 = {
    ...twineStorm,
    zone: "Canny Valley",
    powerLevel: 100,
    mission: { type: "Fight the Storm", category: "Suburbs" },
  };
  const validated = validateMissions([twineStorm, cat3]);
  assert.equal(validated.length, 2);
});

test("missions are grouped by zone order and sorted by power level", () => {
  const sorted = groupAndSortMissions([
    twineStorm,
    plankRetrieve,
    { ...twineStorm, zone: "Stonewood", powerLevel: 9 },
    { ...twineStorm, zone: "Canny Valley", powerLevel: 108 },
  ]);

  assert.deepEqual(
    sorted.map((mission) => mission.zone),
    ["Stonewood", "Plankerton", "Canny Valley", "Twine Peaks"]
  );
  assert.equal(sorted[0].powerLevel, 9);
  assert.equal(sorted[2].powerLevel, 108);
});
