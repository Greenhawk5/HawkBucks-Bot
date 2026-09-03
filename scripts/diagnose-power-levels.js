// Temporary investigation script: extracts theater / mission / difficulty-row
// evidence from a raw Epic world-info payload (not production code).
import { readFileSync } from "node:fs";

const raw = JSON.parse(
  readFileSync(new URL("../epic-web/world_info.json", import.meta.url), "utf8")
);

const theaters = new Map(
  (raw.theaters || []).map((t, i) => [t.uniqueId, { name: t.displayName?.en, slot: t.theaterSlot, index: i, tiles: (t.tiles || []).length }])
);

// theaterId -> missions
const missionsByTheater = new Map();
for (const m of raw.missions || []) {
  const list = missionsByTheater.get(m.theaterId) || [];
  for (const am of m.availableMissions || []) list.push(am);
  missionsByTheater.set(m.theaterId, list);
}

// Collect all rowNames per theater
const rowsByTheater = new Map();
for (const [theaterId, missions] of missionsByTheater) {
  const th = theaters.get(theaterId) || { name: theaterId };
  const rows = new Map();
  for (const am of missions) {
    const row = am.missionDifficultyInfo?.rowName;
    if (!row) continue;
    if (!rows.has(row)) rows.set(row, { count: 0, examples: [] });
    const entry = rows.get(row);
    entry.count += 1;
    if (entry.examples.length < 3) {
      entry.examples.push({
        tileIndex: am.tileIndex,
        gen: am.missionGenerator?.split("/").pop(),
        dataTable: am.missionDifficultyInfo?.dataTable,
      });
    }
  }
  rowsByTheater.set(th.name, rows);
}

// Sanity: also scan ALL rowNames anywhere in the payload (missions + theaters requirements)
const allRows = new Set();
for (const [, missions] of missionsByTheater)
  for (const am of missions) {
    const r = am.missionDifficultyInfo?.rowName;
    if (r) allRows.add(r);
  }

console.log("=== Distinct rowNames in missions ===");
console.log([...allRows].sort().join("\n"));

console.log("\n=== RowNames grouped by theater ===");
for (const [theaterName, rows] of rowsByTheater) {
  console.log(`\n## ${theaterName}`);
  for (const [row, info] of [...rows].sort()) {
    console.log(`  ${row}  (x${info.count})  e.g. tile=${info.examples[0].tileIndex} gen=${info.examples[0].gen}`);
  }
}

// The V-Buck mission: find alerts with mtxswap reward, resolve mission + row
const VBUCKS = "AccountResource:currency_mtxswap";
console.log("\n=== V-Bucks alerts -> matched mission / difficulty row ===");
for (const alert of raw.missionAlerts || []) {
  const th = theaters.get(alert.theaterId) || { name: alert.theaterId };
  const missions = missionsByTheater.get(alert.theaterId) || [];
  for (const a of alert.availableMissionAlerts || []) {
    const items = a.missionAlertRewards?.items || [];
    if (!items.some((i) => i.itemType === VBUCKS)) continue;
    const matched = missions.filter((m) => m.tileIndex === a.tileIndex);
    for (const m of matched) {
      console.log(
        `${th.name} | qty=${items.find((i) => i.itemType === VBUCKS)?.quantity} | tile=${a.tileIndex} | row=${m.missionDifficultyInfo?.rowName} | gen=${m.missionGenerator?.split("/").pop()} | guid=${m.missionGuid}`
      );
    }
    if (matched.length === 0)
      console.log(`${th.name} | qty=... | tile=${a.tileIndex} | NO MISSION MATCH`);
  }
}
