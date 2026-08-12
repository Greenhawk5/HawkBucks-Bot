const MISSION_PLACEHOLDERS = new Set([
  "",
  "unknown",
  "unknown mission",
  "no mission",
  "n a",
  "na",
]);

const CATEGORY_PLACEHOLDERS = new Set([
  "",
  "unknown",
  "unknown category",
  "no category",
  "none",
  "n a",
  "na",
]);

export function normalizeText(text) {
  if (!text) return "";

  return String(text)
    .trim()
    .replace(/\s+/g, " ");
}

function comparisonText(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function normalizeZone(zone) {
  return normalizeText(zone);
}

export function normalizeMissionType(type) {
  return normalizeText(type);
}

export function isPlaceholderMissionType(type) {
  return MISSION_PLACEHOLDERS.has(comparisonText(type));
}

export function isPlaceholderCategory(category) {
  return CATEGORY_PLACEHOLDERS.has(comparisonText(category));
}

/**
 * Cross-source comparison key. FortniteDB can label Fight the Storm as
 * "Category 4 Fight The Storm" while other sources only provide the base type.
 */
export function missionTypeKey(type) {
  if (isPlaceholderMissionType(type)) return "";
  const value = comparisonText(type).replace(/^mission\s+/, "");
  const category = value.match(/\bcategory\s+(\d+)\b/);
  const isFightTheStorm = value.includes("fight the storm") ||
    (/\bcategory\s+\d+\s+storm\b/.test(value));

  // Providers use several labels for the same mission family. Keep the
  // category number when present so Category 3 and Category 4 remain distinct.
  if (isFightTheStorm) {
    return category ? `fight the storm category ${category[1]}` : "fight the storm";
  }

  return value.replace(/^category\s+\d+\s+/, "");
}

export function sourcePriority(source) {
  const value = comparisonText(source);
  if (value.includes("stwplanner")) return 3;
  if (value.includes("freethevbucks")) return 2;
  if (value.includes("fortnitedb")) return 1;
  return 0;
}

export function missionQuality(mission) {
  const type = mission?.mission?.type;
  const category = mission?.mission?.category;
  const typeScore = isPlaceholderMissionType(type) ? 0 : 20 + normalizeText(type).length;
  const categoryScore = isPlaceholderCategory(category) ? 0 : 10 + normalizeText(category).length;
  return typeScore + categoryScore;
}
