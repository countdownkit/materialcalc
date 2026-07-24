/*
 * Static long-tail page generator for the material-calculators site.
 * Run: node generate.js   ->   writes everything into ./public
 *
 * Page families produced:
 *   /<material>-calculator/                  interactive calculator per material
 *   /<material>-for-<A>-square-feet/         pre-computed answer pages (bulk + area materials)
 *   /concrete-for-a-<LxW>-slab/              pre-computed concrete slab pages
 *   /paint-for-a-<LxW>-room/                 pre-computed paint pages
 *   /                                        homepage linking everything
 */
const fs = require("fs");
const path = require("path");

// ---- config -------------------------------------------------------------
const DOMAIN = process.env.DOMAIN || "https://materials.elevatedprogress.com";
const BASE = process.env.BASE || "";
const SITE = "Material Calculators";
const OUT = path.join(__dirname, "public");
const ASSETS = path.join(__dirname, "assets");
const DATA = JSON.parse(fs.readFileSync(path.join(__dirname, "data", "materials.json"), "utf8"));

const AREAS = DATA.areas;

// ---- math ---------------------------------------------------------------
const r1 = n => Math.round(n * 10) / 10;
const r2 = n => Math.round(n * 100) / 100;
function yd(n) { return n < 10 ? r2(n) : r1(n); } // cubic-yard display precision
function bulkFor(area, depthIn, mat) {
  const cuft = area * depthIn / 12;
  const cuyd = cuft / 27;
  return {
    cuft: Math.round(cuft * 10) / 10,
    cuyd: yd(cuyd),
    bags: Math.ceil(cuft / mat.bagCuFt),
    tons: r2(cuyd * mat.lbsPerCuYd / 2000),
  };
}
function concreteFor(L, W, thickIn) {
  const cuft = L * W * thickIn / 12;
  const cuyd = cuft / 27;
  return {
    cuyd: yd(cuyd),
    order: yd(cuyd * 1.1),
    bags80: Math.ceil(cuft / 0.6),
    bags60: Math.ceil(cuft / 0.45),
  };
}
function paintFor(L, W) {
  const wall = Math.max(2 * (L + W) * 8 - 40, 0); // 8 ft ceilings, minus one door + one window
  return {
    wall,
    gal1: r1(wall / 350),
    gal2: r1(wall * 2 / 350),
    buy2: Math.ceil(wall * 2 / 350),
    ceilGal: r1(L * W / 350),
  };
}
const sodFor = a => ({ rolls: Math.ceil(a * 1.05 / 10), pallets: r1(a / 450) });
const tileFor = (a, size) => Math.ceil(a * 1.1 / size);
const paverFor = (a, per) => Math.ceil(a * 1.05 * per);

// ---- sizing math (keep in sync with assets/tool.js) ----------------------
// Generator: running total + the single largest start-up surge determines peak.
function gensetFor(keys) {
  const sel = DATA.appliances.filter(a => keys.includes(a.key));
  const running = sel.reduce((s, a) => s + a.run, 0);
  const surge = Math.max(0, ...sel.map(a => Math.max(0, a.start - a.run)));
  const peak = running + surge;
  const size = DATA.generatorSizes.find(s => s >= peak * 1.1);
  return { running, peak, size, standby: !size || peak > 9500 };
}
// Central AC scaled by house size for the preset generator pages (≈1 ton per 600 sq ft).
function cenacFor(sqft) {
  const tons = Math.min(5, Math.max(2, Math.round(sqft / 600)));
  return { tons, run: 1200 * tons, start: 3000 * tons };
}
// AC: Energy Star area table ±10% for sun/shade, +4,000 BTU kitchens, +600/person over two.
function btuFor(area, sun = "average", kitchen = false, people = 2) {
  const row = DATA.btuTable.find(([max]) => area <= max) || DATA.btuTable[DATA.btuTable.length - 1];
  let btu = row[1];
  if (sun === "sunny") btu *= 1.1;
  if (sun === "shaded") btu *= 0.9;
  if (kitchen) btu += 4000;
  btu += Math.max(0, people - 2) * 600;
  return Math.round(btu / 500) * 500;
}
// Ceiling fan: blade span by room area (industry chart), downrod by ceiling height.
function fanFor(area, ceilH = 8) {
  const span = area <= 75 ? "29–36 in" : area <= 144 ? "36–42 in" : area <= 225 ? "44–50 in"
    : area <= 400 ? "50–54 in" : "56–72 in (or two fans)";
  const rod = ceilH <= 8 ? "flush mount (hugger)" : ceilH === 9 ? "6 in downrod"
    : ceilH === 10 ? "12 in downrod" : ceilH <= 12 ? "24 in downrod" : "36 in or longer downrod";
  return { span, rod, cfm: Math.round(area * 35 / 100) * 100 };
}

