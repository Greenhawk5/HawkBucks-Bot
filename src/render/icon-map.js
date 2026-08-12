import { assets } from "./assets-loader.js";

const ATLAS_BY_CATEGORY = {
  "category_1_fight_the_storm": "Single Atlas",
  "category_2_fight_the_storm": "Dual Atlas",
  "category_3_fight_the_storm": "Triple Atlas",
  "category_4_fight_the_storm": "Four Atlas",
  fight_the_storm: "Single Atlas",
};

export function normalizeMissionType(value = "") {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function hasFourPlayerVariant(...values) {
  return values.some((value) => /(?:^|\s)(?:4|four)[ -]?players?(?:$|\s)/i.test(String(value)));
}

function getAtlasVariant(type, category) {
  const normalizedType = normalizeMissionType(type).replace(/_4_player$/, "");
  const normalizedCategory = normalizeMissionType(category).replace(/_4_player$/, "");
  return ATLAS_BY_CATEGORY[normalizedType] || ATLAS_BY_CATEGORY[normalizedCategory] || null;
}

function getExactAssetName(type, category = "") {
  const normalizedType = normalizeMissionType(type);
  const directNames = Object.keys(assets.missions)
    .filter((name) => normalizeMissionType(name) === normalizedType);

  if (directNames.length > 0) return directNames[0];

  const atlas = getAtlasVariant(type, category);
  if (atlas) return `Fight the Storm ${atlas}`;

  return null;
}

/**
 * Resolves all mission artwork in one place. Sources do not agree on whether
 * "4 Player" and the Atlas count belong to the type or category, so both are
 * deliberately considered here rather than in the HTML renderer.
 */
export function getMissionIcon(type, category = "") {
  const missionType = String(type || "").trim();
  const fourPlayer = hasFourPlayerVariant(missionType, category);
  const exactName = getExactAssetName(missionType, category);
  const baseName = exactName || missionType;
  const preferredName = fourPlayer && !normalizeMissionType(baseName).endsWith("_4_player")
    ? `${baseName} 4 Player`
    : baseName;

  return assets.missions[preferredName]
    || assets.missions[baseName]
    || assets.missions["Fight the Storm Single Atlas"];
}

export function getAssets() {
  return assets;
}
