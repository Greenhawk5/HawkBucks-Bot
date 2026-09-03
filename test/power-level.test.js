import assert from "node:assert/strict";
import test from "node:test";
import {
  getPowerLevel,
  isPowerLevelValidForTheater,
  parseDifficultyRowName,
} from "../src/epic/mappings.js";
import { parseWorldInfo } from "../src/epic/parser.js";
import { cannyVbucksMissionFixture } from "./fixtures/world-info.js";

test("parseDifficultyRowName splits rowName into family and zone index", () => {
  assert.deepEqual(parseDifficultyRowName("Theater_Hard_Zone2"), {
    family: "Theater_Hard",
    zoneIndex: 2,
  });
  assert.deepEqual(parseDifficultyRowName("Theater_Start_Zone5"), {
    family: "Theater_Start",
    zoneIndex: 5,
  });
  assert.equal(parseDifficultyRowName("None"), null);
  assert.equal(parseDifficultyRowName(""), null);
  assert.equal(parseDifficultyRowName(null), null);
  assert.equal(parseDifficultyRowName("Garbage_Row"), null);
});

test("regression: Canny Valley Theater_Hard_Zone2 resolves to 52, not 46", () => {
  assert.equal(
    getPowerLevel({ rowName: "Theater_Hard_Zone2" }),
    52,
    "Epic rebalanced Canny Valley to tiers 46-70; Zone2 must be 52"
  );
});

test("group (4-player) rows share the base rows' power levels (verified in raw world info)", () => {
  assert.equal(getPowerLevel({ rowName: "Theater_Hard_Group_Zone1" }), 46);
  assert.equal(getPowerLevel({ rowName: "Theater_Hard_Group_Zone5" }), 70);
  assert.equal(getPowerLevel({ rowName: "Theater_Nightmare_Group_Zone3" }), 88);
  assert.equal(getPowerLevel({ rowName: "Theater_Endgame_Group_Zone6" }), 160);
  assert.equal(getPowerLevel({ rowName: "Theater_Normal_Group_Zone3" }), 28);
});

test("power levels cover every difficulty family and zone tier", () => {
  const expected = {
    Theater_Start_Zone1: 1,
    Theater_Start_Zone5: 15,
    Theater_Normal_Zone1: 19,
    Theater_Normal_Zone5: 40,
    Theater_Hard_Zone1: 46,
    Theater_Hard_Zone2: 52,
    Theater_Hard_Zone3: 58,
    Theater_Hard_Zone4: 64,
    Theater_Hard_Zone5: 70,
    Theater_Nightmare_Zone1: 76,
    Theater_Nightmare_Zone5: 100,
    Theater_Endgame_Zone1: 108,
    Theater_Endgame_Zone6: 160,
  };

  for (const [rowName, power] of Object.entries(expected)) {
    assert.equal(getPowerLevel({ rowName }), power, rowName);
  }
});

test("out-of-range zone indexes and unknown families return null, not a guess", () => {
  assert.equal(getPowerLevel({ rowName: "Theater_Hard_Zone6" }), null);
  assert.equal(getPowerLevel({ rowName: "Theater_Start_Zone6" }), null);
  assert.equal(getPowerLevel({ rowName: "Theater_SomeNew_Zone1" }), null);
  assert.equal(getPowerLevel({ rowName: "None" }), null);
  assert.equal(getPowerLevel(undefined), null);
  assert.equal(getPowerLevel({ rowName: 42 }), null);
});

test("theater band validation detects cross-theater power levels", () => {
  assert.equal(isPowerLevelValidForTheater(52, "Canny Valley"), true);
  assert.equal(isPowerLevelValidForTheater(46, "Canny Valley"), true);
  assert.equal(isPowerLevelValidForTheater(70, "Canny Valley"), true);
  assert.equal(isPowerLevelValidForTheater(28, "Canny Valley"), false);
  assert.equal(isPowerLevelValidForTheater(82, "Canny Valley"), false);
  assert.equal(isPowerLevelValidForTheater(28, "Plankerton"), true);
  assert.equal(isPowerLevelValidForTheater(82, "Twine Peaks"), true);
  assert.equal(isPowerLevelValidForTheater(9, "Stonewood"), true);
  assert.equal(isPowerLevelValidForTheater(46, "Stonewood"), false);
  // Unknown theaters cannot be validated either way.
  assert.equal(isPowerLevelValidForTheater(52, "Mystery Theater"), true);
  assert.equal(isPowerLevelValidForTheater(null, "Canny Valley"), false);
});

test("parser associates each alert with the power level of its own mission", () => {
  const missions = parseWorldInfo(cannyVbucksMissionFixture);

  assert.equal(missions.length, 2);

  const retrieveTheData = missions.find(
    (mission) => mission.mission.type === "Retrieve the Data"
  );

  assert.ok(retrieveTheData, "Retrieve the Data mission must be present");
  assert.equal(retrieveTheData.zone, "Canny Valley");
  assert.equal(retrieveTheData.powerLevel, 52);
  assert.deepEqual(retrieveTheData.reward, { type: "vbucks", amount: 50 });
  assert.equal(retrieveTheData.mission.category, "Thunder Route 99");
  assert.equal(retrieveTheData.mission.difficultyRow, "Theater_Hard_Zone2");

  // The second alert (different tile, different mission) must keep its own
  // power level — this catches cross-mission association regressions.
  const other = missions.find(
    (mission) => mission.mission.type !== "Retrieve the Data"
  );
  assert.equal(other.powerLevel, 70);
  assert.equal(other.mission.difficultyRow, "Theater_Hard_Zone5");
  assert.notEqual(
    retrieveTheData.powerLevel,
    other.powerLevel,
    "missions on different tiles must not share power levels"
  );
});

test("parser keeps raw mission model fields intact for missions without a mission entry", () => {
  const missions = parseWorldInfo(cannyVbucksMissionFixture);
  for (const mission of missions) {
    assert.equal(typeof mission.reward.amount, "number");
    assert.ok(mission.mission.difficultyRow);
  }
});
