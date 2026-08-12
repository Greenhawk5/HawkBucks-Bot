// Compatibility facade: the Worker image service imports from here.
// Do not load local HTML/CSS files here; ScreenshotOne only receives the
// returned self-contained document and has no access to the Worker filesystem.
export {
  buildMissionCards,
  buildMissionDocument,
  buildMissionHTML,
  getMissionLayout,
} from "../render/template-builder.js";
