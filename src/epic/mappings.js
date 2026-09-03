// Static mappings adapted from the reference HawkBucks Epic implementation
// (epic/index.js). These translate raw Epic Games world-info identifiers into
// the human-readable values users expect.

// ---------------------------------------------------------------------------
// Power Level resolution
//
// Every mission in Epic's world-info payload carries
// `missionDifficultyInfo = { dataTable, rowName }`. The `rowName` (for example
// "Theater_Hard_Zone2") names a row in Epic's internal
// `GameDifficultyGrowthBounds` DataTable, and the row defines the displayed
// Power Level ("threat level") of that mission tier.
//
// Power Levels are therefore a property of (difficulty family, zone index),
// NOT of the individual mission, the zone theme, or the tile. Epic's data
// table has been retuned over the years (Canny Valley was rebalanced from six
// tiers 40-70 to five tiers 46-70), so the values below MUST track Epic's
// DataTable. They were verified against live mission alert listings
// (STW Planner, Sept 2026):
//
//   Stonewood   (Theater_Start_*)     : 1, 3, 5, 9, 15
//   Plankerton  (Theater_Normal_*)    : 19, 23, 28, 34, 40
//   Canny Valley (Theater_Hard_*)     : 46, 52, 58, 64, 70
//   Twine Peaks (Theater_Nightmare_*) : 76, 82, 88, 94, 100
//   Ventures    (Theater_Endgame_*)   : 108, 116, 124, 132, 140 (160 exists
//                                        only on Group rows: Zone6 = 160)
//   Ventures legacy "Phoenix" rows    : 1 ... 140
//
// The expected theater for each family lets the parser detect missions whose
// difficulty row disagrees with the theater Epic placed them in (which would
// indicate a data/association problem) instead of silently emitting a value.
// ---------------------------------------------------------------------------
export const DIFFICULTY_FAMILIES = [
  {
    family: "Theater_Start",
    expectedTheater: "Stonewood",
    powerLevels: [1, 3, 5, 9, 15],
  },
  {
    family: "Theater_Normal",
    expectedTheater: "Plankerton",
    powerLevels: [19, 23, 28, 34, 40],
  },
  {
    family: "Theater_Hard",
    expectedTheater: "Canny Valley",
    powerLevels: [46, 52, 58, 64, 70],
  },
  {
    family: "Theater_Nightmare",
    expectedTheater: "Twine Peaks",
    powerLevels: [76, 82, 88, 94, 100],
  },
  {
    family: "Theater_Endgame",
    expectedTheater: null, // Ventures zones can appear in any theater
    powerLevels: [108, 116, 124, 132, 140, 160],
  },
  {
    family: "Theater_Phoenix",
    expectedTheater: null,
    powerLevels: [1, 3, 5, 10, 15, 23, 34, 46, 58, 70, 82, 94, 108, 124, 140],
  },
];

export const POWER_LEVEL_BANDS = Object.fromEntries(
  DIFFICULTY_FAMILIES.map(({ expectedTheater, powerLevels }) => [
    expectedTheater,
    {
      min: Math.min(...powerLevels),
      max: Math.max(...powerLevels),
    },
  ]).filter(([theater]) => theater)
);

