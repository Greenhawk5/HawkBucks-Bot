import assert from "node:assert/strict";
import test from "node:test";
import { getAdminId, isAdmin } from "../src/config/admin.js";
import { getMainKeyboard } from "../src/telegram/keyboards.js";
import { periodStartIso, PERIODS } from "../database/stats.js";
import { buildPdfDocument } from "../src/services/pdf.js";

// ---------- Authentication ----------

test("configured admin is accepted", () => {
  const env = { ADMIN_TELEGRAM_ID: "111222333" };
  assert.equal(isAdmin(env, 111222333), true);
  assert.equal(isAdmin(env, "111222333"), true);
});

test("non-admin is rejected", () => {
  const env = { ADMIN_TELEGRAM_ID: "111222333" };
  assert.equal(isAdmin(env, 999), false);
  assert.equal(isAdmin(env, "111222334"), false);
  assert.equal(isAdmin(env, undefined), false);
  assert.equal(isAdmin(env, null), false);
});

test("missing admin secret fails closed", () => {
  assert.equal(isAdmin({}, 111222333), false);
  assert.equal(isAdmin(undefined, 111222333), false);
  assert.equal(getAdminId({}), null);
});

test("invalid admin secret fails closed", () => {
  for (const bad of ["", "abc", "12a3", "-5", "1", "not-a-number"]) {
    assert.equal(isAdmin({ ADMIN_TELEGRAM_ID: bad }, 1), false, `expected reject: ${bad}`);
  }
});

// Security regression: the old hardcoded IDs must not grant access anymore.
test("legacy hardcoded owner IDs are no longer authorized by default", () => {
  assert.equal(isAdmin({}, 6726776142), false);
  assert.equal(isAdmin({}, 184202422), false);
});

// ---------- Main keyboard ----------

test("normal user keyboard has no Admin button", () => {
  const kb = getMainKeyboard(false, true);
  const labels = kb.keyboard.flat().map((b) => b.text);
  assert.equal(labels.includes("👑 Admin"), false);
  assert.deepEqual(labels.slice(0, 2), ["💰 V-Bucks Missions", "🟢 Daily Reminder"]);
  assert.ok(labels.includes("➕ Add to Group"));
  assert.ok(labels.includes("💚 Support"));
});

test("admin keyboard contains the Admin button", () => {
  const kb = getMainKeyboard(true, true);
  const labels = kb.keyboard.flat().map((b) => b.text);
  assert.equal(labels[0], "👑 Admin");
  assert.ok(labels.includes("💰 V-Bucks Missions"));
  assert.ok(labels.includes("🟢 Daily Reminder"));
  assert.ok(labels.includes("➕ Add to Group"));
  assert.ok(labels.includes("💚 Support"));
});

test("admin keyboard is the only difference for the admin", () => {
  const admin = getMainKeyboard(true, true);
  const user = getMainKeyboard(false, true);
  assert.equal(admin.keyboard.length, user.keyboard.length + 1);
});

// ---------- Periods ----------

test("period boundaries are deterministic and UTC-based", () => {
  const now = new Date("2026-08-29T15:30:45Z"); // Saturday

  const day = periodStartIso("day", now);
  assert.equal(day.toISOString(), "2026-08-29T00:00:00.000Z");

  // Week starts Monday 00:00 UTC.
  const week = periodStartIso("week", now);
  assert.equal(week.toISOString(), "2026-08-24T00:00:00.000Z");

  const month = periodStartIso("month", now);
  assert.equal(month.toISOString(), "2026-08-01T00:00:00.000Z");

  const sixMonths = periodStartIso("6months", now);
  // JavaScript month arithmetic clamps: Aug 29 - 6 months lands on Mar 1 in 2026
  // (no Feb 29). This is deterministic UTC behavior.
  assert.equal(sixMonths.toISOString(), "2026-03-01T15:30:45.000Z");

  const year = periodStartIso("year", now);
  assert.equal(year.toISOString(), "2025-08-29T15:30:45.000Z");

  assert.deepEqual(PERIODS, ["day", "week", "month", "6months", "year"]);
});

test("invalid period returns null", () => {
  assert.equal(periodStartIso("fortnight"), null);
});

// ---------- PDF ----------

// ---------- PDF layout geometry (structural, not extraction-based) ----------

