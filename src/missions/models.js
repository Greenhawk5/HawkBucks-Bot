export function createMission({

    zone,

    powerLevel,

    rewardAmount,

    missionType,

    missionCategory = null,

    source,

    expiresAt = null

}) {

    return {

        id: crypto.randomUUID(),

        zone,

        powerLevel,

        reward: {

            type: "vbucks",

            amount: rewardAmount

        },

        mission: {

            type: missionType,

            category: missionCategory

        },

        source,

        confirmedBy: [

            source

        ],

        expiresAt,

        createdAt: Date.now()

    };

}