// ---- html layout --------------------------------------------------------
function layout({ title, desc, urlPath, h1, hero, body, useTool }) {
  const canonical = DOMAIN + BASE + urlPath;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<meta name="description" content="${desc}">
<link rel="canonical" href="${canonical}">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${desc}">
<meta property="og:type" content="website">
<link rel="stylesheet" href="${BASE}/styles.css">
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-5580575158570188" crossorigin="anonymous"></script>
<script async src="https://www.googletagmanager.com/gtag/js?id=G-TJY4TRRKD6"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','G-TJY4TRRKD6');</script>
</head>
<body>
<header class="site-head"><div class="wrap">
  <a class="brand" href="${BASE}/">🧱 ${SITE}</a>
  <nav class="nav"><a href="${BASE}/#calculators">All Calculators</a></nav>
</div></header>
<main class="wrap">
  <div class="crumbs"><a href="${BASE}/">Home</a> ›&nbsp;${h1}</div>
  <h1>${h1}</h1>
  ${hero || ""}
  <div class="ad-slot">Advertisement</div>
  ${body}
  <div class="ad-slot">Advertisement</div>
</main>
<footer class="site-foot"><div class="wrap">
  <a href="${BASE}/">Home</a><a href="${BASE}/#calculators">All Calculators</a>
  <span>· ${SITE} — free how-much-do-I-need calculators for home &amp; yard projects. Estimates only; confirm coverage with your supplier. Part of <a href="https://elevatedprogress.com/">Elevated Progress</a>. · <a href="https://elevatedprogress.com/privacy/">Privacy Policy</a></span>
</div></footer>
${useTool ? `<script src="${BASE}/tool.js" defer></script>` : ""}
</body>
</html>`;
}
function answerHero(big, unit, sub) {
  return `<div class="answer">
  <div class="big-num">${big}<span class="unit">${unit}</span></div>
  <div class="sub">${sub}</div>
</div>`;
}
function grid(links) {
  return `<div class="grid">` + links.map(l =>
    `<a href="${BASE}${l.href}">${l.emoji ? `<span class="chip-emoji">${l.emoji}</span>` : ""}${l.label}</a>`).join("") + `</div>`;
}
function table(head, rows) {
  return `<div class="tbl-wrap"><table class="tbl"><thead><tr>${head.map(h => `<th>${h}</th>`).join("")}</tr></thead>
<tbody>${rows.map(r => `<tr>${r.map((c, i) => `<t${i ? "d" : "d"}>${c}</td>`).join("")}</tr>`).join("\n")}</tbody></table></div>`;
}
function toolBox(type, config, fields) {
  return `<div class="tool" data-calc="${type}" data-config='${JSON.stringify(config)}'>
  ${fields}
  <div class="tool-out" data-out></div>
</div>`;
}
const num = (id, label, val, min) => `<div><label for="${id}">${label}</label><input type="number" id="${id}" data-in="${id}" value="${val ?? ""}" min="${min ?? 0}" step="any"></div>`;
const sel = (id, label, opts, defVal) => `<div><label for="${id}">${label}</label><select id="${id}" data-in="${id}">${opts.map(o => `<option value="${o.v}"${String(o.v) === String(defVal) ? " selected" : ""}>${o.t}</option>`).join("")}</select></div>`;

// ---- write helpers ------------------------------------------------------
const urls = [];
function writePage(urlPath, html) {
  const dir = path.join(OUT, urlPath.replace(/^\/+|\/+$/g, ""));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "index.html"), html);
  urls.push(urlPath);
}

// ---- build --------------------------------------------------------------
fs.mkdirSync(OUT, { recursive: true });
for (const entry of fs.readdirSync(OUT)) {
  if (entry === ".git" || entry === "CNAME") continue;
  fs.rmSync(path.join(OUT, entry), { recursive: true, force: true });
}
for (const f of fs.readdirSync(ASSETS)) fs.copyFileSync(path.join(ASSETS, f), path.join(OUT, f));

const CALCS = []; // for homepage: {href, emoji, label}

// -- bulk materials (mulch, topsoil, compost, gravel, river rock, sand) --
for (const mat of DATA.bulk) {
  const calcHref = `/${mat.slug}-calculator/`;
  CALCS.push({ href: calcHref, emoji: mat.emoji, label: `${mat.name} Calculator` });

  const areaLinks = AREAS.map(a => ({ href: `/${mat.slug}-for-${a}-square-feet/`, label: `${a} sq ft` }));

  // interactive calculator page
  {
    const title = `${mat.name} Calculator — Cubic Yards, Bags & Weight Needed`;
    const desc = `Free ${mat.name.toLowerCase()} calculator: enter your area and depth to get cubic yards, cubic feet, ${mat.bagLabel}, and weight in tons.`;
    const tool = toolBox("bulk", { bagCuFt: mat.bagCuFt, bagLabel: mat.bagLabel, lbsPerCuYd: mat.lbsPerCuYd }, `
    <div class="row">${num("L", "Length (ft)", 10)}${num("W", "Width (ft)", 10)}${sel("D", "Depth", mat.depths.map(d => ({ v: d, t: d + " inches" })).concat([{ v: 1, t: "1 inch" }, { v: 6, t: "6 inches" }].filter(o => !mat.depths.includes(o.v))), mat.defaultDepth)}</div>`);
    const body = `${tool}
  <div class="prose"><p>${mat.blurb}</p><p>${mat.tip}</p></div>
  <h2>Common ${mat.name.toLowerCase()} coverage answers</h2>
  ${grid(areaLinks)}
  <h2>Other calculators</h2>
  ${grid(CALC_LINKS_PLACEHOLDER())}`;
    writePage(calcHref, layout({ title, desc, urlPath: calcHref, h1: `${mat.name} Calculator`, hero: "", body, useTool: true }));
  }

  // preset area pages
  for (const a of AREAS) {
    const urlPath = `/${mat.slug}-for-${a}-square-feet/`;
    const def = bulkFor(a, mat.defaultDepth, mat);
    const h1 = `How Much ${mat.name} for ${a.toLocaleString("en-US")} Square Feet?`;
    const title = `${h1} (Cubic Yards & Bags)`;
    const desc = `${a.toLocaleString("en-US")} sq ft needs about ${def.cuyd} cubic yards of ${mat.name.toLowerCase()} at ${mat.defaultDepth} inches deep — that's ${def.bags} bags (${mat.bagCuFt} cu ft each) or roughly ${def.tons} tons. Full table by depth inside.`;
    const rows = mat.depths.map(d => {
      const v = bulkFor(a, d, mat);
      return [`${d} in${d === mat.defaultDepth ? " (typical)" : ""}`, `${v.cuyd} yd³`, `${v.cuft} ft³`, `${v.bags}`, `${v.tons}`];
    });
    const perYd = mat.depths.map(d => `${Math.round(27 / (d / 12))} sq ft at ${d}"`).join(" · ");
    const body = `
  ${table(["Depth", "Cubic yards", "Cubic feet", mat.bagLabel, "Approx. tons"], rows)}
  <div class="prose">
    <p>${mat.blurb}</p>
    <p>The math: <b>${a.toLocaleString("en-US")} sq ft × depth in feet ÷ 27 = cubic yards</b>. One cubic yard of ${mat.name.toLowerCase()} covers ${perYd}.</p>
    <p>${mat.tip}</p>
  </div>
  <h2>Different area?</h2>
  ${grid(areaLinks.filter(l => l.label !== `${a} sq ft`))}
  ${grid([{ href: calcHref, emoji: "🧮", label: `Exact ${mat.name} Calculator` }])}
  <h2>Same area, other materials</h2>
  ${grid(DATA.bulk.filter(m => m.slug !== mat.slug).map(m => ({ href: `/${m.slug}-for-${a}-square-feet/`, emoji: m.emoji, label: `${m.name} for ${a} sq ft` })))}`;
    writePage(urlPath, layout({
      title, desc, urlPath, h1,
      hero: answerHero(def.cuyd, "cubic yards", `at ${mat.defaultDepth} inches deep — about ${def.bags} bags (${mat.bagCuFt} cu ft each) or ${def.tons} tons`),
      body,
    }));
  }
}