export const ZONE_MAP = {
  ZT_GhostTown: "Ghost Town",
  ZT_TheCity: "The City",
  ZT_TheSuburbs: "The Suburbs",
  ZT_Route99: "Thunder Route 99",
  ZT_IndustrialPark: "Industrial Park",
  ZT_TheWarehouse: "The Warehouse",
  ZT_AlpineStation: "Alpine Station",
  ZT_CraterGorge: "Crater Gorge",
  ZT_TheBusStop: "The Bus Stop",
  ZT_SeeingRed: "Seeing Red",
  ZT_StumpPatch: "Stump Patch",
  ZT_Fastlane: "Fast Lane",
  ZT_BlastedBadlands: "Blasted Badlands",
  ZT_Oakhaven: "Oakhaven",
  ZT_FlintlockFalls: "Flintlock Falls",
  "ZT_Farmer'sMarket": "Farmer's Market",
  ZT_GoodNeighbor: "Good Neighbor",
  ZT_Roadkill: "Roadkill",
  ZT_RoamingTitan: "Roaming Titan",
  ZT_ShardRockInn: "Shard Rock Inn",
  ZT_TradingPost: "Trading Post",
  ZT_ValleyRidge: "Valley Ridge",
  ZT_WreckedExpedition: "Wrecked Expedition",
  ZT_Canyoncrest: "Canyoncrest",
  ZT_HollowCreek: "Hollow Creek",
  ZT_HorizonHollow: "Horizon Hollow",
  ZT_NobleBeach: "Noble Beach",
  ZT_PhotonMonorail: "Photon Monorail",
  ZT_RiverRun: "River Run",
  ZT_Steepfall: "Steepfall",
  ZT_SteamRoller: "Steam Roller",
  ZT_TurkeyTruck: "Turkey Truck",
  ZT_WindingRivers: "Winding Rivers",
  ZT_Arid: "Desert",
  ZT_FinalFrontier: "Final Frontier",
  ZT_TheGrasslands: "Grasslands",
  ZT_Grasslands: "Grasslands",
  ZT_Forest: "Forest",
  ZT_HauntedForest: "Haunted Forest",
  ZT_Lakeside: "Lakeside",
  ZT_Tropical: "Scurvy Shoals (Tropical)",
  ZT_AutumnCity: "Autumn City",
  ZT_AutumnSuburbs: "Autumn Suburbs",
  ZT_AutumnIndustrialPark: "Autumn Industrial Park",
  ZT_AutumnFoothills: "Autumn Foothills",
  ZT_Hexsylvania: "Hexsylvania",
  ZT_ThePortal: "The Portal",
  ZT_TP: "Tropical",
};

export const ZONE_THEME_ALIASES = {
  ZT_TheIndustrialPark: "ZT_IndustrialPark",
  BP_ZT_AD_TheIndustrialPark: "ZT_IndustrialPark",
  BP_ZT_IndustrialPark: "ZT_IndustrialPark",
};

export const MISSION_MAP = {
  _1Gate_: "029003B949368614A8DABBA356C1C2BB",
  _Cat1FtS_: "029003B949368614A8DABBA356C1C2BB",
  _2Gates_: "6D79CF67497338EB3C220A98DE3B6188",
  _3Gates_: "CAFB5B6E4D10DE114B3A4A8180DFD2DC",
  _4Gates_: "EFFBDC1A4D6701DD500C0BADCFA4AB97",
  _DtB_: "35C0CEF64FFC9CE340D0579D68B53E0F",
  _EtShelter_: "F553B25F4E64D39E17709EB887016B1E",
  _RtD_: "136A7B9041D6CF2AADA4CE9D7EB942FB",
  _RetrieveTheData_: "136A7B9041D6CF2AADA4CE9D7EB942FB",
  _LtB_: "96F9DB85441C355E089DB28B382ADECA",
  _RideTheLightning_: "96F9DB85441C355E089DB28B382ADECA",
  _LaunchTheBalloon_: "96F9DB85441C355E089DB28B382ADECA",
  _RtL_: "96F9DB85441C355E089DB28B382ADECA",
  _RtS_: "FCDA9A38436EB6427D5B248DC98AF055",
};

import localization from "./localization.json" with { type: "json" };

export function getMissionName(missionGenerator, lang = "en") {
  const generatorString = missionGenerator ? String(missionGenerator) : "";

  for (const [key, missionId] of Object.entries(MISSION_MAP)) {
    if (generatorString.includes(key)) {
      const missionData = localization.missions?.[missionId];

      if (missionData) {
        return missionData[lang] || missionData.en || missionId;
      }

      return missionId;
    }
  }

  return "Unknown Mission";
}

const ROW_NAME_PATTERN = /^(.*[^\d])_Zone(\d+)$/;

/**
 * Parses a world-info difficulty rowName (e.g. "Theater_Hard_Zone2") into its
 * difficulty family and 1-based zone index. Returns null when the rowName is
 * absent, "None", or does not match the expected shape.
 *
 * Group (4-player) missions use their own rows ("Theater_Hard_Group_Zone2").
 * Raw world-info data plus live alert listings confirm group rows carry the
 * same Power Level per tier as the base rows, so the "_Group_" marker is
 * normalized away before lookup.
 */
export function parseDifficultyRowName(rowName) {
  if (typeof rowName !== "string" || rowName === "" || rowName === "None") {
    return null;
  }

  const normalizedRowName = rowName.replace("_Group_Zone", "_Zone");
  const match = ROW_NAME_PATTERN.exec(normalizedRowName);

  if (!match) {
    return null;
  }

  const family = match[1];
  const zoneIndex = Number(match[2]);

  if (!Number.isInteger(zoneIndex) || zoneIndex < 1) {
    return null;
  }

  return { family, zoneIndex };
}

