import assert from "node:assert/strict";
import test from "node:test";
import { getMissionIcon, getAssets } from "../src/render/icon-map.js";

test("Fight Category 4 Storm resolves to the Four Atlas icon", () => {
  const embedded = getAssets().missions;
  const singleAtlas = embedded["Fight the Storm Single Atlas"];
  const fourAtlas = embedded["Fight the Storm Four Atlas"];
  const dualAtlas = embedded["Fight the Storm Dual Atlas"];

  // Epic's localized title for Category 4 storm missions.
  assert.equal(getMissionIcon("Fight Category 4 Storm"), fourAtlas);
  assert.notEqual(getMissionIcon("Fight Category 4 Storm"), singleAtlas);

  // Other normalized shapes of the same storm category.
  assert.equal(getMissionIcon("Category 4 Fight The Storm"), fourAtlas);
  assert.equal(getMissionIcon("Fight the Storm Category 4"), fourAtlas);

  // Lower categories keep their own Atlas counts.
  assert.equal(getMissionIcon("Fight Category 2 Storm"), dualAtlas);
  assert.equal(getMissionIcon("Fight the Storm"), singleAtlas);

  // 4 Player variants preserve the Atlas count.
  assert.equal(
    getMissionIcon("Fight Category 4 Storm 4 Player"),
    embedded["Fight the Storm Four Atlas 4 Player"]
  );
});

test("getMissionIcon falls back to the single Atlas for unknown missions", () => {
  assert.equal(
    getMissionIcon("Totally Unknown Mission"),
    getAssets().missions["Fight the Storm Single Atlas"]
  );

  // Sanity: the embedded asset table actually contains the Four Atlas art.
  assert.ok(getAssets().missions["Fight the Storm Four Atlas"]);
});