// -- concrete --
{
  const calcHref = `/concrete-calculator/`;
  CALCS.push({ href: calcHref, emoji: "🏗️", label: "Concrete Calculator" });
  const slabLinks = DATA.slabs.map(s => ({ href: `/concrete-for-a-${s}-slab/`, label: `${s.replace("x", "×")} slab` }));

  const title = `Concrete Calculator — Cubic Yards & Bags for a Slab`;
  const desc = `Concrete slab calculator: enter length, width, and thickness to get cubic yards (plus 10% waste) and how many 80 lb or 60 lb bags to buy.`;
  const tool = toolBox("concrete", {}, `
    <div class="row">${num("L", "Length (ft)", 10)}${num("W", "Width (ft)", 10)}${sel("T", "Thickness", [{ v: 4, t: '4 inches (patio/walk)' }, { v: 5, t: "5 inches" }, { v: 6, t: '6 inches (driveway)' }], 4)}</div>`);
  const body = `${tool}
  <div class="prose"><p>Patios, sidewalks, and shed slabs are typically 4 inches thick; driveways and garage slabs 5–6 inches. Order ready-mix by the cubic yard for anything over about 1 yard — mixing 50+ bags by hand is a long day.</p>
  <p>An 80 lb bag yields 0.60 cu ft of concrete; a 60 lb bag yields 0.45 cu ft. Always order about 10% extra for uneven subgrade and spillage.</p></div>
  <h2>Common slab sizes</h2>
  ${grid(slabLinks)}
  <h2>Other calculators</h2>
  ${grid(CALC_LINKS_PLACEHOLDER())}`;
  writePage(calcHref, layout({ title, desc, urlPath: calcHref, h1: "Concrete Calculator", hero: "", body, useTool: true }));

  for (const s of DATA.slabs) {
    const [L, W] = s.split("x").map(Number);
    const urlPath = `/concrete-for-a-${s}-slab/`;
    const disp = `${L}×${W}`;
    const v4 = concreteFor(L, W, 4);
    const h1 = `How Much Concrete for a ${disp} Slab?`;
    const title = `${h1} (Yards & Bags)`;
    const desc = `A ${disp} slab at 4 inches thick needs ${v4.cuyd} cubic yards of concrete (order ${v4.order} with waste) — or ${v4.bags80} 80 lb bags. Table for 4, 5, and 6 inch thickness inside.`;
    const rows = [4, 5, 6].map(t => {
      const v = concreteFor(L, W, t);
      return [`${t} in`, `${v.cuyd} yd³`, `${v.order} yd³`, `${v.bags80}`, `${v.bags60}`];
    });
    const body = `
  ${table(["Thickness", "Concrete needed", "Order (with 10% waste)", "80 lb bags", "60 lb bags"], rows)}
  <div class="prose">
    <p>The math: <b>${L} ft × ${W} ft × thickness in feet ÷ 27 = cubic yards</b>. A ${disp} slab is ${L * W} square feet.</p>
    <p>At 4 inches this pour is ${v4.bags80} 80 lb bags — ${v4.bags80 > 45 ? "at that quantity, ready-mix delivery is almost always cheaper and far easier than bagged concrete." : "small enough that bagged concrete is practical."} Patios and walkways are fine at 4 inches; use 5–6 inches where vehicles will drive.</p>
  </div>
  <h2>Other slab sizes</h2>
  ${grid(slabLinks.filter(l => l.href !== urlPath))}
  ${grid([{ href: calcHref, emoji: "🧮", label: "Exact Concrete Calculator" }])}`;
    writePage(urlPath, layout({
      title, desc, urlPath, h1,
      hero: answerHero(v4.cuyd, "cubic yards", `at 4 inches thick — order ${v4.order} yd³ with waste, or ${v4.bags80} × 80 lb bags`),
      body,
    }));
  }
}

