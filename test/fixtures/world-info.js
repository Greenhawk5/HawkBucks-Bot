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
};


