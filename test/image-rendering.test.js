import assert from "node:assert/strict";
import test from "node:test";
import { generateScreenshot } from "../src/services/screenshot.js";
import { buildMissionCards, getMissionLayout } from "../src/render/template-builder.js";

const LAYOUT = { width: 800, canvasHeight: 1620, mode: "normal", missionCount: 3 };

test("ScreenshotOne request uses DPR 2 and quality 100 with unchanged viewport/format", async () => {
  let capturedBody;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url, init) => {
    capturedBody = JSON.parse(init.body);
    return {
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(0),
    };
  };

  try {
    await generateScreenshot("<html></html>", { SCREENSHOTONE_ACCESS_KEY: "key" }, LAYOUT);
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(capturedBody.access_key, "key");
  assert.equal(capturedBody.html, "<html></html>");
  assert.equal(capturedBody.device_scale_factor, 2);
  assert.equal(capturedBody.image_quality, 100);
  // Unchanged from the previous behavior:
  assert.equal(capturedBody.format, "png");
  assert.equal(capturedBody.response_type, "by_format");
  assert.equal(capturedBody.viewport_width, LAYOUT.width);
  assert.equal(capturedBody.viewport_height, LAYOUT.canvasHeight);
});

function mission(zone, powerLevel, amount = 130) {
  return {
    zone,
    powerLevel,
    mission: { type: "Defend the Shelter", category: "Defense" },
    reward: { amount },
  };
}

function zoneRibbon(cardsHtml, zone) {
  // Each ribbon is a single line containing the zone name followed by the count.
  const match = cardsHtml.match(
    new RegExp(`zone-name">${zone}</span>\\s*<span class="zone-count">([^<]+)<`)
  );
  assert.ok(match, `Expected a ribbon for zone ${zone} in: ${cardsHtml}`);
  return match[1];
}

test("Case A — two missions in one zone render that zone's count as 2", () => {
  const cards = buildMissionCards(
    [mission("Canny Valley", 52), mission("Canny Valley", 58)],
    getMissionLayout(2, { zoneCount: 1 })
  );
  assert.equal(zoneRibbon(cards, "Canny Valley"), "02");
});

test("Case B — different mission counts per zone", () => {
  const cards = buildMissionCards(
    [mission("Stonewood", 19), mission("Twine Peaks", 70), mission("Twine Peaks", 82), mission("Twine Peaks", 94)],
    getMissionLayout(4, { zoneCount: 2 })
  );
  assert.equal(zoneRibbon(cards, "Stonewood"), "01");
  assert.equal(zoneRibbon(cards, "Twine Peaks"), "03");
});

test("Case C — zone order does not affect the displayed count", () => {
  const missions = [
    mission("Stonewood", 19),
    mission("Twine Peaks", 70),
    mission("Twine Peaks", 82),
    mission("Twine Peaks", 94),
  ];
  // Rendered in different input orders; counts must follow the zones, not positions.
  const first = buildMissionCards(missions, getMissionLayout(4, { zoneCount: 2 }));
  const reversed = buildMissionCards([...missions].reverse(), getMissionLayout(4, { zoneCount: 2 }));
  for (const cards of [first, reversed]) {
    assert.equal(zoneRibbon(cards, "Stonewood"), "01");
    assert.equal(zoneRibbon(cards, "Twine Peaks"), "03");
  }
});

test("Case D — missing zones get no ordinal and present zones keep real counts", () => {
  const cards = buildMissionCards(
    [mission("Plankerton", 46), mission("Plankerton", 52)],
    getMissionLayout(2, { zoneCount: 1 })
  );
  // Only Plankerton is present; Stonewood/Canny/Twine must not appear with any number.
  assert.ok(!cards.includes("Stonewood"));
  assert.ok(!cards.includes("Canny Valley"));
  assert.ok(!cards.includes("Twine Peaks"));
  assert.equal(zoneRibbon(cards, "Plankerton"), "02");
});