// -- paint --
{
  const calcHref = `/paint-calculator/`;
  CALCS.push({ href: calcHref, emoji: "🎨", label: "Paint Calculator" });
  const roomLinks = DATA.rooms.map(s => ({ href: `/paint-for-a-${s}-room/`, label: `${s.replace("x", "×")} room` }));

  const title = `Paint Calculator — Gallons Needed for a Room`;
  const desc = `Room paint calculator: enter room size, ceiling height, doors, windows, and coats to get gallons of wall paint (350 sq ft per gallon coverage).`;
  const tool = toolBox("paint", {}, `
    <div class="row">${num("L", "Room length (ft)", 12)}${num("W", "Room width (ft)", 12)}${num("H", "Ceiling height (ft)", 8)}</div>
    <div class="row">${num("DR", "Doors", 1)}${num("WN", "Windows", 2)}${sel("C", "Coats", [{ v: 1, t: "1 coat" }, { v: 2, t: "2 coats" }], 2)}</div>`);
  const body = `${tool}
  <div class="prose"><p>One gallon of wall paint covers about 350 square feet per coat. Two coats is the norm — especially over a color change or new drywall. Dark-to-light changes may need a tinted primer as well.</p>
  <p>Doors subtract about 21 sq ft each and windows about 12 sq ft. Buy whole gallons when you're within a quart of the line; leftover paint is touch-up paint.</p></div>
  <h2>Common room sizes</h2>
  ${grid(roomLinks)}
  <h2>Other calculators</h2>
  ${grid(CALC_LINKS_PLACEHOLDER())}`;
  writePage(calcHref, layout({ title, desc, urlPath: calcHref, h1: "Paint Calculator", hero: "", body, useTool: true }));

  for (const s of DATA.rooms) {
    const [L, W] = s.split("x").map(Number);
    const urlPath = `/paint-for-a-${s}-room/`;
    const disp = `${L}×${W}`;
    const v = paintFor(L, W);
    const h1 = `How Much Paint for a ${disp} Room?`;
    const title = `${h1} (Gallons Needed)`;
    const desc = `A ${disp} room with 8 ft ceilings has about ${v.wall} sq ft of wall — roughly ${v.gal2} gallons for two coats (buy ${v.buy2}). Ceiling and one-coat numbers inside.`;
    const body = `
  ${table(["What", "Amount"], [
      ["Wall area (8 ft ceilings, minus a door and window)", `≈ ${v.wall} sq ft`],
      ["One coat, walls", `${v.gal1} gallons`],
      ["Two coats, walls (typical)", `${v.gal2} gallons — buy ${v.buy2}`],
      ["Ceiling, one coat", `${v.ceilGal} gallons`],
    ])}
  <div class="prose">
    <p>The math: perimeter (${2 * (L + W)} ft) × 8 ft ceiling height − about 40 sq ft for a door and a window ≈ <b>${v.wall} sq ft of wall</b>, at 350 sq ft per gallon per coat.</p>
    <p>Taller ceilings, extra windows, or textured walls change the answer — use the calculator below for your exact room. Semi-gloss on trim is a separate (much smaller) quantity: a quart handles most rooms' trim.</p>
  </div>
  <h2>Other room sizes</h2>
  ${grid(roomLinks.filter(l => l.href !== urlPath))}
  ${grid([{ href: calcHref, emoji: "🧮", label: "Exact Paint Calculator" }])}`;
    writePage(urlPath, layout({
      title, desc, urlPath, h1,
      hero: answerHero(v.gal2, "gallons", `for two coats on the walls (8 ft ceilings) — buy ${v.buy2} gallon${v.buy2 > 1 ? "s" : ""}`),
      body,
    }));
  }
}

