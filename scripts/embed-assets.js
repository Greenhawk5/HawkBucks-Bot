import fs from "fs";
import path from "path";

const root = "./src/templates";


function encode(file) {
    const buffer = fs.readFileSync(file);
    const mime = file.endsWith(".ttf") ? "font/ttf" : "image/png";
    return `data:${mime};base64,${buffer.toString("base64")}`;
}


const assets = {
    logo: encode(`${root}/logo.png`),
    vbucks: encode(`${root}/vbucks.png`),
    power: encode(`${root}/power.png`),
    noMission: encode(`${root}/no-mission.png`),
    fonts: {
        inter: encode(`${root}/fonts/Inter.ttf`),
        sora: encode(`${root}/fonts/Sora.ttf`)
    },

    missions: {}
};


const missionDir = `${root}/missions`;

for (const file of fs.readdirSync(missionDir)) {

    if (!file.endsWith(".png"))
        continue;


    const name = file.replace(".png", "");

    assets.missions[name] =
        encode(
            path.join(
                missionDir,
                file
            )
        );
}


fs.writeFileSync(
    "./src/render/generated-assets.js",
    `export const assets = ${JSON.stringify(assets)}`
);


console.log("Assets embedded successfully");
