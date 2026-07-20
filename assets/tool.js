// Interactive calculators. Each .tool[data-calc] declares its type and config;
// inputs are tagged data-in and results render into [data-out].
(function () {
  const r1 = n => Math.round(n * 10) / 10;
  const r2 = n => Math.round(n * 100) / 100;
  const yd = n => (n < 10 ? r2(n) : r1(n));
  const fmt = n => n.toLocaleString("en-US");

  const CALCS = {
    bulk(v, cfg) {
      const area = v.L * v.W;
      if (!area || !v.D) return null;
      const cuft = area * v.D / 12, cuyd = cuft / 27;
      return `${yd(cuyd)} cubic yards (${r1(cuft)} cu ft)
      <small>${fmt(Math.ceil(cuft / cfg.bagCuFt))} ${cfg.bagLabel} · about ${r2(cuyd * cfg.lbsPerCuYd / 2000)} tons · covers ${fmt(area)} sq ft at ${v.D}&Prime; deep</small>`;
    },
    concrete(v) {
      const area = v.L * v.W;
      if (!area || !v.T) return null;
      const cuft = area * v.T / 12, cuyd = cuft / 27;
      return `${yd(cuyd)} cubic yards — order ${yd(cuyd * 1.1)} with 10% waste
      <small>${fmt(Math.ceil(cuft / 0.6))} × 80 lb bags or ${fmt(Math.ceil(cuft / 0.45))} × 60 lb bags</small>`;
    },
    paint(v) {
      if (!v.L || !v.W || !v.H) return null;
      const wall = Math.max(2 * (v.L + v.W) * v.H - 21 * (v.DR || 0) - 12 * (v.WN || 0), 0);
      const gal = wall * (v.C || 2) / 350;
      return `${r1(gal)} gallons of wall paint — buy ${Math.ceil(gal)}
      <small>≈ ${fmt(Math.round(wall))} sq ft of wall at 350 sq ft/gallon per coat · ceiling: ${r1(v.L * v.W / 350)} gal per coat</small>`;
    },
    sod(v) {
      const area = v.L * v.W;
      if (!area) return null;
      return `${fmt(Math.ceil(area * 1.05 / 10))} rolls (≈ ${r1(area / 450)} pallets)
      <small>${fmt(area)} sq ft + 5% for cuts = order about ${fmt(Math.ceil(area * 1.05))} sq ft</small>`;
    },
    seed(v, cfg) {
      if (!v.A) return null;
      const rate = cfg.rates[v.G || 0];
      const lbs = v.A / 1000 * rate[v.M || "newLawn"];
      return `${r1(lbs)} lbs of ${rate.type.toLowerCase()} seed
      <small>${v.M === "overseed" ? "overseeding" : "new lawn"} rate: ${rate[v.M || "newLawn"]} lb per 1,000 sq ft</small>`;
    },
    tile(v, cfg) {
      const area = v.L * v.W;
      if (!area) return null;
      const size = cfg.sizes[v.S || 0];
      return `${fmt(Math.ceil(area * 1.1 / size.sqft))} × ${size.label} tiles
      <small>${fmt(area)} sq ft + 10% waste = buy ${fmt(Math.ceil(area * 1.1))} sq ft of tile</small>`;
    },
    paver(v, cfg) {
      const area = v.L * v.W;
      if (!area) return null;
      const size = cfg.sizes[v.S || 0];
      return `${fmt(Math.ceil(area * 1.05 * size.perSqFt))} × ${size.label} pavers
      <small>${fmt(area)} sq ft + 5% for cuts · base: ~${yd(area * (4 / 12) / 27)} yd³ gravel + ~${yd(area * (1 / 12) / 27)} yd³ sand</small>`;
    },
    // Sizing math below mirrors generate.js — keep in sync.
    genset(v, cfg) {
      const sel = cfg.appliances.filter(a => v[a.key]);
      if (!sel.length) return "Check off at least one appliance above.";
      const running = sel.reduce((s, a) => s + a.run, 0);
      const surge = Math.max(0, ...sel.map(a => Math.max(0, a.start - a.run)));
      const peak = running + surge;
      const size = cfg.sizes.find(s => s >= peak * 1.1);
      const rec = size && peak <= 9500
        ? `a ${fmt(size)}W portable generator`
        : `a ${Math.ceil(peak / 1000)}–${Math.ceil(peak / 1000) + 4} kW home standby generator`;
      return `${rec}
      <small>${fmt(running)}W running · ${fmt(peak)}W peak with the largest motor start · sized with ~10% headroom — check nameplate watts on your actual appliances</small>`;
    },
    acbtu(v, cfg) {
      const area = v.L * v.W;
      if (!area) return null;
      const row = cfg.table.find(t => area <= t[0]) || cfg.table[cfg.table.length - 1];
      let btu = row[1];
      if (v.S === "sunny") btu *= 1.1;
      if (v.S === "shaded") btu *= 0.9;
      if (+v.K) btu += 4000;
      btu += Math.max(0, (v.P || 2) - 2) * 600;
      btu = Math.round(btu / 500) * 500;
      return `${fmt(btu)} BTU air conditioner
      <small>${fmt(area)} sq ft · ≈ ${r1(btu / 12000)} tons central-air equivalent · portable ACs: look for ≈ ${fmt(Math.round(btu * 0.65 / 500) * 500)} SACC BTU</small>`;
    },
    fan(v) {
      const area = v.L * v.W;
      if (!area) return null;
      const span = area <= 75 ? "29–36 in" : area <= 144 ? "36–42 in" : area <= 225 ? "44–50 in"
        : area <= 400 ? "50–54 in" : "56–72 in (or two fans)";
      const h = v.H || 8;
      const rod = h <= 8 ? "flush mount (hugger fan)" : h === 9 ? "6 in downrod"
        : h === 10 ? "12 in downrod" : h <= 12 ? "24 in downrod" : "36 in or longer downrod";
      return `${span} blade span
      <small>${fmt(area)} sq ft · look for ≈ ${fmt(Math.round(area * 35 / 100) * 100)}+ CFM on high · ${h} ft ceiling → ${rod}</small>`;
    },
  };

  document.querySelectorAll(".tool[data-calc]").forEach(tool => {
    const type = tool.dataset.calc;
    const cfg = tool.dataset.config ? JSON.parse(tool.dataset.config) : {};
    const out = tool.querySelector("[data-out]");
    const inputs = tool.querySelectorAll("[data-in]");
    function run() {
      const v = {};
      inputs.forEach(el => {
        v[el.dataset.in] = el.type === "checkbox" ? el.checked
          : el.tagName === "SELECT" && isNaN(+el.value) ? el.value : +el.value;
      });
      const res = CALCS[type] && CALCS[type](v, cfg);
      out.innerHTML = res || "";
    }
    inputs.forEach(el => el.addEventListener("input", run));
    run();
  });
})();
