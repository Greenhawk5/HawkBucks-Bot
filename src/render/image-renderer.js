import { buildMissionTemplate } from "./template-builder.js";


export async function renderMissionImage(data) {

    const html = buildMissionTemplate(data);


    const response = await fetch(
        RENDER_SERVICE_URL,
        {
            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                html,
                width:1080,
                height:1620
            })
        }
    );


    if (!response.ok) {
        throw new Error(
            `Renderer failed: ${response.status}`
        );
    }


    return await response.arrayBuffer();
}