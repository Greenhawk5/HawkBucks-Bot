import assert from "node:assert/strict";
import test from "node:test";
import { formatMissionMessage } from "../src/telegram/formatter.js";
import { parseWorldInfo } from "../src/epic/parser.js";
import { worldInfoFixture } from "./fixtures/world-info.js";

function unescapeMarkdownV2(text) {
  return text.replace(/\\([\\_*[\]()~`>#+\-=|{}.!])/g, "$1");
}

test("daily message shows total, zone, reward, type, power and category", () => {
  const missions = parseWorldInfo(worldInfoFixture);
  const message = unescapeMarkdownV2(formatMissionMessage(missions));

  assert.ok(message.includes("Today's V-Buck missions* (100)"));
  assert.ok(message.includes("*Plankerton* — 50 V-Bucks"));
  assert.ok(message.includes("Retrieve the Data 28⚡"));
  assert.ok(message.includes("The City"));
  assert.ok(message.includes("*Twine Peaks* — 50 V-Bucks"));
  assert.ok(message.includes("Next mission reset"));
});

test("zero missions produce the explicit no-missions message", () => {
  const message = unescapeMarkdownV2(formatMissionMessage([]));
  assert.ok(message.includes("NO"));
  assert.ok(message.includes("V-Bucks missions are available today."));
});
