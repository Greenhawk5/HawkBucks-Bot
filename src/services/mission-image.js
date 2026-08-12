import { buildMissionDocument } from "./renderer.js";
import { generateScreenshot } from "./screenshot.js";


export async function generateMissionImage(
    missions,
    env
) {


    if (!missions || missions.length === 0) {
        return null;
    }


    const data = {

        date: new Intl.DateTimeFormat("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
            timeZone: "UTC"
        }).format(new Date()),


        totalVbucks:
            missions.reduce(
                (sum, mission)=>
                    sum + mission.reward.amount,
                0
            ),


        missions

    };



    const { html, layout } = buildMissionDocument(data);



    return await generateScreenshot(html, env, layout);

}