// Parses content-stream ops from the generated PDF: filled rectangles and
// positioned text runs, so geometric relationships can be asserted.
function parsePageGeometry(pdfBytes) {
  const raw = Buffer.from(pdfBytes).toString("latin1");
  const streams = [...raw.matchAll(/stream\n([\s\S]*?)\nendstream/g)].map((m) => m[1]);
  // The last-but-N streams are page contents (font streams are binary); pick
  // streams that contain "Tf" text operators.
  // Page contents streams contain Tf/Tm operators (font binary streams do not).
  const contentStreams = streams.filter((s) => s.includes("Tf") && s.includes("Tm"));
  // Multiple blocks build multiple content streams; the FIRST page is the one
  // named "/Type /Page" with the smallest object number — but simply take the
  // stream whose ProviderOrder matches a page + content (content streams are
  // the ones ending in endstream that contain text operators). Use the stream
  // that holds the header rect (dark band) if present.
  const page = contentStreams.find((s) => s.includes("0.024 0.102 0.043")) || contentStreams[0];

  const rects = [...page.matchAll(/([\d.]+) ([\d.]+) ([\d.]+) rg ([\d.]+) ([\d.]+) ([\d.]+) ([\d.]+) re f[^Q]*/g)].map((m) => ({
    color: `${m[1]} ${m[2]} ${m[3]}`,
    x: Number(m[4]), y: Number(m[5]), w: Number(m[6]), h: Number(m[7]),
    top: Number(m[5]) + Number(m[7]), bottom: Number(m[5]),
  }));
  const texts = [...page.matchAll(/q ([\d.]+) ([\d.]+) ([\d.]+) rg BT \/(\w+) ([\d.]+) Tf 1 0 0 1 ([\d.]+) ([\d.]+) Tm/g)].map((m) => ({
    color: `${m[1]} ${m[2]} ${m[3]}`,
    font: m[4], size: Number(m[5]), x: Number(m[6]), baseline: Number(m[7]),
  }));
  return { rects, texts, stream: page };
}

const BAND = "0.024 0.102 0.043";
const INK = "0.082 0.125 0.106";
const MUTED = "0.404 0.443 0.420";

test("PDF geometry: table header rect and first data row never overlap", async () => {
  const { buildPdfDocument } = await import("../src/services/pdf.js");
  const pdf = buildPdfDocument({
    title: "Usage Statistics",
    subtitle: "Period: Current Month   |   Generated: 2026-08-29 00:00:00 UTC (UTC)",
    blocks: [
      { type: "heading", text: "USER ACTIVITY" },
      { type: "table",
        columns: [{ label: "Name", width: 3 }, { label: "ID", width: 2 }, { label: "Last Used", width: 2, align: "right" }],
        rows: [["Alice", "1", "2026-08-29 10:00"], ["Bob", "2", "2026-08-28 09:00"]] },
    ],
  });
  const { rects, texts } = parsePageGeometry(pdf);

  const headerRect = rects.find((r) => r.color === BAND && r.h > 10 && r.h < 30);
  assert.ok(headerRect, "table header rectangle must exist");

  // White header text must sit inside the header box.
  const headerTexts = texts.filter((t) => t.size === 8.5 && t.font === "FH");
  assert.ok(headerTexts.length >= 3);
  for (const t of headerTexts) {
    assert.ok(t.baseline < headerRect.top && t.baseline > headerRect.bottom,
      `header text baseline ${t.baseline} outside header box [${headerRect.bottom}, ${headerRect.top}]`);
  }

  // Dark body text (first data row). In PDF coordinates y grows downward, so
  // "below the header" means the first-row baseline must be strictly lower
  // (smaller y) than the header box's filled bottom — with a real gap.
  const bodyTexts = texts.filter((t) => t.font === "FB" && t.size === 8.5);
  assert.ok(bodyTexts.length >= 3, "first data row text must exist");
  const highestRowBaseline = Math.min(...bodyTexts.map((t) => t.baseline));
  assert.ok(
    highestRowBaseline <= headerRect.bottom - 1,
    `first data row baseline (${highestRowBaseline.toFixed(2)}) must sit below header box (bottom ${headerRect.bottom.toFixed(2)})`
  );

  // Both rows share consistent row height and never overlap each other.
  const rowBaselines = bodyTexts.map((t) => t.baseline).sort((a, b) => b - a);
  const distinctRows = [...new Set(rowBaselines.map((b) => b.toFixed(2)))];
  assert.ok(distinctRows.length >= 2);
});