// -- sod, grass seed, tile, pavers (area-driven) --
const AREA_TOOLS = [
  {
    slug: "sod", name: "Sod", emoji: "🌱", calc: "sod", cfg: {},
    fields: `<div class="row">${num("L", "Length (ft)", 20)}${num("W", "Width (ft)", 25)}</div>`,
    prose: `<p>Sod is sold in rolls of about 10 square feet and pallets of about 450 square feet (400–500 depending on the farm — confirm before ordering). Order 5% extra for cuts along curves and edges.</p><p>Lay sod within 24 hours of delivery and water immediately. Measure twice: sod is the one material you can't easily return.</p>`,
    hero: a => { const v = sodFor(a); return { big: v.rolls, unit: "rolls of sod", sub: `about ${v.pallets} pallets — includes 5% for cuts` }; },
    rows: a => { const v = sodFor(a); return [["Sod area to order (5% waste)", `≈ ${Math.ceil(a * 1.05)} sq ft`], ["Rolls (10 sq ft each)", `${v.rolls}`], ["Pallets (≈450 sq ft each)", `${v.pallets}`]]; },
    desc: a => { const v = sodFor(a); return `${a.toLocaleString("en-US")} sq ft of lawn needs about ${v.rolls} rolls of sod (${v.pallets} pallets) including 5% for cuts.`; },
  },
  {
    slug: "grass-seed", name: "Grass Seed", emoji: "🌾", calc: "seed", cfg: { rates: DATA.seedRates },
    fields: `<div class="row">${num("A", "Lawn area (sq ft)", 1000)}${sel("G", "Grass type", DATA.seedRates.map((r, i) => ({ v: i, t: r.type })), 0)}${sel("M", "Seeding", [{ v: "newLawn", t: "New lawn" }, { v: "overseed", t: "Overseeding" }], "newLawn")}</div>`,
    prose: `<p>Seeding rates vary a lot by species — dense-seeded tall fescue needs about 8 lb per 1,000 sq ft for a new lawn, while Kentucky bluegrass needs only 3 lb, and Bermuda 1–2 lb. Overseeding an existing lawn takes about half the new-lawn rate.</p><p>More seed is not better: overseeded stands compete with themselves and thin out. Match the bag's stated rate when it differs from these typical values.</p>`,
    hero: a => { const r = DATA.seedRates[0]; return { big: r1(a / 1000 * r.newLawn), unit: "lbs of tall fescue", sub: `for a new lawn — see the table for other grasses and overseeding` }; },
    rows: a => DATA.seedRates.map(r => [r.type, `${r1(a / 1000 * r.newLawn)} lb`, `${r1(a / 1000 * r.overseed)} lb`]),
    head: ["Grass type", "New lawn", "Overseeding"],
    desc: a => `Grass seed needed for ${a.toLocaleString("en-US")} sq ft: about ${r1(a / 1000 * 8)} lb of tall fescue or ${r1(a / 1000 * 3)} lb of Kentucky bluegrass for a new lawn. Full table by species inside.`,
  },
  {
    slug: "tile", name: "Tile", emoji: "◻️", calc: "tile", cfg: { sizes: DATA.tileSizes },
    fields: `<div class="row">${num("L", "Length (ft)", 10)}${num("W", "Width (ft)", 10)}${sel("S", "Tile size", DATA.tileSizes.map((t, i) => ({ v: i, t: t.label })), 0)}</div>`,
    prose: `<p>Buy 10% extra tile for cuts and breakage — 15% for diagonal layouts or rooms with many corners. Keep a few spares after the job for future repairs; dye lots vary between orders.</p><p>Tile is sold by the box; divide the buy-quantity square footage by the coverage printed on the box and round up.</p>`,
    hero: a => ({ big: tileFor(a, 1), unit: "12×12 tiles", sub: `includes 10% for cuts — that's ${Math.ceil(a * 1.1)} sq ft of tile to buy` }),
    rows: a => DATA.tileSizes.map(t => [t.label, `${tileFor(a, t.sqft)} tiles`]),
    head: ["Tile size", "Tiles to buy (with 10% waste)"],
    desc: a => `Tiling ${a.toLocaleString("en-US")} sq ft takes about ${tileFor(a, 1)} 12×12 tiles or ${tileFor(a, 2.25)} 18×18 tiles including 10% waste. All common sizes inside.`,
  },
  {
    slug: "pavers", name: "Pavers", emoji: "🧱", calc: "paver", cfg: { sizes: DATA.paverSizes },
    fields: `<div class="row">${num("L", "Length (ft)", 12)}${num("W", "Width (ft)", 12)}${sel("S", "Paver size", DATA.paverSizes.map((p, i) => ({ v: i, t: p.label })), 0)}</div>`,
    prose: `<p>Standard 4×8 inch brick pavers run 4.5 per square foot. Add 5% for cuts (10% for curves or herringbone patterns). You'll also need a compacted gravel base of 4–6 inches and about 1 inch of paver sand — the gravel and sand calculators here cover those layers.</p>`,
    hero: a => ({ big: paverFor(a, 4.5), unit: "4×8 pavers", sub: `includes 5% for cuts — see table for other paver sizes` }),
    rows: a => DATA.paverSizes.map(p => [p.label, `${paverFor(a, p.perSqFt)} pavers`]),
    head: ["Paver size", "Pavers to buy (with 5% waste)"],
    desc: a => `A ${a.toLocaleString("en-US")} sq ft patio takes about ${paverFor(a, 4.5)} standard 4×8 pavers including 5% waste. Counts for all common paver sizes inside.`,
  },
];

for (const t of AREA_TOOLS) {
  const calcHref = `/${t.slug}-calculator/`;
  CALCS.push({ href: calcHref, emoji: t.emoji, label: `${t.name} Calculator` });
  const areaLinks = AREAS.map(a => ({ href: `/${t.slug}-for-${a}-square-feet/`, label: `${a} sq ft` }));

  {
    const title = `${t.name} Calculator — How Much ${t.name} Do I Need?`;
    const desc = `Free ${t.name.toLowerCase()} calculator: enter your project dimensions to get exactly how much ${t.name.toLowerCase()} to buy, including waste.`;
    const body = `${toolBox(t.calc, t.cfg, t.fields)}
  <div class="prose">${t.prose}</div>
  <h2>Common ${t.name.toLowerCase()} answers</h2>
  ${grid(areaLinks)}
  <h2>Other calculators</h2>
  ${grid(CALC_LINKS_PLACEHOLDER())}`;
    writePage(calcHref, layout({ title, desc, urlPath: calcHref, h1: `${t.name} Calculator`, hero: "", body, useTool: true }));
  }

  for (const a of AREAS) {
    const urlPath = `/${t.slug}-for-${a}-square-feet/`;
    const h1 = `How Much ${t.name} for ${a.toLocaleString("en-US")} Square Feet?`;
    const hero = t.hero(a);
    const body = `
  ${table(t.head || ["What", "Amount"], t.rows(a))}
  <div class="prose">${t.prose}</div>
  <h2>Different area?</h2>
  ${grid(areaLinks.filter(l => l.label !== `${a} sq ft`))}
  ${grid([{ href: calcHref, emoji: "🧮", label: `Exact ${t.name} Calculator` }])}`;
    writePage(urlPath, layout({
      title: `${h1} (With Waste Included)`, desc: t.desc(a), urlPath, h1,
      hero: answerHero(hero.big, hero.unit, hero.sub),
      body,
    }));
  }
}

