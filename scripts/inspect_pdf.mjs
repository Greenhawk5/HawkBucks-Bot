import fs from 'node:fs';

function parsePdfBytes(pdfBytes) {
  const raw = Buffer.from(pdfBytes).toString('latin1');
  const streams = [...raw.matchAll(/stream\n([\s\S]*?)\nendstream/g)].map(m => m[1]);
  // pick page content stream that contains the header band color or text operators
  const page = streams.find(s => s.includes('0.024 0.102 0.043') && s.includes('Tm')) || streams.find(s => s.includes('Tm')) || streams[0];
  return { raw, page };
}

function findRects(page) {
  const rects = [...page.matchAll(/([\d.]+) ([\d.]+) ([\d.]+) rg ([\d.]+) ([\d.]+) ([\d.]+) ([\d.]+) re f/g)].map(m=>({
    color: `${m[1]} ${m[2]} ${m[3]}`,
    x: Number(m[4]), y: Number(m[5]), w: Number(m[6]), h: Number(m[7]),
    top: Number(m[5]) + Number(m[7]), bottom: Number(m[5])
  }));
  return rects;
}

function findTexts(page) {
  const texts = [...page.matchAll(/q ([\d.]+) ([\d.]+) ([\d.]+) rg BT \/(\w+) ([\d.]+) Tf 1 0 0 1 ([\d.]+) ([\d.]+) Tm/g)].map(m=>({
    color: `${m[1]} ${m[2]} ${m[3]}`,
    font: m[4], size: Number(m[5]), x: Number(m[6]), baseline: Number(m[7])
  }));
  return texts;
}

function findFontDescriptors(raw) {
  const descs = [];
  // Find FontDescriptor objects: look for "/FontDescriptor" then /Ascent and /Descent nearby
  for (const m of raw.matchAll(/<<[\s\S]*?\/FontDescriptor[\s\S]*?>>/g)) {
    const block = m[0];
    const a = (/\/Ascent\s+(-?\d+)/.exec(block) || [null, null])[1];
    const d = (/\/Descent\s+(-?\d+)/.exec(block) || [null, null])[1];
    if (a !== null && d !== null) descs.push({ ascent: Number(a), descent: Number(d), block });
  }
  // fallback: global search
  if (descs.length === 0) {
    const am = [...raw.matchAll(/\/Ascent\s+(-?\d+)/g)].map(m=>Number(m[1]));
    const dm = [...raw.matchAll(/\/Descent\s+(-?\d+)/g)].map(m=>Number(m[1]));
    for (let i=0;i<Math.min(am.length, dm.length);i++) descs.push({ascent:am[i], descent:dm[i]});
  }
  return descs;
}

function inspect(pdfPath) {
  const bytes = fs.readFileSync(pdfPath);
  const { raw, page } = parsePdfBytes(bytes);
  const rects = findRects(page);
  const texts = findTexts(page);
  const descs = findFontDescriptors(raw);
  return { rects, texts, descs, page };
}

