import { assets } from "./assets-loader.js";
import { getMissionIcon } from "./icon-map.js";
import { groupAndSortMissions } from "../missions/organize.js";

export { groupAndSortMissions };

const CANVAS_WIDTH = 800;

// Futuristic green/teal palette — each zone keeps a unique identity
// while staying inside the main neon-green design language.
const ZONE_THEMES = {
  Stonewood: { start: "#1f7a33", end: "#0d3d1a", accent: "#6ff58a" },
  Plankerton: { start: "#0f6b4f", end: "#07382a", accent: "#4df0c0" },
  "Canny Valley": { start: "#0b6b63", end: "#053a36", accent: "#3fe8d8" },
  "Twine Peaks": { start: "#1a5c2e", end: "#0a2e16", accent: "#a3ff5e" },
};

const DEFAULT_ZONE_THEME = { start: "#1f7a47", end: "#0d3d24", accent: "#74e99b" };

function countMissionZones(missions) {
  return new Set(missions.map((mission) => mission.zone || "Unknown zone")).size;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  })[character]);
}

function pluralise(count, word) {
  return `${count} ${word}${count === 1 ? "" : "S"}`;
}

export function getMissionLayout(missionCount, options) {
  const count = Math.max(1, missionCount);
  const zoneCount = options?.zoneCount ?? count;
  const mode = count >= 7 ? "dense" : count >= 5 ? "expanded" : count >= 2 ? "normal" : "compact";
  const metrics = {
    compact: { regionHeight: 43, panelHeight: 132, sectionGap: 12, cardGap: 16, paddingY: 28, headerHeight: 136, headerGap: 22, footerGap: 20, footerHeight: 24 },
    normal: { regionHeight: 43, panelHeight: 132, sectionGap: 12, cardGap: 16, paddingY: 28, headerHeight: 136, headerGap: 22, footerGap: 20, footerHeight: 24 },
    expanded: { regionHeight: 37, panelHeight: 112, sectionGap: 10, cardGap: 14, paddingY: 26, headerHeight: 122, headerGap: 18, footerGap: 18, footerHeight: 22 },
    dense: { regionHeight: 30, panelHeight: 77, sectionGap: 7, cardGap: 10, paddingY: 22, headerHeight: 108, headerGap: 14, footerGap: 16, footerHeight: 20 },
  }[mode];
  const cardHeight = metrics.regionHeight + metrics.sectionGap + metrics.panelHeight;
  const missionAreaHeight =
    (count * metrics.panelHeight) +
    (zoneCount * (metrics.regionHeight + metrics.sectionGap)) +
    ((count - 1) * metrics.cardGap);
  const contentHeight = metrics.headerHeight + metrics.headerGap + missionAreaHeight + metrics.footerGap + metrics.footerHeight;

  return {
    width: CANVAS_WIDTH,
    mode,
    missionCount: count,
    zoneCount,
    ...metrics,
    cardHeight,
    missionAreaHeight,
    contentHeight,
    canvasHeight: contentHeight + (metrics.paddingY * 2),
  };
}

function missionCard(mission, index, layout, showRibbon, zoneIndex) {
  const type = mission.mission?.type || "Unknown Mission";
  const category = mission.mission?.category || "No category";
  const zone = mission.zone || "Unknown zone";
  const amount = Number(mission.reward?.amount || 0);
  const power = Number(mission.powerLevel || 0);
  const icon = getMissionIcon(type, category);
  const theme = ZONE_THEMES[zone] || DEFAULT_ZONE_THEME;

  // تغییرات: ساختار HTML برای قرار گرفتن دقیق POWER زیر آیکون صاعقه اصلاح شد
  return `
    <article class="mission-card${showRibbon ? " has-zone-ribbon" : ""}" style="--zone-start:${theme.start};--zone-end:${theme.end};--zone-accent:${theme.accent}">
      ${showRibbon ? `<div class="zone-ribbon">
        <span class="zone-name">${escapeHtml(zone)}</span>
        <span class="zone-count">${String(zoneIndex + 1).padStart(2, "0")}</span>
      </div>` : ""}
      <div class="mission-panel">
        <div class="mission-icon-wrap"><img class="mission-icon" src="${icon}" alt="" /></div>
        <div class="mission-copy">
          <h2>${escapeHtml(type)}</h2>
          <span class="category-tag">${escapeHtml(category)}</span>
        </div>
        <div class="mission-rail">
          <div class="power-level">
            <span class="power-number">${power}</span>
            <span class="power-divider" aria-hidden="true"></span>
            <div class="power-info">
              <img src="${assets.power}" alt="" />
              <small>POWER</small>
            </div>
          </div>
          <div class="reward"><span>${amount}</span><img src="${assets.vbucks}" alt="" /></div>
        </div>
      </div>
    </article>`;
}

