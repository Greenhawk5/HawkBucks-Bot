const MISSION_PLACEHOLDERS = new Set([
  "",
  "unknown",
  "unknown mission",
  "no mission",
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

export function normalizeMissions(missions) {
  return missions.map((mission) => ({
    ...mission,
    zone: normalizeZone(mission.zone),
    mission: { ...mission.mission, type: normalizeMissionType(mission.mission?.type), category: normalizeText(mission.mission?.category) },
  }));
}

export function isPlaceholderMissionType(type) {
  return MISSION_PLACEHOLDERS.has(comparisonText(type));
}

/**
 * Comparison key for deduplication. Epic labels storm missions as
 * "Category N Fight the Storm", so the category number is kept to
 * distinguish Category 3 and Category 4 alerts.
 */
export function missionTypeKey(type) {
  if (isPlaceholderMissionType(type)) return "";
  const value = comparisonText(type).replace(/^mission\s+/, "");
  const category = value.match(/\bcategory\s+(\d+)\b/);
  const isFightTheStorm = value.includes("fight the storm") ||
    (/\bcategory\s+\d+\s+storm\b/.test(value));

  if (isFightTheStorm) {
    return category ? `fight the storm category ${category[1]}` : "fight the storm";
  }

  return value.replace(/^category\s+\d+\s+/, "");
}