function measureForReport(pdfPath) {
  const { rects, texts, descs, page } = inspect(pdfPath);
  console.log('\n===', pdfPath, '===');
  console.log('FontDescriptors found:', descs.length);
  descs.forEach((d,i)=>console.log(`  FD ${i}: ascent=${d.ascent}, descent=${d.descent}`));

  // table header rect: band color with header-like height (approx 10-30)
  const band = rects.find(r => r.color === '0.024 0.102 0.043' && r.h > 10 && r.h < 30) || rects.find(r => r.color === '0.024 0.102 0.043') || rects[0];
  if (band) console.log('band rect:', band);

  // header texts (heading font FH size 8.5)
  const headerTexts = texts.filter(t => t.font === 'FH' && Math.abs(t.size - 8.5) < 0.1);
  console.log('headerTexts count:', headerTexts.length);
  headerTexts.slice(0,6).forEach((t,i)=>console.log(`  header[${i}] font=${t.font} size=${t.size} x=${t.x} baseline=${t.baseline}`));

  // body texts FB size 8.5
  const bodyTexts = texts.filter(t => t.font === 'FB' && Math.abs(t.size - 8.5) < 0.1);
  console.log('bodyTexts count:', bodyTexts.length);
  bodyTexts.slice(0,6).forEach((t,i)=>console.log(`  body[${i}] font=${t.font} size=${t.size} x=${t.x} baseline=${t.baseline}`));

  // card values: heading font size 15 (FH)
  const cardVals = texts.filter(t => t.font === 'FH' && Math.abs(t.size - 15) < 0.1);
  console.log('card values count:', cardVals.length);
  cardVals.forEach((t,i)=>console.log(`  cardVal[${i}] font=${t.font} size=${t.size} x=${t.x} baseline=${t.baseline}`));

  // take one header rect and nearest header text to compute glyph metrics
  if (band && headerTexts.length && descs.length) {
    const hRect = band;
    const ht = headerTexts[0];
    const ascent = descs[0].ascent; const descent = descs[0].descent;
    const fontSize = ht.size;
    const ascentPt = (ascent/1000) * fontSize;
    const descentPt = (descent/1000) * fontSize;
    const glyphTop = ht.baseline + ascentPt;
    const glyphBottom = ht.baseline + descentPt; // descentPt may be negative
    const glyphCenter = (glyphTop + glyphBottom)/2;
    const boxCenter = (hRect.top + hRect.bottom)/2;
    console.log('\nHeader geometry numbers:');
    console.log('  headerBoxTop', hRect.top, 'headerBoxBottom', hRect.bottom, 'headerBoxCenter', boxCenter);
    console.log('  headerTextBaseline', ht.baseline);
    console.log('  ascentPt', ascentPt.toFixed(3), 'descentPt', descentPt.toFixed(3));
    console.log('  glyphTop', glyphTop.toFixed(3), 'glyphBottom', glyphBottom.toFixed(3), 'glyphCenter', glyphCenter.toFixed(3));
    console.log('  glyphCenter - boxCenter =', (glyphCenter - boxCenter).toFixed(3));
  }

  // For card value metrics if present
  if (cardVals.length && descs.length) {
    const cv = cardVals[0];
    const ascent = descs[0].ascent; const descent = descs[0].descent;
    const ascentPt = (ascent/1000)*cv.size;
    const descentPt = (descent/1000)*cv.size;
    const glyphTop = cv.baseline + ascentPt;
    const glyphBottom = cv.baseline + descentPt;
    console.log('\nCard value geometry:');
    console.log('  baseline', cv.baseline);
    console.log('  ascentPt', ascentPt.toFixed(3), 'descentPt', descentPt.toFixed(3));
    console.log('  glyphTop', glyphTop.toFixed(3), 'glyphBottom', glyphBottom.toFixed(3));
    // find card rect (rowAlt color, height ~48)
    const cardRect = rects.find(r => r.color === '0.945 0.973 0.957' && Math.abs(r.h - 48) < 1);
    if (cardRect) {
      const cardCenter = (cardRect.top + cardRect.bottom)/2;
      const glyphCenterCv = (glyphTop + glyphBottom)/2;
      console.log('  cardRect:', cardRect);
      console.log('  glyphCenter', glyphCenterCv.toFixed(3), 'cardCenter', cardCenter.toFixed(3), 'diff', (glyphCenterCv - cardCenter).toFixed(3));
      // find the label (body font 7.5) near the same card x
      const label = texts.find(t => t.font === 'FB' && Math.abs(t.size - 7.5) < 0.1 && Math.abs(t.x - cv.x) < 10);
      if (label) {
        const la = descs[0].ascent; const ld = descs[0].descent;
        const laPt = (la/1000)*label.size; const ldPt = (ld/1000)*label.size;
        const labGlyphTop = label.baseline + laPt; const labGlyphBottom = label.baseline + ldPt;
        const labCenter = (labGlyphTop + labGlyphBottom)/2;
        console.log('  cardLabel baseline', label.baseline, 'glyphCenter', labCenter.toFixed(3), 'cardCenter', cardCenter.toFixed(3), 'diff', (labCenter - cardCenter).toFixed(3));
      }
    }
  }

  // Verify that the page stream contains Tm values equal to the baselines we reported
    // Verify that the page stream contains Tm values equal to the baselines we reported
    // (i.e., Tm contains the baseline Y number somewhere) for key text items.
    console.log('\nTm presence checks:');
    const checkItems = [];
    if (headerTexts.length) checkItems.push({label:'header',x:headerTexts[0].x,y:headerTexts[0].baseline});
    if (bodyTexts.length) checkItems.push({label:'firstBody',x:bodyTexts[0].x,y:bodyTexts[0].baseline});
    if (cardVals.length) checkItems.push({label:'cardVal',x:cardVals[0].x,y:cardVals[0].baseline});
    for (const it of checkItems) {
      const pat = `${it.x.toFixed(2)} ${it.y.toFixed(2)} Tm`;
      const found = page.includes(pat);
      console.log(`  ${it.label}: searching for '${pat}' => ${found ? 'FOUND' : 'MISSING'}`);
    }
    const tmLines = page.split('\n').filter(l => l.includes('Tm')).slice(0,12);
    console.log('\nSample Tm lines:');
    tmLines.forEach((l,i)=>console.log(`  Tm[${i}] ${l.slice(0,240)}`));
}

// Run inspection for both generated PDFs and for provided original PDFs if present
const toCheck = [
  'usage-diagnostic.pdf',
  'active-reminders-diagnostic.pdf',
  'hawkbucks-usage-last-12-months.pdf',
  'hawkbucks-active-reminders (1).pdf'
];
for (const p of toCheck) {
  if (fs.existsSync(p)) measureForReport(p);
  else console.log('\nMissing:', p);
}

console.log('\nDone inspection.');
