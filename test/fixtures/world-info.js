// Minimal Epic Games "world info" payload used as a unit-test fixture.
// Mirrors the structure consumed by src/epic/parser.js.

const VBUCKS = "AccountResource:currency_mtxswap";

export const worldInfoFixture = {
  theaters: [
    {
      uniqueId: "theater-plankerton",
      displayName: { en: "Plankerton" },
      tiles: [
        {
          zoneTheme:
            "/Game/Projects/Fortnite/Gameplay/ZoneThemes/ZT_TheCity.ZT_TheCity_C",
        },
      ],
    },
    {
      uniqueId: "theater-twine",
      displayName: { en: "Twine Peaks" },
      tiles: [
        {
          zoneTheme:
            "/Game/Projects/Fortnite/Gameplay/ZoneThemes/ZT_Tropical.ZT_Tropical_C",
        },
      ],
    },
  ],
  missions: [
    {
      theaterId: "theater-plankerton",
      availableMissions: [
        {
          tileIndex: 0,
          missionGenerator:
            "/Game/Missions/Mission_RtD.Mission_RtD_C",
          missionDifficultyInfo: { rowName: "Theater_Normal_Zone3" },
        },
      ],
    },
    {
      theaterId: "theater-twine",
      availableMissions: [
        {
          tileIndex: 0,
          missionGenerator:
            "/Game/Missions/Mission_Cat1FtS.Mission_Cat1FtS_C",
          missionDifficultyInfo: { rowName: "Theater_Nightmare_Zone2" },
        },
      ],
    },
  ],
  missionAlerts: [
    {
      theaterId: "theater-plankerton",
      availableMissionAlerts: [
        {
          tileIndex: 0,
          missionAlertRewards: {
            items: [{ itemType: VBUCKS, quantity: 50 }],
          },
        },
      ],
    },
    {
      theaterId: "theater-twine",
      availableMissionAlerts: [
        {
          tileIndex: 0,
          missionAlertRewards: {
            items: [{ itemType: VBUCKS, quantity: 50 }],
          },
        },
      ],
    },
  ],
};

// Alert with no matching mission entry (Epic reports the reward but the
// mission list is empty). The parser emits "Unknown Mission" with no power.
export const alertWithoutMissionFixture = {
  theaters: [
    {
      uniqueId: "theater-canny",
      displayName: { en: "Canny Valley" },
      tiles: [{ zoneTheme: "/Game/ZoneThemes/ZT_TheSuburbs.ZT_TheSuburbs_C" }],
    },
  ],
  missions: [],
  missionAlerts: [
    {
      theaterId: "theater-canny",
      availableMissionAlerts: [
        {
          tileIndex: 2,
          missionAlertRewards: {
            items: [{ itemType: VBUCKS, quantity: 30 }],
          },
        },
      ],
    },
  ],
};

// Alert whose reward is gold, not V-Bucks; must be ignored.
export const nonVbucksAlertFixture = {
  theaters: [
    {
      uniqueId: "theater-stonewood",
      displayName: { en: "Stonewood" },
      tiles: [{ zoneTheme: "/Game/ZoneThemes/ZT_TheSuburbs.ZT_TheSuburbs_C" }],
    },
  ],
  missions: [
    {
      theaterId: "theater-stonewood",
      availableMissions: [
        {
          tileIndex: 0,
          missionGenerator: "/Game/MissionTemplates/RtD.RtD_C",
          missionDifficultyInfo: { rowName: "Theater_Start_Zone4" },
        },
      ],
    },
  ],
  missionAlerts: [
    {
      theaterId: "theater-stonewood",
      availableMissionAlerts: [
        {
          tileIndex: 0,
          missionAlertRewards: {
            items: [{ itemType: "AccountResource:gold", quantity: 100 }],
          },
        },
      ],
    },
  ],
}

// Regression fixture for the 46 -> 52 Power Level bug (Sept 2026):
// "Retrieve the Data - Thunder Route 99 (Bunker)" in Canny Valley sits on the
// Theater_Hard_Zone2 difficulty row, which resolves to Power Level 52
// (Epic rebalanced Canny Valley from tiers 40-70 to 46-70). A stale flat
// mapping returned 46 here. It also carries a second mission on a different
// tile with a different Power Level to guard against cross-mission
// association.
export const cannyVbucksMissionFixture = {
  theaters: [
    {
      uniqueId: "theater-canny",
      displayName: { en: "Canny Valley" },
      tiles: [
        {
          zoneTheme:
            "/Game/Projects/Fortnite/Gameplay/ZoneThemes/ZT_Route99.ZT_Route99_C",
        },
        {
          zoneTheme:
            "/Game/Projects/Fortnite/Gameplay/ZoneThemes/ZT_Lakeside.ZT_Lakeside_C",
        },
      ],
    },
  ],
  missions: [
    {
      theaterId: "theater-canny",
      availableMissions: [
        {
          tileIndex: 0,
          missionGenerator: "/Game/Missions/Mission_RtD.Mission_RtD_C",
          missionDifficultyInfo: { rowName: "Theater_Hard_Zone2" },
        },
        {
          tileIndex: 1,
          missionGenerator: "/Game/Missions/Mission_EtShelter.Mission_EtShelter_C",
          missionDifficultyInfo: { rowName: "Theater_Hard_Zone5" },
        },
      ],
    },
  ],
  missionAlerts: [
    {
      theaterId: "theater-canny",
      availableMissionAlerts: [
        {
          tileIndex: 0,
          missionAlertRewards: {
            items: [{ itemType: VBUCKS, quantity: 50 }],
          },
        },
        {
          tileIndex: 1,
          missionAlertRewards: {
            items: [{ itemType: VBUCKS, quantity: 30 }],
          },
        },
      ],
    },
  ],
};