function getStyles(layout) {
  const dense = layout.mode === "dense";
  const denseValue = (val) => dense ? val : null;

  return `
    @font-face {
      font-family: Sora;
      src: url("${assets.fonts.sora}") format("truetype");
      font-weight: 100 800;
      font-display: block;
    }

    @font-face {
      font-family: Inter;
      src: url("${assets.fonts.inter}") format("truetype");
      font-weight: 100 900;
      font-display: block;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    html,
    body {
      width: ${layout.width}px;
      height: ${layout.canvasHeight}px;
      background: #061a0b;
    }

    body {
      color: #fff;
      font-family: Inter, Arial, sans-serif;
      -webkit-font-smoothing: antialiased;
    }

    .canvas {
      position: relative;
      isolation: isolate;
      width: ${layout.width}px;
      height: ${layout.canvasHeight}px;
      overflow: hidden;
      padding: ${layout.paddingY}px 30px;
      background: 
        radial-gradient(540px 260px at 76% 0%, rgba(107, 232, 100, .2), transparent 74%),
        radial-gradient(500px 230px at 5% 78%, rgba(95, 212, 122, .12), transparent 73%),
        linear-gradient(135deg, #061a0b 0%, #103d18 48%, #174d22 100%);
    }

    .canvas:before {
      content: "";
      position: absolute;
      z-index: -1;
      inset: 0;
      opacity: .36;
      background-image: 
        linear-gradient(32deg, rgba(188, 255, 191, .075) 12%, transparent 12.5%, transparent 87%, rgba(188, 255, 191, .055) 87.5%),
        linear-gradient(148deg, rgba(188, 255, 191, .055) 12%, transparent 12.5%, transparent 87%, rgba(188, 255, 191, .04) 87.5%);
      background-size: 156px 156px;
    }

    .canvas:after {
      content: "";
      position: absolute;
      z-index: -1;
      inset: 10px;
      border: 2px solid rgba(170, 255, 181, .76);
      border-radius: 26px;
      box-shadow: 
        inset 0 0 25px rgba(91, 255, 120, .09),
        0 0 22px rgba(63, 239, 102, .18);
    }

    .content {
      height: 100%;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }

    .hero {
      height: ${layout.headerHeight}px;
      display: grid;
      grid-template-columns: 1fr auto;
      grid-template-rows: auto 1fr;
      column-gap: 16px;
      align-items: center;
      border-bottom: 2px solid rgba(164, 255, 177, .25);
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 14px;
    }

    .brand img {
      width: ${denseValue(48) || 62}px;
      height: ${denseValue(48) || 62}px;
      border-radius: 50%;
      object-fit: cover;
      box-shadow: 
        0 0 16px rgba(103, 255, 121, .86),
        0 8px 20px rgba(0, 0, 0, .38);
    }

    .eyebrow {
      font-family: Sora, Arial, sans-serif;
      font-size: ${denseValue(25) || 31}px;
      line-height: 1;
      font-weight: 800;
      letter-spacing: -.045em;
      text-transform: uppercase;
      text-shadow: 0 3px 3px rgba(0, 0, 0, .38);
    }

    .title {
      margin-top: 4px;
      font-family: Sora, Arial, sans-serif;
      font-size: ${denseValue(16) || 20}px;
      line-height: 1;
      font-weight: 800;
      letter-spacing: .015em;
      color: #a8ef64;
      text-transform: uppercase;
      text-shadow: 0 2px 2px rgba(0, 0, 0, .34);
    }

    .date {
      grid-column: 1 / -1;
      align-self: end;
      padding-bottom: 10px;
      font-family: Sora, Arial, sans-serif;
      font-size: ${denseValue(11) || 14}px;
      font-weight: 800;
      letter-spacing: .055em;
      color: #f1fff0;
      text-transform: uppercase;
    }

    .total {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 16px;
      min-width: ${denseValue(138) || 180}px;
      min-height: ${denseValue(56) || 76}px;
      padding: 7px 15px 7px 9px;
      background: linear-gradient(135deg, rgba(120, 255, 127, .18), rgba(22, 67, 33, .5));
      border: 2px solid rgba(163, 255, 172, .78);
      border-radius: 17px;
      box-shadow: 
        inset 0 1px rgba(255, 255, 255, .24),
        0 0 18px rgba(88, 255, 119, .22);
    }

    .total img {
      width: ${denseValue(42) || 60}px;
      height: ${denseValue(42) || 60}px;
      flex: none;
      filter: drop-shadow(0 0 8px rgba(137, 255, 153, .75));
    }
    
    .total-text-wrap {
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: flex-start;
    }

    .total span {
      display: block;
      font-family: Sora, Arial, sans-serif;
      font-size: ${denseValue(26) || 36}px;
      font-weight: 800;
      color: #6cff78;
      line-height: 1;
    }

    .total small {
      display: block;
      margin-top: 4px;
      font-size: ${denseValue(7) || 9}px;
      font-weight: 800;
      letter-spacing: .08em;
      color: #e8ffe8;
      line-height: 1.15;
      text-transform: uppercase;
    }

    .missions {
      display: flex;
      flex-direction: column;
      gap: ${layout.cardGap}px;
      margin-top: ${layout.headerGap}px;
    }

    .mission-card {
      height: ${layout.panelHeight}px;
      display: flex;
      flex-direction: column;
    }

    .mission-card.has-zone-ribbon {
      height: ${layout.cardHeight}px;
    }

    .zone-ribbon {
      height: ${layout.regionHeight}px;
      flex: none;
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
      padding: 0 17px 0 20px;
      background: linear-gradient(90deg, var(--zone-start), var(--zone-end));
      border: 2px solid rgba(190, 255, 191, .82);
      border-left: 7px solid var(--zone-accent);
      border-radius: 14px;
      box-shadow: 
        0 0 14px rgba(100, 255, 128, .32),
        inset 0 1px rgba(255, 255, 255, .2);
    }

    .zone-name {
      font-family: Sora, Arial, sans-serif;
      font-size: ${denseValue(16) || 21}px;
      font-weight: 800;
      line-height: 1;
      text-transform: uppercase;
      letter-spacing: -.025em;
      text-shadow: 0 2px 2px rgba(0, 0, 0, .4);
      transform: translateY(2px);
    }

    .zone-count {
      font-family: Sora, Arial, sans-serif;
      font-size: ${denseValue(12) || 16}px;
      font-weight: 800;
    }

    .mission-panel {
      position: relative;
      height: ${layout.panelHeight}px;
      flex: none;
      display: grid;
      grid-template-columns: ${denseValue(54) || 76}px 1fr ${denseValue(84) || 108}px;
      align-items: center;
      gap: ${denseValue(8) || 13}px;
      padding: 9px 15px;
      background: linear-gradient(100deg, rgba(22, 74, 34, .78), rgba(26, 93, 48, .62) 48%, rgba(12, 58, 38, .88) 100%);
      border: 2px solid rgba(181, 255, 181, .84);
      border-left: 7px solid #b7ff6a;
      border-radius: 17px;
      box-shadow: 
        0 0 18px rgba(99, 255, 115, .45),
        inset 0 1px rgba(255, 255, 255, .18),
        0 10px 18px rgba(0, 0, 0, .28);
    }

    .mission-panel:after {
      content: "";
      position: absolute;
      inset: 0;
      pointer-events: none;
      background: radial-gradient(200px 90px at 82% 55%, rgba(104, 255, 153, .12), transparent 72%);
    }

    .mission-icon-wrap {
      position: relative;
      z-index: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      width: ${denseValue(46) || 68}px;
      height: ${denseValue(46) || 68}px;
      border-radius: 18px;
      background: linear-gradient(145deg, rgba(112, 255, 126, .16), rgba(3, 32, 12, .64));
      border: 1px solid rgba(100, 255, 120, .65);
      box-shadow: inset 0 0 16px rgba(112, 255, 126, .12);
    }

    .mission-icon {
      width: ${denseValue(38) || 55}px;
      height: ${denseValue(38) || 55}px;
      object-fit: contain;
      filter: drop-shadow(0 4px 4px rgba(0, 0, 0, .45));
    }

    .mission-copy {
      position: relative;
      z-index: 1;
      min-width: 0;
      align-self: center;
    }

    .mission-copy h2 {
      font-family: Sora, Arial, sans-serif;
      font-size: ${denseValue(15) || 22}px;
      line-height: 1.08;
      font-weight: 800;
      letter-spacing: -.035em;
      text-transform: uppercase;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      text-shadow: 0 2px 2px rgba(0, 0, 0, .55);
    }

    .category-tag {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      max-width: 100%;
      margin-top: 7px;
      padding: 5px 8px 3px; 
      border: 2px solid #6cff78;
      border-radius: 7px;
      background: rgba(12, 66, 25, .72);
      color: #f0fff0;
      font-family: Sora, Arial, sans-serif;
      font-size: ${denseValue(8) || 11}px;
      line-height: normal;
      font-weight: 800;
      letter-spacing: .04em;
      text-transform: uppercase;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .mission-rail {
      position: relative;
      z-index: 2;
      align-self: stretch;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: ${denseValue(7) || 10}px;
      min-width: ${denseValue(64) || 84}px;
    }

    .expanded .reward,
    .dense .reward {
      transform: translateY(-5px);
    }

    /* Fixed-layout power section: number grows leftward, icon/POWER stay fixed */
    .power-level {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: ${denseValue(6) || 10}px;
      width: 100%;
      color: #f1fff0;
      text-shadow: 0 2px 2px rgba(0, 0, 0, .45);
      margin-right: 15px; 
    }

    /* Fixed-width, right-aligned slot: 1/2/3-digit numbers expand leftward only */
    .power-number {
      width: ${denseValue(46) || 62}px;
      flex: none;
      text-align: right;
      font-family: Sora, Arial, sans-serif;
      font-size: ${denseValue(20) || 32}px;
      font-weight: 800;
      line-height: 1;
    }

    .power-divider {
      display: block;
      width: 1px;
      height: ${denseValue(34) || 48}px;
      flex: none;
      background: rgba(220, 255, 221, .46);
    }

    /* Fixed slot for lightning icon with POWER label directly below */
    .power-info {
      width: ${denseValue(30) || 42}px;
      flex: none;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }

    .power-info img {
      width: ${denseValue(24) || 36}px;
      height: ${denseValue(24) || 36}px;
      object-fit: contain;
    }

    .power-info small {
      margin-top: ${denseValue(2) || 4}px;
      font-family: Inter, Arial, sans-serif;
      font-size: ${denseValue(6) || 9}px;
      letter-spacing: .1em;
      color: #bdfbc7;
      text-transform: uppercase;
    }

    .reward {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 5px;
      min-width: ${denseValue(50) || 70}px;
      padding: 3px 5px 3px 8px;
      border: 1px solid rgba(108, 255, 120, .84);
      border-radius: 8px;
      background: rgba(3, 38, 14, .58);
      box-shadow: 
        0 0 9px rgba(96, 255, 116, .22),
        inset 0 1px rgba(255, 255, 255, .12);
    }

    .reward img {
      width: ${denseValue(20) || 27}px;
      height: ${denseValue(20) || 27}px;
    }

    .reward span {
      font-family: Sora, Arial, sans-serif;
      font-size: ${denseValue(14) || 20}px;
      font-weight: 800;
      line-height: 1;
      color: #effff1;
      transform: translateY(1px);
    }

    .footer {
      height: ${layout.footerHeight}px;
      margin-top: ${layout.footerGap}px;
      display: flex;
      align-items: flex-end;
      justify-content: flex-start;
      font-size: ${denseValue(12) || 15}px;
      font-weight: 800;
      letter-spacing: .01em;
      color: #6cff78;
    }
  `;
}

