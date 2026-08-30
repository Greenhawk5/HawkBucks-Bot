import fs from "node:fs";
const { parseTtf } = await import("../src/services/pdf.js");
for (const file of ["src/templates/fonts/Inter-Report.ttf", "src/templates/fonts/Sora-Report.ttf"]) {
  const f = parseTtf(new Uint8Array(fs.readFileSync(file)));
  console.log(file, {
    upem: f.unitsPerEm,
    ascender: f.ascender,
    descender: f.descender,
    ascent_per1000: Math.round((f.ascender / f.unitsPerEm) * 1000),
    descent_per1000: Math.round((f.descender / f.unitsPerEm) * 1000),
  });
}