// -- generator sizing --
{
  const calcHref = `/generator-size-calculator/`;
  CALCS.push({ href: calcHref, emoji: "⚡", label: "Generator Size Calculator" });
  const houseLinks = DATA.houseSizes.map(s => ({ href: `/generator-for-a-${s}-sq-ft-house/`, label: `${s.toLocaleString("en-US")} sq ft` }));

  const checks = DATA.appliances.map(a =>
    `<label><input type="checkbox" data-in="${a.key}"${a.on ? " checked" : ""}> ${a.label} <small>(${a.run.toLocaleString("en-US")}W${a.start ? " / " + a.start.toLocaleString("en-US") + "W start" : ""})</small></label>`).join("\n    ");
  const title = `Generator Size Calculator — What Size Generator Do I Need?`;
  const desc = `Check off what you want to power during an outage and get running watts, peak starting watts, and the portable or standby generator size to buy.`;
  const tool = `<div class="tool" data-calc="genset" data-config='${JSON.stringify({ appliances: DATA.appliances, sizes: DATA.generatorSizes })}'>
    <label>What do you want to keep running during an outage?</label>
    <div class="checks">${checks}</div>
    <div class="tool-out" data-out></div>
  </div>`;
  const body = `${tool}
  <div class="prose"><p>Generator sizing is two numbers: <b>running watts</b> (everything on at once) and <b>starting watts</b> — motors like refrigerators, pumps, and AC compressors briefly draw 2–3× their running load when they kick on. Your generator needs to handle the running total plus the single largest start-up surge, with about 10% headroom.</p>
  <p>Wattages above are typical values — check the nameplate on your actual appliances. Anything over about 9,500 watts usually means a home standby generator (10–26 kW) with a transfer switch rather than a portable. Never backfeed a panel: use a transfer switch or interlock, installed by an electrician.</p></div>
  <h2>By house size</h2>
  ${grid(houseLinks)}
  <h2>Other calculators</h2>
  ${grid(CALC_LINKS_PLACEHOLDER())}`;
  writePage(calcHref, layout({ title, desc, urlPath: calcHref, h1: "Generator Size Calculator", hero: "", body, useTool: true }));

  const ESSENTIALS = ["fridge", "furnace", "lights", "tv", "microwave"];
  const COMFORT = [...ESSENTIALS, "sump", "freezer", "winac"];
  for (const sqft of DATA.houseSizes) {
    const urlPath = `/generator-for-a-${sqft}-sq-ft-house/`;
    const disp = sqft.toLocaleString("en-US");
    const ess = gensetFor(ESSENTIALS);
    const com = gensetFor(COMFORT);
    const ac = cenacFor(sqft);
    const whole = gensetFor(COMFORT.filter(k => k !== "winac"));
    const wholeRunning = whole.running + ac.run + 4500; // + central AC + electric water heater
    const wholePeak = wholeRunning + Math.max(ac.start - ac.run, 1550);
    const h1 = `What Size Generator for a ${disp} Sq Ft House?`;
    const title = `${h1} (Watts & Sizing Table)`;
    const desc = `Essentials in a ${disp} sq ft house need a ${ess.size.toLocaleString("en-US")}W portable generator; adding comfort loads takes ${com.size ? com.size.toLocaleString("en-US") + "W" : "a standby unit"}, and whole-house with central AC needs a ${Math.ceil(wholePeak / 1000)} kW+ standby. Full wattage table inside.`;
    const rows = [
      ["Essentials (fridge, furnace fan, lights, TV, microwave)", `${ess.running.toLocaleString("en-US")}W`, `${ess.peak.toLocaleString("en-US")}W`, `${ess.size.toLocaleString("en-US")}W portable`],
      ["Comfort (+ sump pump, freezer, window AC)", `${com.running.toLocaleString("en-US")}W`, `${com.peak.toLocaleString("en-US")}W`, com.size ? `${com.size.toLocaleString("en-US")}W portable` : "standby"],
      [`Whole house (central AC ≈ ${ac.tons} ton for ${disp} sq ft + electric water heater)`, `${wholeRunning.toLocaleString("en-US")}W`, `${wholePeak.toLocaleString("en-US")}W`, `${Math.ceil(wholePeak / 1000)}–${Math.ceil(wholePeak / 1000) + 4} kW standby`],
    ];
    const body = `
  ${table(["What you're powering", "Running watts", "Peak (starting) watts", "Generator to buy"], rows)}
  <div class="prose">
    <p>House square footage matters mainly through the <b>central air conditioner</b> — a ${disp} sq ft house typically runs a ${ac.tons}-ton unit (≈${ac.run.toLocaleString("en-US")}W running, ${ac.start.toLocaleString("en-US")}W starting). Everything else — refrigerator, lights, electronics — is about the same in any house.</p>
    <p>Most homeowners are well served by the middle row: a 7,500–9,500W portable covers essentials plus comfort loads for a fraction of a standby's cost. Go standby when you want central AC on backup power or automatic transfer. Use the <a href="${BASE}/generator-size-calculator/">generator calculator</a> to check off your exact appliances.</p>
  </div>
  <h2>Other house sizes</h2>
  ${grid(houseLinks.filter(l => l.href !== urlPath))}
  ${grid([{ href: calcHref, emoji: "🧮", label: "Exact Generator Calculator" }])}`;
    writePage(urlPath, layout({
      title, desc, urlPath, h1,
      hero: answerHero(com.size.toLocaleString("en-US"), "watt portable (essentials + comfort)", `covers ${com.running.toLocaleString("en-US")}W running with ${com.peak.toLocaleString("en-US")}W peak — see table for essentials-only and whole-house standby`),
      body,
    }));
  }
}

