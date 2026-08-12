import { renderMissionImage } from "./image-renderer.js";


export async function testRender(){

    const buffer =
        await renderMissionImage({

            date:"July 26, 2026",

            totalVbucks:100,

            resetTimer:"15:25:13",


            missions:[

                {
                    type:"Ride the Lightning",
                    zone:"Stonewood",
                    category:"City",
                    vbucks:50,
                    powerLevel:15
                },

                {
                    type:"Category 2 Storm",
                    zone:"Plankerton",
                    vbucks:50,
                    powerLevel:23
                }

            ]

        });


    return buffer;

}