// HawkBucks Admin Report PDF generator.
//
// Cloudflare Worker compatible: no filesystem, no Node streams, no external
// PDF libraries. The PDF byte structure is built directly.
//
// Unicode support: embeds the repository's subsetted Inter (body) and Sora
// (headings) fonts as CIDFontType2 / Identity-H programs, so Latin, Latin
// Extended, Greek and Cyrillic recipient names are preserved glyph-accurately.
// Characters without glyphs in the subset (e.g. Arabic script) render as a
// visible "?" placeholder instead of being silently deleted. Emoji are
// stripped from PDF content by design (the Telegram UI keeps them).
//
// A legacy ASCII/Helvetica path is used only if the embedded font assets
// are unavailable.

import { assets } from "../render/assets-loader.js";

const PAGE_WIDTH = 595.28; // A4
const PAGE_HEIGHT = 841.89;
const MARGIN = 48;
const LINE_HEIGHT = 15;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

const COLORS = {
  ink: "0.082 0.125 0.106",        // dark charcoal-green text (#15201B)
  muted: "0.404 0.443 0.420",      // neutral gray (#676E6B)
  accent: "0.212 0.851 0.494",     // HawkBucks green (#36D97E, from styles.css --accent)
  band: "0.024 0.102 0.043",       // dark forest band (#061A0B, mission header)
  rowAlt: "0.945 0.973 0.957",     // light neutral green tint (#F1F8F4)
  rule: "0.843 0.894 0.859",       // subtle separator (#D7E4DB)
  white: "1 1 1",
};

// Small, per-element Y-axis tuneable offsets (points). These are additive
// adjustments applied to computed baselines to allow tiny visual tuning
// without changing layout, widths, fonts or geometry.
const PDF_Y_OFFSETS = {
  // Start with subtle downward nudges (negative moves text down).
  cardLabel: 0,
  cardValue: -0.36,
  tableHeader: -0.25,
  tableBody: -0.25,
  sectionHeading: 0,
};

// Metric-based vertical placement helpers.
// Uses font metric values produced by `createReportFont`:
//  - `font.ascent` and `font.descent` are in 1/1000 units (PDF-style).
// Convert to points: ascent_pt = (font.ascent / 1000) * fontSize.
// All box coordinates use PDF page space (origin bottom-left). `boxTop`
// is the Y coordinate of the box top edge. `boxHeight` is positive.

// Return the baseline Y that visually centers the glyphs inside the box.
function centerBaselineMetric(font, boxTop, boxHeight, fontSize) {
  const ascentPt = (font.ascent / 1000) * fontSize;
  const descentPt = (font.descent / 1000) * fontSize; // likely negative
  const glyphCenterOffset = (ascentPt + descentPt) / 2; // offset from baseline to glyph center
  // boxBottom = boxTop - boxHeight
  // baseline = boxBottom + boxHeight/2 - glyphCenterOffset
  return boxTop - boxHeight / 2 - glyphCenterOffset;
}

// Compute baseline for first line when a fixed top padding is required.
// Ensures `padding` points of space between box top and the glyph top.
function baselineFromTopPadding(font, boxTop, padding, fontSize) {
  const ascentPt = (font.ascent / 1000) * fontSize;
  // glyphTop = baseline + ascentPt; want glyphTop = boxTop - padding
  return (boxTop - padding) - ascentPt;
}

