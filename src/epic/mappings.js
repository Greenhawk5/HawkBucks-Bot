// Static mappings adapted from the reference HawkBucks Epic implementation
// (epic/index.js). These translate raw Epic Games world-info identifiers into
// the human-readable values users expect.

export const DIFFICULTY_POWER_MAP = {
  Theater_Start_Zone1: 1,
  Theater_Start_Zone2: 3,
  Theater_Start_Zone3: 5,
  Theater_Start_Zone4: 9,
  Theater_Start_Zone5: 15,

  Theater_Normal_Zone1: 19,
  Theater_Normal_Zone2: 23,
  Theater_Normal_Zone3: 28,
  Theater_Normal_Zone4: 34,
  Theater_Normal_Zone5: 40,

  Theater_Hard_Zone1: 40,
  Theater_Hard_Zone2: 46,
  Theater_Hard_Zone3: 52,
  Theater_Hard_Zone4: 58,
  Theater_Hard_Zone5: 64,
  Theater_Hard_Zone6: 70,

  Theater_Nightmare_Zone1: 76,
  Theater_Nightmare_Zone2: 82,
  Theater_Nightmare_Zone3: 88,
  Theater_Nightmare_Zone4: 94,
  Theater_Nightmare_Zone5: 100,

  Theater_Endgame_Zone1: 108,
  Theater_Endgame_Zone2: 116,
  Theater_Endgame_Zone3: 124,
  Theater_Endgame_Zone4: 132,
  Theater_Endgame_Zone5: 140,
  Theater_Endgame_Zone6: 160,

  Theater_Phoenix_Zone1: 1,
  Theater_Phoenix_Zone2: 3,
  Theater_Phoenix_Zone3: 5,
  Theater_Phoenix_Zone4: 10,
  Theater_Phoenix_Zone5: 15,
  Theater_Phoenix_Zone6: 23,
  Theater_Phoenix_Zone7: 34,
  Theater_Phoenix_Zone8: 46,
  Theater_Phoenix_Zone9: 58,
  Theater_Phoenix_Zone10: 70,
  Theater_Phoenix_Zone11: 82,
  Theater_Phoenix_Zone12: 94,
  Theater_Phoenix_Zone13: 108,
  Theater_Phoenix_Zone14: 124,
  Theater_Phoenix_Zone15: 140,
};

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

export function getPowerLevel(missionDifficultyInfo) {
  const rowName =
    typeof missionDifficultyInfo === "string"
      ? missionDifficultyInfo
      : missionDifficultyInfo?.rowName;

  if (!rowName || rowName === "None") {
    return null;
  }

  const power = DIFFICULTY_POWER_MAP[rowName];
  return typeof power === "number" ? power : null;
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