// -- AC BTU sizing --
{
  const calcHref = `/ac-btu-calculator/`;
  CALCS.push({ href: calcHref, emoji: "❄️", label: "AC BTU Calculator" });
  const areaLinks = DATA.acRoomAreas.map(a => ({ href: `/ac-for-a-${a}-sq-ft-room/`, label: `${a} sq ft` }));

  const title = `AC BTU Calculator — What Size Air Conditioner Do I Need?`;
  const desc = `Air conditioner sizing calculator: room size, sun exposure, kitchen, and occupancy — get the right BTU, window unit size, and central-air tonnage.`;
  const tool = `<div class="tool" data-calc="acbtu" data-config='${JSON.stringify({ table: DATA.btuTable })}'>
    <div class="row">${num("L", "Room length (ft)", 15)}${num("W", "Room width (ft)", 20)}</div>
    <div class="row">${sel("S", "Sun exposure", [{ v: "average", t: "Average" }, { v: "sunny", t: "Very sunny (+10%)" }, { v: "shaded", t: "Shaded (−10%)" }], "average")}${sel("K", "Is it a kitchen?", [{ v: 0, t: "No" }, { v: 1, t: "Yes (+4,000 BTU)" }], 0)}${num("P", "People usually in room", 2, 1)}</div>
    <div class="tool-out" data-out></div>
  </div>`;
  const body = `${tool}
  <div class="prose"><p>Air conditioners are sized by the Energy Star area table, then adjusted: add 10% for very sunny rooms, subtract 10% for shaded ones, add 4,000 BTU for kitchens, and add 600 BTU per person beyond two.</p>
  <p><b>Bigger is not better.</b> An oversized AC short-cycles: it cools the air fast but shuts off before dehumidifying, leaving the room cold and clammy — and wears itself out. Size to the table, not "one up to be safe."</p></div>
  <h2>By room size</h2>
  ${grid(areaLinks)}
  <h2>Other calculators</h2>
  ${grid(CALC_LINKS_PLACEHOLDER())}`;
  writePage(calcHref, layout({ title, desc, urlPath: calcHref, h1: "AC BTU Calculator", hero: "", body, useTool: true }));

  for (const a of DATA.acRoomAreas) {
    const urlPath = `/ac-for-a-${a}-sq-ft-room/`;
    const base = btuFor(a);
    const h1 = `What Size AC for a ${a} Sq Ft Room?`;
    const title = `${h1} (BTU Chart)`;
    const desc = `A ${a} sq ft room needs about ${base.toLocaleString("en-US")} BTU — more if it's sunny (${btuFor(a, "sunny").toLocaleString("en-US")}) or a kitchen (${btuFor(a, "average", true).toLocaleString("en-US")}). Window, portable, and central sizing inside.`;
    const rows = [
      ["Standard room", `${base.toLocaleString("en-US")} BTU`],
      ["Very sunny room (+10%)", `${btuFor(a, "sunny").toLocaleString("en-US")} BTU`],
      ["Shaded room (−10%)", `${btuFor(a, "shaded").toLocaleString("en-US")} BTU`],
      ["Kitchen (+4,000)", `${btuFor(a, "average", true).toLocaleString("en-US")} BTU`],
      ["Room sleeping/seating 4 people", `${btuFor(a, "average", false, 4).toLocaleString("en-US")} BTU`],
      ["Central air equivalent", `${r1(base / 12000)} tons`],
    ];
    const body = `
  ${table(["Situation", "AC size to buy"], rows)}
  <div class="prose">
    <p>These figures follow the Energy Star sizing chart. For <b>portable ACs</b>, compare using the SACC (DOE) rating on the box, which runs 40–50% below the marketing BTU number — a ${a} sq ft room wants roughly ${Math.round(base * 0.65 / 500) * 500} SACC BTU.</p>
    <p>An oversized unit short-cycles and leaves the room clammy; undersized runs nonstop and never catches up on hot afternoons. When between sizes, round up only for sunny rooms, top floors, or poor insulation.</p>
  </div>
  <h2>Other room sizes</h2>
  ${grid(areaLinks.filter(l => l.href !== urlPath))}
  ${grid([{ href: calcHref, emoji: "🧮", label: "Exact AC Calculator" }])}`;
    writePage(urlPath, layout({
      title, desc, urlPath, h1,
      hero: answerHero(base.toLocaleString("en-US"), "BTU", `for a standard ${a} sq ft room — see the table for sun, kitchen, and occupancy adjustments`),
      body,
    }));
  }
}