export function buildMissionCards(missions, layout = getMissionLayout(missions.length)) {
  const orderedMissions = groupAndSortMissions(missions);
  let previousZone;
  let zoneIndex = -1;

  return orderedMissions.map((mission, index) => {
    const zone = mission.zone || "Unknown zone";
    const showRibbon = zone !== previousZone;
    if (showRibbon) zoneIndex += 1;
    previousZone = zone;
    return missionCard(mission, index, layout, showRibbon, zoneIndex);
  }).join("\n");
}

export function buildMissionDocument(data) {
  const missions = groupAndSortMissions(data.missions);
  const layout = getMissionLayout(missions.length, { zoneCount: countMissionZones(missions) });
  const totalVbucks = data.totalVbucks ?? missions.reduce((total, mission) => total + Number(mission.reward?.amount || 0), 0);
  
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=${layout.width},initial-scale=1"><title>HawkBucks Mission Board</title><style>${getStyles(layout)}</style></head><body><main class="canvas ${layout.mode}"><div class="content"><header class="hero"><div class="brand"><img src="${assets.logo}" alt="HawkBucks"><div><div class="eyebrow">Save The World</div><h1 class="title">V-Bucks Missions</h1></div></div><div class="total"><img src="${assets.vbucks}" alt=""><div class="total-text-wrap"><span>${escapeHtml(totalVbucks)}</span><small>Total V-Bucks</small></div></div><p class="date">${escapeHtml(data.date || "Today's mission board")} &middot; ${pluralise(missions.length, "MISSION")}</p></header><section class="missions" aria-label="V-Buck missions">${buildMissionCards(missions, layout)}</section><footer class="footer"><span>@HawkBucks_bot</span></footer></div></main></body></html>`;

  return { html, layout };
}

export function buildMissionHTML(data) {
  return buildMissionDocument(data).html;
}