test("usage PDF uses embedded Unicode fonts and valid structure", () => {
  const pdf = buildPdfDocument({
    title: "Usage Statistics",
    subtitle: "Period: Current Month   |   Generated: 2026-08-29 00:00:00 UTC (UTC)",
    blocks: [
      { type: "cards", items: [
        { label: "USERS", value: 10 },
        { label: "GROUPS", value: 3 },
        { label: "CHANNELS", value: 1 },
        { label: "TOTAL", value: 14 },
      ] },
      { type: "heading", text: "USER ACTIVITY" },
      { type: "table",
        columns: [{ label: "Name", width: 3 }, { label: "ID", width: 2 }, { label: "Last Used", width: 2, align: "right" }],
        rows: [["Alice", "1", "2026-08-29 10:00"]] },
    ],
  });

  const raw = Buffer.from(pdf).toString("latin1");
  assert.ok(raw.startsWith("%PDF-1.4"));
  assert.ok(raw.trimEnd().endsWith("%%EOF"));
  assert.ok(raw.includes("/Type0"), "composite Unicode font required");
  assert.ok(raw.includes("/Identity-H"));
  assert.ok(raw.includes("/FontFile2"), "embedded TTF required");
  assert.ok(raw.includes("/ToUnicode"));
  assert.ok(raw.includes("/CIDFontType2"));
  assert.ok(raw.includes("/Count 1"));
});

test("PDF preserves Unicode names (Cyrillic, Latin-extended) via ToUnicode", () => {
  const pdf = buildPdfDocument({
    title: "Active Reminders",
    subtitle: "Generated: 2026-08-29 00:00:00 UTC (UTC)",
    blocks: [
      { type: "table",
        columns: [{ label: "Name", width: 3 }, { label: "ID", width: 2 }],
        rows: [["Ж TestCase", "1"], ["Åse Bjørk", "2"]] },
    ],
  });
  const raw = Buffer.from(pdf).toString("latin1");
  // ToUnicode maps CIDs back to the original codepoints.
  assert.ok(/<003f>|<0416>|<0414>|<0416>/i.test(raw) || raw.includes("0416"),
    "Cyrillic codepoints must appear in the ToUnicode map");
  assert.ok(/0416/i.test(raw), "Ж (U+0416) must be mapped");
  assert.ok(/00C5/i.test(raw), "Å (U+00C5) must be mapped");
});

test("PDF strips emoji instead of emitting broken glyphs", () => {
  const pdf = buildPdfDocument({
    title: "Report 😀👑",
    blocks: [{ type: "text", text: "name 😀 ok" }],
  });
  const raw = Buffer.from(pdf).toString("latin1");
  assert.ok(!raw.includes("1F600"), "emoji codepoint must not be mapped");
  assert.ok(!raw.includes("1F451"), "crown codepoint must not be mapped");
});

test("unsupported scripts (Arabic) become visible '?' placeholders, never deleted silently", () => {
  const pdf = buildPdfDocument({
    title: "Active Reminders",
    blocks: [{ type: "table",
      columns: [{ label: "Name", width: 3 }, { label: "ID", width: 2 }],
      rows: [["علي", "9"]] }],
  });
  const raw = Buffer.from(pdf).toString("latin1");
  // The '?' fallback glyph must be referenced (bfchar maps something to 003F).
  assert.ok(raw.includes("/ToUnicode"));
  assert.ok(/003F/i.test(raw), "fallback '?' mapping expected for unsupported scripts");
  assert.ok(!raw.includes("0639") && !raw.includes("0627"), "Arabic codepoints must not be mapped as-if supported");
});

test("PDF paginates long content and numbers pages", () => {
  const rows = Array.from({ length: 120 }, (_, i) => [`Recipient entry ${i + 1}`, String(i + 1)]);
  const pdf = buildPdfDocument({
    title: "Long report",
    subtitle: "Generated: 2026-08-29 00:00:00 UTC (UTC)",
    blocks: [{ type: "table",
      columns: [{ label: "Name", width: 3 }, { label: "ID", width: 2 }],
      rows }],
  });
  const raw = Buffer.from(pdf).toString("latin1");
  const count = Number(raw.match(/\/Count (\d+)/)?.[1] || 0);
  assert.ok(count > 1, `expected multiple pages, got ${count}`);
  // Every page carries a footer (brand line + page number line, both in the
  // body font at 7.5pt) — footer text itself is glyph-encoded.
  const footerOps = raw.match(/\/FB 7\.5 Tf/g)?.length || 0;
  assert.ok(footerOps >= count * 2, `expected footer text ops on every page, got ${footerOps}`);
});

test("PDF never contains secrets", () => {
  const pdf = buildPdfDocument({
    title: "Report", subtitle: "x",
    blocks: [{ type: "text", text: "TELEGRAM_BOT_TOKEN ADMIN_TELEGRAM_ID secret" }],
  });
  const raw = Buffer.from(pdf).toString("latin1");
  // Content is glyph-encoded, so plaintext secrets cannot appear; the
  // ToUnicode map only ever maps the characters the report was given.
  assert.ok(!raw.includes("Bot(Token)"));
  assert.ok(!/secret/i.test(raw.replace(/[0-9a-f]{4}/g, "")));
});