// -- ceiling fan sizing --
{
  const calcHref = `/ceiling-fan-size-calculator/`;
  CALCS.push({ href: calcHref, emoji: "🌀", label: "Ceiling Fan Size Calculator" });
  const roomLinks = DATA.rooms.map(s => ({ href: `/ceiling-fan-for-a-${s}-room/`, label: `${s.replace("x", "×")} room` }));

  const title = `Ceiling Fan Size Calculator — Blade Span for Your Room`;
  const desc = `Ceiling fan sizing: enter room dimensions and ceiling height to get the right blade span, airflow (CFM), and downrod length.`;
  const tool = `<div class="tool" data-calc="fan" data-config='{}'>
    <div class="row">${num("L", "Room length (ft)", 12)}${num("W", "Room width (ft)", 12)}${num("H", "Ceiling height (ft)", 8)}</div>
    <div class="tool-out" data-out></div>
  </div>`;
  const body = `${tool}
  <div class="prose"><p>Fan size follows room area: up to 75 sq ft takes a 29–36 inch fan, 76–144 sq ft a 36–42 inch, 145–225 sq ft a 44–50 inch, and 226–400 sq ft a 50–54 inch. Very large rooms want a 56 inch+ fan — or two smaller fans spaced evenly.</p>
  <p>Blades should hang 8–9 feet above the floor: flush-mount on 8 ft ceilings, and add a downrod for anything taller. Compare airflow with the CFM rating, not blade count — three wide blades routinely out-move five narrow ones.</p></div>
  <h2>By room size</h2>
  ${grid(roomLinks)}
  <h2>Other calculators</h2>
  ${grid(CALC_LINKS_PLACEHOLDER())}`;
  writePage(calcHref, layout({ title, desc, urlPath: calcHref, h1: "Ceiling Fan Size Calculator", hero: "", body, useTool: true }));

  for (const s of DATA.rooms) {
    const [L, W] = s.split("x").map(Number);
    const a = L * W;
    const urlPath = `/ceiling-fan-for-a-${s}-room/`;
    const disp = `${L}×${W}`;
    const v = fanFor(a);
    const h1 = `What Size Ceiling Fan for a ${disp} Room?`;
    const title = `${h1} (Blade Span & CFM)`;
    const desc = `A ${disp} room (${a} sq ft) takes a ${v.span} ceiling fan moving about ${v.cfm.toLocaleString("en-US")} CFM. Downrod lengths by ceiling height inside.`;
    const rows = [
      ["Blade span", v.span],
      ["Airflow to look for (high speed)", `≈ ${v.cfm.toLocaleString("en-US")} CFM or more`],
      ["8 ft ceiling", "flush mount (hugger)"],
      ["9 ft ceiling", "6 in downrod"],
      ["10 ft ceiling", "12 in downrod"],
      ["12 ft ceiling", "24 in downrod"],
    ];
    const body = `
  ${table(["What", "Recommendation"], rows)}
  <div class="prose">
    <p>A ${disp} room is ${a} square feet, which lands in the ${v.span} bracket of the standard sizing chart. Blades need 18 inches of clearance from walls and 8–9 feet above the floor.</p>
    <p>For bedrooms, check the fan's low-speed CFM and noise rating too — that's the speed it will actually run at night. DC-motor fans cost more but are near-silent and use about 70% less power.</p>
  </div>
  <h2>Other room sizes</h2>
  ${grid(roomLinks.filter(l => l.href !== urlPath))}
  ${grid([{ href: calcHref, emoji: "🧮", label: "Exact Ceiling Fan Calculator" }])}`;
    writePage(urlPath, layout({
      title, desc, urlPath, h1,
      hero: answerHero(v.span.replace(" in", '"'), "blade span", `for ${a} sq ft — look for ${v.cfm.toLocaleString("en-US")}+ CFM on high`),
      body,
    }));
  }
}

// -- resolve cross-links (calculator list wasn't complete while writing) --
function CALC_LINKS_PLACEHOLDER() { return [{ href: "@@CALCS@@", label: "@@CALCS@@" }]; }
// Replace placeholder grids in already-written files with the full calculator grid.
{
  const fullGrid = grid(CALCS);
  const placeholder = grid(CALC_LINKS_PLACEHOLDER());
  const walk = dir => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name === "index.html") {
        const html = fs.readFileSync(p, "utf8");
        if (html.includes("@@CALCS@@")) fs.writeFileSync(p, html.split(placeholder).join(fullGrid));
      }
    }
  };
  walk(OUT);
}

// -- homepage --
{
  const title = `${SITE} — How Much Mulch, Concrete, Paint & More Do I Need?`;
  const desc = "Free calculators for home and yard projects: mulch, topsoil, gravel, concrete, paint, sod, grass seed, tile, and pavers — cubic yards, bags, and gallons, with waste included.";
  const body = `<p class="lead">Enter your project size, get exactly how much material to buy — cubic yards, bags, gallons, rolls, or pallets, with sensible waste factors built in.</p>
  <h2 id="calculators">All calculators</h2>
  ${grid(CALCS)}
  <h2>Popular answers</h2>
  ${grid([
    { href: "/mulch-for-200-square-feet/", label: "Mulch for 200 sq ft" },
    { href: "/mulch-for-500-square-feet/", label: "Mulch for 500 sq ft" },
    { href: "/concrete-for-a-10x10-slab/", label: "Concrete for a 10×10 slab" },
    { href: "/concrete-for-a-24x24-slab/", label: "Concrete for a 24×24 slab" },
    { href: "/paint-for-a-12x12-room/", label: "Paint for a 12×12 room" },
    { href: "/gravel-for-500-square-feet/", label: "Gravel for 500 sq ft" },
    { href: "/sod-for-1000-square-feet/", label: "Sod for 1,000 sq ft" },
    { href: "/grass-seed-for-1000-square-feet/", label: "Seed for 1,000 sq ft" },
  ])}`;
  writePage(`/`, layout({ title, desc, urlPath: `/`, h1: `Material Calculators`, hero: "", body }));
}

// -- sitemap + robots + meta files --
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url><loc>${DOMAIN}${BASE}${u}</loc></url>`).join("\n")}
</urlset>`;
fs.writeFileSync(path.join(OUT, "sitemap.xml"), sitemap);
fs.writeFileSync(path.join(OUT, "robots.txt"), `User-agent: *\nAllow: /\n\nSitemap: ${DOMAIN}${BASE}/sitemap.xml\n`);
fs.writeFileSync(path.join(OUT, ".nojekyll"), "");
fs.writeFileSync(path.join(OUT, "CNAME"), "materials.elevatedprogress.com\n");
fs.writeFileSync(path.join(OUT, "ads.txt"), "google.com, pub-5580575158570188, DIRECT, f08c47fec0942fa0\n");

console.log(`Generated ${urls.length} pages into ./public`);