/**
 * Resolves the displayed Power Level for a mission from its difficulty row.
 *
 * Strategy:
 *   1. Parse the rowName into (difficulty family, zone index).
 *   2. Look the family up in DIFFICULTY_FAMILIES (values sourced from Epic's
 *      GameDifficultyGrowthBounds DataTable — see the table comment above).
 *   3. Return the Power Level for that zone index, or null when anything is
 *      unknown/out of range. Never guesses or falls back to a wrong number.
 */
export function getPowerLevel(missionDifficultyInfo) {
  const rowName =
    typeof missionDifficultyInfo === "string"
      ? missionDifficultyInfo
      : missionDifficultyInfo?.rowName;

  const parsed = parseDifficultyRowName(rowName);

  if (!parsed) {
    if (rowName && rowName !== "None") {
      console.error(
        `POWER_LEVEL_RESOLUTION_FAILED { reason: "unrecognized_row_name", rowName: ${JSON.stringify(rowName)} }`
      );
    }
    return null;
  }

  const { family, zoneIndex } = parsed;
  const familyData = DIFFICULTY_FAMILIES.find((entry) => entry.family === family);

  if (!familyData) {
    console.error(
      `POWER_LEVEL_RESOLUTION_FAILED { reason: "unknown_difficulty_family", rowName: ${JSON.stringify(rowName)} }`
    );
    return null;
  }

  const power = familyData.powerLevels[zoneIndex - 1];

  if (typeof power !== "number") {
    console.error(
      `POWER_LEVEL_RESOLUTION_FAILED { reason: "zone_index_out_of_range", rowName: ${JSON.stringify(rowName)}, maxZone: ${familyData.powerLevels.length} }`
    );
    return null;
  }

  return power;
}

/**
 * Sanity check: verifies that a resolved Power Level is plausible for the
 * theater (zone) Epic reported the mission in. Ventures/Phoenix rows have no
 * single expected theater and are always accepted. Returns true when the
 * mission's Power Level is valid for its theater, and false when it likely
 * comes from another theater or an unknown mapping — callers should log this
 * rather than trust the value blindly.
 */
export function isPowerLevelValidForTheater(powerLevel, theaterName) {
  if (typeof powerLevel !== "number" || !theaterName) {
    return false;
  }

  const band = POWER_LEVEL_BANDS[theaterName];

  if (!band) {
    // Unknown theater: cannot validate either way.
    return true;
  }

  return powerLevel >= band.min && powerLevel <= band.max;
}

export function extractZoneThemeIdentifier(zoneTheme) {
  if (typeof zoneTheme !== "string") return null;

  const parts = zoneTheme.split("/").filter(Boolean);
  const zoneThemesIndex = parts.indexOf("ZoneThemes");

  if (zoneThemesIndex === -1) return null;

  const themeParts = parts.slice(zoneThemesIndex + 1);

  if (!themeParts.length) return null;

  const firstPart = themeParts[0].split(".")[0];

  if (firstPart.startsWith("ZT_")) {
    return ZONE_THEME_ALIASES[firstPart] || firstPart;
  }

  for (const part of themeParts) {
    const assetName = part.split(".")[0];

    if (ZONE_THEME_ALIASES[assetName]) {
      return ZONE_THEME_ALIASES[assetName];
    }

    if (assetName.startsWith("ZT_")) {
      return assetName;
    }
  }

  return null;
}

export function getZoneName(zoneTheme) {
  const identifier = extractZoneThemeIdentifier(zoneTheme);

  if (!identifier) {
    return "Unknown Zone";
  }

  return ZONE_MAP[identifier] || `Unknown Zone (${identifier})`;
}

export function getTheaterName(theaterInfo, fallbackIndex, lang = "en") {
  if (!theaterInfo) {
    return (
      localization.theaters?.[fallbackIndex]?.[lang] ||
      localization.theaters?.[fallbackIndex]?.en ||
      "Unknown Area"
    );
  }

  if (typeof theaterInfo.displayName === "object") {
    return (
      theaterInfo.displayName[lang] ||
      theaterInfo.displayName.en ||
      "Unknown Area"
    );
  }

  if (typeof theaterInfo.displayName === "string") {
    return theaterInfo.displayName;
  }

  return (
    localization.theaters?.[fallbackIndex]?.[lang] ||
    localization.theaters?.[fallbackIndex]?.en ||
    "Unknown Area"
  );
}