function dataUriToBytes(dataUri) {
  const base64 = String(dataUri || "").split(",", 2)[1];
  if (!base64) return null;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// ---------- Minimal TrueType parsing (cmap / metrics) ----------

export function parseTtf(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const numTables = view.getUint16(4);
  const tables = {};
  for (let i = 0; i < numTables; i += 1) {
    const off = 12 + i * 16;
    const tag = String.fromCharCode(
      view.getUint8(off), view.getUint8(off + 1), view.getUint8(off + 2), view.getUint8(off + 3)
    );
    tables[tag] = { offset: view.getUint32(off + 8), length: view.getUint32(off + 12) };
  }

  const unitsPerEm = view.getUint16(tables.head.offset + 18);
  const numHMetrics = view.getUint16(tables.hhea.offset + 34);
  const ascender = view.getInt16(tables.hhea.offset + 4);
  const descender = view.getInt16(tables.hhea.offset + 6);

  const advance = (glyphId) => {
    if (!tables.hmtx) return unitsPerEm / 2;
    const index = Math.min(glyphId, numHMetrics - 1);
    return view.getUint16(tables.hmtx.offset + index * 4);
  };

  const glyphMap = new Map();
  if (tables.cmap) {
    const cmapOff = tables.cmap.offset;
    const subtableCount = view.getUint16(cmapOff + 2);
    const candidates = [];
    for (let i = 0; i < subtableCount; i += 1) {
      candidates.push({
        platform: view.getUint16(cmapOff + 4 + i * 8),
        encoding: view.getUint16(cmapOff + 4 + i * 8 + 2),
        offset: cmapOff + view.getUint32(cmapOff + 4 + i * 8 + 4),
      });
    }
    const pick =
      candidates.find((c) => c.platform === 3 && c.encoding === 10) ||
      candidates.find((c) => c.platform === 0 && (c.encoding === 4 || c.encoding === 6)) ||
      candidates.find((c) => c.platform === 3 && c.encoding === 1) ||
      candidates.find((c) => c.platform === 0) ||
      candidates[0];

    if (pick) {
      const format = view.getUint16(pick.offset);
      if (format === 4) {
        const segCountX2 = view.getUint16(pick.offset + 6);
        const segCount = segCountX2 / 2;
        const endBase = pick.offset + 14;
        const startBase = endBase + segCountX2 + 2;
        const deltaBase = startBase + segCountX2;
        const rangeBase = deltaBase + segCountX2;
        for (let seg = 0; seg < segCount; seg += 1) {
          const endCode = view.getUint16(endBase + seg * 2);
          const startCode = view.getUint16(startBase + seg * 2);
          const idDelta = view.getInt16(deltaBase + seg * 2);
          const idRangeOffset = view.getUint16(rangeBase + seg * 2);
          for (let cp = startCode; cp <= endCode && cp !== 0xffff; cp += 1) {
            let gid;
            if (idRangeOffset === 0) {
              gid = (cp + idDelta) & 0xffff;
            } else {
              const glyphOffset = rangeBase + seg * 2 + idRangeOffset + (cp - startCode) * 2;
              gid = view.getUint16(glyphOffset);
              if (gid !== 0) gid = (gid + idDelta) & 0xffff;
            }
            if (gid !== 0) glyphMap.set(cp, gid);
          }
        }
      } else if (format === 12) {
        const numGroups = view.getUint32(pick.offset + 12);
        for (let g = 0; g < numGroups; g += 1) {
          const groupOff = pick.offset + 16 + g * 12;
          const startCp = view.getUint32(groupOff);
          const endCp = view.getUint32(groupOff + 4);
          const startGid = view.getUint32(groupOff + 8);
          for (let cp = startCp; cp <= endCp; cp += 1) {
            glyphMap.set(cp, startGid + (cp - startCp));
          }
        }
      }
    }
  }

  return {
    bytes,
    unitsPerEm,
    ascender,
    descender,
    glyphMap,
    glyphId(cp) { return glyphMap.get(cp) || 0; },
    advance(glyphId) { return advance(glyphId); },
  };
}

// ---------- Report font wrapper (measurement + glyph encoding) ----------

// Characters that must never reach the PDF text layer.
const STRIP_RE = /[\u0000-\u001f\u007f\uFE0F\u200D\u20E3]|[\p{Extended_Pictographic}]|\p{So}/gu;

function sanitizeText(text) {
  return String(text ?? "")
    .replace(STRIP_RE, "")
    .replace(/\s+/g, " ");
}

function createReportFont(ttf) {
  const used = new Map();   // cid -> codepoint (for ToUnicode)
  const cache = new Map();  // codepoint -> cid

  function cidFor(codepoint) {
    if (cache.has(codepoint)) return cache.get(codepoint);
    let gid = ttf.glyphId(codepoint);
    const supported = Boolean(gid);
    if (!gid) gid = ttf.glyphId(0x3f); // visible "?" for unsupported scripts
    const cid = gid;
    used.set(cid, supported ? codepoint : 0x3f);
    cache.set(codepoint, cid);
    return cid;
  }

  return {
    bytes: ttf.bytes,
    ttfAdvance: ttf.advance,
    encodeText(text) {
      let hex = "";
      for (const ch of sanitizeText(text)) {
        hex += hex4(cidFor(ch.codePointAt(0)));
      }
      return hex;
    },
    width(text, size) {
      let units = 0;
      for (const ch of sanitizeText(text)) {
        units += ttf.advance(ttf.glyphId(ch.codePointAt(0)) || ttf.glyphId(0x3f));
      }
      return (units / ttf.unitsPerEm) * size;
    },
    usedEntries: () => [...used.entries()],
    unitsPerEm: ttf.unitsPerEm,
    ascent: Math.round((ttf.ascender / ttf.unitsPerEm) * 1000),
    descent: Math.round((ttf.descender / ttf.unitsPerEm) * 1000),
  };
}

function hex4(n) { return n.toString(16).padStart(4, "0"); }

function wrapByWidth(text, font, size, maxWidth) {
  const words = sanitizeText(text).split(" ").filter(Boolean);
  const lines = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.width(candidate, size) > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

function loadReportFonts() {
  try {
    const interBytes = dataUriToBytes(assets?.fonts?.reportInter);
    const soraBytes = dataUriToBytes(assets?.fonts?.reportSora);
    if (!interBytes || !soraBytes) return null;
    return {
      body: createReportFont(parseTtf(interBytes)),
      heading: createReportFont(parseTtf(soraBytes)),
    };
  } catch (error) {
    console.error("PDF_FONT_LOAD_FAILED", { error: error.message });
    return null;
  }
}

// ---------- Layout engine ----------

function buildUnicodeDocument({ title, subtitle, blocks }, fonts) {
  const pages = [];
  let ops = [];
  let y = PAGE_HEIGHT - MARGIN;

  const newPage = () => { pages.push({ ops }); ops = []; y = PAGE_HEIGHT - MARGIN; };
  const ensure = (h) => { if (y - h < MARGIN + 30) newPage(); };

  // textOp optionally accepts an explicit `y` to override the current cursor.
  const textOp = (text, { font, size, x, color, y: yOverride } = {}) => {
    if (!text) return;
    const hex = font.encodeText(text);
    if (!hex) return;
    const ty = (typeof yOverride === "number") ? yOverride : y;
    ops.push(`q ${color} rg BT /${font.ref} ${size} Tf 1 0 0 1 ${x.toFixed(2)} ${ty.toFixed(2)} Tm <${hex}> Tj ET Q`);
  };

  const rectOp = (color, x, yy, w, h) => {
    ops.push(`q ${color} rg ${x.toFixed(2)} ${yy.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f Q`);
  };

  const rule = (color = COLORS.rule, thickness = 0.8) => {
    rectOp(color, MARGIN, y, CONTENT_WIDTH, thickness);
  };

  // Title block (first page): band + brand + title + subtitle.
  {
    const bandHeight = 86;
    rectOp(COLORS.band, 0, PAGE_HEIGHT - bandHeight, PAGE_WIDTH, bandHeight);
    rectOp(COLORS.accent, 0, PAGE_HEIGHT - bandHeight - 2.5, PAGE_WIDTH, 2.5);
    ops.push(`q ${COLORS.white} rg BT /${fonts.heading.ref} 17 Tf 1 0 0 1 ${MARGIN} ${centerBaselineMetric(fonts.heading, PAGE_HEIGHT, bandHeight, 17).toFixed(2)} Tm <${fonts.heading.encodeText("HAWKBUCKS · ADMIN REPORT")}> Tj ET Q`);
    y = PAGE_HEIGHT - bandHeight - 34;
    textOp(title, { font: fonts.heading, size: 16, x: MARGIN, color: COLORS.ink });
    y -= 20;
    for (const line of wrapByWidth(subtitle, fonts.body, 9.5, CONTENT_WIDTH)) {
      textOp(line, { font: fonts.body, size: 9.5, x: MARGIN, color: COLORS.muted });
      y -= LINE_HEIGHT - 2;
    }
    y -= 4;
    rule(COLORS.accent, 2.5);
    y -= 18;
  }

  for (const block of blocks) {
    switch (block.type) {
      case "heading": {
        y -= 10;
        ensure(LINE_HEIGHT * 2);
        for (const line of wrapByWidth(block.text, fonts.heading, 12.5, CONTENT_WIDTH)) {
          // Use explicit baseline override so we can apply a small visual
          // tuning offset without changing the layout cursor `y`.
          textOp(line, { font: fonts.heading, size: 12.5, x: MARGIN, color: COLORS.ink, y: (y + PDF_Y_OFFSETS.sectionHeading) });
          y -= LINE_HEIGHT;
        }
        rule(COLORS.accent, 1.4);
        y -= 10;
        break;
      }
      case "text": {
        const font = block.bold ? fonts.heading : fonts.body;
        const size = block.bold ? 10.5 : 10;
        for (const line of wrapByWidth(block.text, font, size, CONTENT_WIDTH - (block.indent || 0))) {
          ensure(LINE_HEIGHT);
          textOp(line, { font, size, x: MARGIN + (block.indent || 0), color: block.muted ? COLORS.muted : COLORS.ink });
          y -= LINE_HEIGHT;
        }
        break;
      }
      case "cards": {
        // Compact summary cards: identical dimensions, label and value share
        // fixed baselines so every card aligns on the same grid.
        const count = block.items.length;
        const gap = 8;
        const cardWidth = (CONTENT_WIDTH - gap * (count - 1)) / count;
        const cardHeight = 48;
        ensure(cardHeight + 10);
        const cardTop = y;
        const labelBaseline = baselineFromTopPadding(fonts.body, cardTop, 8, 7.5) + PDF_Y_OFFSETS.cardLabel;
        const valueBaseline = centerBaselineMetric(fonts.heading, cardTop, cardHeight, 15) + PDF_Y_OFFSETS.cardValue;
        block.items.forEach((item, i) => {
          const x = MARGIN + i * (cardWidth + gap);
          rectOp(COLORS.rowAlt, x, cardTop - cardHeight, cardWidth, cardHeight);
          rectOp(COLORS.accent, x, cardTop - cardHeight, 2.5, cardHeight);
          ops.push(`q ${COLORS.muted} rg BT /${fonts.body.ref} 7.5 Tf 1 0 0 1 ${(x + 9).toFixed(2)} ${labelBaseline.toFixed(2)} Tm <${fonts.body.encodeText(sanitizeText(item.label))}> Tj ET Q`);
          ops.push(`q ${COLORS.ink} rg BT /${fonts.heading.ref} 15 Tf 1 0 0 1 ${(x + 9).toFixed(2)} ${valueBaseline.toFixed(2)} Tm <${fonts.heading.encodeText(String(item.value))}> Tj ET Q`);
        });
        y = cardTop - cardHeight - 14;
        break;
      }
      case "table": {
        renderTable(block);
        break;
      }
      case "line": {
        ensure(LINE_HEIGHT);
        rule();
        y -= LINE_HEIGHT;
        break;
      }
      case "space": {
        y -= block.size || LINE_HEIGHT / 2;
        break;
      }
      default:
        break;
    }
  }

  function renderTable(block) {
    const columns = block.columns;
    const totalWeight = columns.reduce((s, c) => s + c.width, 0);
    const widths = columns.map((c) => (c.width / totalWeight) * (CONTENT_WIDTH - 2));
    const pad = 4;
    const size = 8.5;
    const HEADER_H = 18;
    const ROW_H = 18;
    const LINE_STEP = 12;

    const renderHeader = () => {
      ensure(HEADER_H + 8);
      // The header box occupies exactly [y - HEADER_H, y]. No element may
      // extend above it, and the first data row starts 2pt below its bottom.
      const boxTop = y;
      rectOp(COLORS.band, MARGIN, boxTop - HEADER_H, CONTENT_WIDTH, HEADER_H);
      let x = MARGIN + pad;
      columns.forEach((col, i) => {
        const w = widths[i] - pad * 2;
        const line0 = wrapByWidth(columns[i].label, fonts.heading, 8.5, w)[0];
        const baseline = centerBaselineMetric(fonts.heading, boxTop, HEADER_H, 8.5) + PDF_Y_OFFSETS.tableHeader;
        const tx = col.align === "right" ? x + w - fonts.heading.width(line0, 8.5) : x;
        ops.push(`q ${COLORS.white} rg BT /${fonts.heading.ref} 8.5 Tf 1 0 0 1 ${tx.toFixed(2)} ${baseline.toFixed(2)} Tm <${fonts.heading.encodeText(line0)}> Tj ET Q`);
        x += widths[i];
      });
      y = boxTop - HEADER_H - 2; // dataTop: strictly below the header box
    };

    const renderRow = (row, shaded) => {
      const cellLines = row.map((cell, i) =>
        wrapByWidth(cell, fonts.body, size, widths[i] - pad * 2)
      );
      const lineCount = Math.max(...cellLines.map((l) => l.length));
      const rowHeight = ROW_H + (lineCount - 1) * LINE_STEP;
      if (y - rowHeight < MARGIN + 20) {
        newPage();
        renderHeader();
      }
      const rowTop = y;
      if (shaded) rectOp(COLORS.rowAlt, MARGIN, rowTop - rowHeight, CONTENT_WIDTH, rowHeight);
      // Shared first-line baseline for every cell in the row. Use font metrics
      // so the first line respects `pad` spacing from the row top.
      const firstBaseline = baselineFromTopPadding(fonts.body, rowTop, pad, size) + PDF_Y_OFFSETS.tableBody;
      let x = MARGIN + pad;
      columns.forEach((col, i) => {
        const w = widths[i] - pad * 2;
        let baseline = firstBaseline;
        for (const line of cellLines[i]) {
          const tx = col.align === "right" ? x + w - fonts.body.width(line, size) : x;
          // pass explicit y to textOp so each line is placed at its computed baseline
          textOp(line, { font: fonts.body, size, x: tx, color: COLORS.ink, y: baseline });
          baseline -= LINE_STEP;
        }
        x += widths[i];
      });
      y = rowTop - rowHeight;
      rule(COLORS.rule, 0.5);
    };

    ensure(HEADER_H + 8);
    renderHeader();
    block.rows.forEach((row, i) => renderRow(row, i % 2 === 1));
    y -= 12;
  }

  pages.push({ ops });
  return pages;
}

// ---------- Serialization ----------

function buildToUnicodeStream(font) {
  const entries = font.usedEntries();
  const chunks = [];
  for (let i = 0; i < entries.length; i += 100) {
    const slice = entries.slice(i, i + 100);
    const body = slice
      .map(([cid, cp]) => `<${hex4(cid)}> <${hex4(cp).toUpperCase()}>`)
      .join("\n");
    chunks.push(`${slice.length} beginbfchar\n${body}\nendbfchar`);
  }
  return [
    "/CIDInit /ProcSet findresource begin",
    "12 dict begin",
    "begincmap",
    "/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def",
    "/CMapName /Adobe-Identity-UCS def",
    "/CMapType 2 def",
    "1 begincodespacerange",
    "<0000> <ffff>",
    "endcodespacerange",
    ...chunks,
    "endcmap",
    "CMapName currentdict /CMap defineresource pop",
    "end",
    "end",
  ].join("\n");
}

function serializeUnicode({ title, subtitle, pages, fonts }) {
  // IMPORTANT: every piece of text (including page footers) must be encoded
  // BEFORE the font programs are serialized, so /W widths and the ToUnicode
  // CMap cover all used glyphs. Encoding footer text after this point was the
  // root cause of corrupted footer text ("HawŭBucŭs"): late glyphs had no
  // ToUnicode mapping and extractors fell back to raw CIDs.
  const total = pages.length;
  pages.forEach((page, index) => {
    page.ops.push(
      `q ${COLORS.rule} rg ${MARGIN} ${MARGIN - 6} ${CONTENT_WIDTH} 0.8 re f Q`,
      `q ${COLORS.muted} rg BT /${fonts.body.ref} 7.5 Tf 1 0 0 1 ${MARGIN} ${(MARGIN - 18).toFixed(2)} Tm <${fonts.body.encodeText("HawkBucks · Admin Report")}> Tj ET Q`,
      `q ${COLORS.muted} rg BT /${fonts.body.ref} 7.5 Tf 1 0 0 1 ${(PAGE_WIDTH - MARGIN - 90).toFixed(2)} ${(MARGIN - 18).toFixed(2)} Tm <${fonts.body.encodeText(`Page ${index + 1} of ${total}`)}> Tj ET Q`
    );
    if (index > 0) {
      page.ops.push(
        `q ${COLORS.muted} rg BT /${fonts.body.ref} 7.5 Tf 1 0 0 1 ${MARGIN} ${(PAGE_HEIGHT - MARGIN + 14).toFixed(2)} Tm <${fonts.body.encodeText(sanitizeText(title).slice(0, 80))}> Tj ET Q`
      );
    }
  });

  const objects = [];
  const addObject = (body) => { objects.push(body); return objects.length; };

  const fontDefs = {};
  let pageFontResources;
  {
    // Per font: FontFile2 -> descriptor -> CIDFont -> Type0 -> ToUnicode
    const buildFont = (key, font, baseFontName) => {
      const escaped = escapeBinaryStream(font.bytes);
      const fileObj = addObject(
        `<< /Length ${escaped.length} /Length1 ${font.bytes.length} >>\nstream\n${escaped.text}\nendstream`
      );
      const descriptor = addObject(
        `<< /Type /FontDescriptor /FontName /${baseFontName} /Flags 32 /FontBBox [-1000 -1000 2000 2000] ` +
        `/ItalicAngle 0 /Ascent ${font.ascent} /Descent ${font.descent} /CapHeight 700 /StemV 80 /FontFile2 ${fileObj} 0 R >>`
      );
      const wArray = font.usedEntries()
        .map(([cid]) => {
          const gid = cid; // Identity: CID == GID
          const w = Math.round((font.ttfAdvance(gid) / font.unitsPerEm) * 1000);
          return `${cid} [${w}]`;
        })
        .join(" ");
      const cidFont = addObject(
        `<< /Type /Font /Subtype /CIDFontType2 /BaseFont /${baseFontName} ` +
        `/CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> ` +
        `/FontDescriptor ${descriptor} 0 R /DW 600 /W [${wArray}] /CIDToGIDMap /Identity >>`
      );
      const toUnicode = addObject(
        `<< /Length ${buildToUnicodeStream(font).length} >>\nstream\n${buildToUnicodeStream(font)}\nendstream`
      );
      const type0 = addObject(
        `<< /Type /Font /Subtype /Type0 /BaseFont /${baseFontName} /Encoding /Identity-H ` +
        `/DescendantFonts [${cidFont} 0 R] /ToUnicode ${toUnicode} 0 R >>`
      );
      fontDefs[key] = { type0, name: key === "body" ? "/FB" : "/FH" };
    };

    buildFont("body", fonts.body, "Inter-Report");
    buildFont("heading", fonts.heading, "Sora-Report");
    pageFontResources = `<< /Font << ${fontDefs.body.name} ${fontDefs.body.type0} 0 R ${fontDefs.heading.name} ${fontDefs.heading.type0} 0 R >> >>`;
  }

  const catalog = addObject("");
  const pagesTree = addObject("");
  const pageObjNums = [];

  pages.forEach((page, index) => {
    const streamContent = page.ops.join("\n");
    const contentObj = addObject(`<< /Length ${streamContent.length} >>\nstream\n${streamContent}\nendstream`);
    pageObjNums.push(addObject(
      `<< /Type /Page /Parent ${pagesTree} 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] ` +
      `/Resources ${pageFontResources} /Contents ${contentObj} 0 R >>`
    ));
  });

  objects[catalog - 1] = `<< /Type /Catalog /Pages ${pagesTree} 0 R >>`;
  objects[pagesTree - 1] = `<< /Type /Pages /Count ${pageObjNums.length} /Kids [${pageObjNums.map((n) => `${n} 0 R`).join(" ")}] >>`;

  return assemblePdf(objects, catalog);
}

function escapeBinaryStream(bytes) {
  // FontFile2 is a raw binary stream inside `stream ... endstream`. It must
  // be embedded byte-for-byte (no PDF literal-string `\`/`(`/`)` escaping —
  // a stream's binary content is not parsed, only its /Length matters).
  // Escaping here corrupted the SFNT table directory and made renderers
  // report "SFNT font table missing".
  let out = "";
  for (let i = 0; i < bytes.length; i += 1) {
    out += String.fromCharCode(bytes[i]);
  }
  return { text: out, length: bytes.length };
}

function assemblePdf(objects, rootObj) {
  let pdf = "%PDF-1.4\n";
  const offsets = [];
  objects.forEach((body, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${rootObj} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  const bytes = new Uint8Array(pdf.length);
  for (let i = 0; i < pdf.length; i += 1) bytes[i] = pdf.charCodeAt(i) & 0xff;
  return bytes;
}

// ---------- Legacy ASCII fallback (only if font assets are unavailable) ----------

function escapeAscii(text) {
  return String(text ?? "")
    .replace(/[’‘]/g, "'").replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-").replace(/…/g, "...")
    .replace(/\u00a0/g, " ")
    .replace(/[^\x20-\x7E]/g, "?")
    .replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function buildLegacyDocument({ title, subtitle, blocks }) {
  const pages = [];
  let ops = [];
  let y = PAGE_HEIGHT - MARGIN;
  const newPage = () => { pages.push(ops); ops = []; y = PAGE_HEIGHT - MARGIN; };
  const ensure = (h) => { if (y - h < MARGIN + 24) newPage(); };
  const push = (text, size, font) => {
    ensure(size + 4);
    ops.push(`q 0.07 0.09 0.15 rg BT /${font} ${size} Tf 1 0 0 1 ${MARGIN} ${y.toFixed(2)} Tm (${escapeAscii(text)}) Tj ET Q`);
    y -= LINE_HEIGHT;
  };
  push(title, 16, "F2");
  y -= 6;
  if (subtitle) push(subtitle, 9.5, "F1");
  y -= 8;
  for (const block of blocks) {
    if (block.type === "heading") { y -= 8; push(block.text, 12.5, "F2"); y -= 6; }
    else if (block.type === "text") push(block.text, 10, "F1");
    else if (block.type === "line") { ensure(LINE_HEIGHT); ops.push(`q 0.85 0.87 0.9 rg ${MARGIN} ${y} ${CONTENT_WIDTH} 0.8 re f Q`); y -= LINE_HEIGHT; }
    else if (block.type === "space") y -= block.size || LINE_HEIGHT / 2;
    else if (block.type === "table") {
      push(block.columns.map((c) => c.label).join(" | "), 9, "F2");
      block.rows.forEach((row) => push(row.join(" | "), 9, "F1"));
      y -= 8;
    }
    else if (block.type === "cards") block.items.forEach((i2) => push(`${i2.label}: ${i2.value}`, 10, "F1"));
  }
  pages.push(ops);
  const total = pages.length;

  const objects = [];
  const addObject = (body) => { objects.push(body); return objects.length; };
  const f1 = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  const f2 = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
  const catalog = addObject("");
  const pagesTree = addObject("");
  const pageObjNums = [];
  pages.forEach((pageOps, index) => {
    const streamContent = [
      ...pageOps,
      `q 0.42 0.45 0.5 rg BT /F1 7.5 Tf 1 0 0 1 ${MARGIN} ${(MARGIN - 18).toFixed(2)} Tm (${escapeAscii(`HawkBucks · Admin Report — Page ${index + 1} of ${total}`)}) Tj ET Q`,
    ].join("\n");
    const contentObj = addObject(`<< /Length ${streamContent.length} >>\nstream\n${streamContent}\nendstream`);
    pageObjNums.push(addObject(
      `<< /Type /Page /Parent ${pagesTree} 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] ` +
      `/Resources << /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R >> >> /Contents ${contentObj} 0 R >>`
    ));
  });
  objects[catalog - 1] = `<< /Type /Catalog /Pages ${pagesTree} 0 R >>`;
  objects[pagesTree - 1] = `<< /Type /Pages /Count ${pageObjNums.length} /Kids [${pageObjNums.map((n) => `${n} 0 R`).join(" ")}] >>`;
  return assemblePdf(objects, catalog);
}

// ---------- Public API ----------

/**
 * Builds an admin report PDF.
 * Uses embedded Unicode fonts (Inter body / Sora headings) when available;
 * falls back to an ASCII Helvetica document otherwise.
 */
export function buildPdfDocument({ title, subtitle, blocks = [] }) {
  const fonts = loadReportFonts();

  if (fonts) {
    fonts.body.ref = "FB";
    fonts.heading.ref = "FH";
    const pages = buildUnicodeDocument({ title, subtitle, blocks }, fonts);
    return serializeUnicode({ title, subtitle, pages, fonts });
  }

  return buildLegacyDocument({ title, subtitle, blocks });
}





