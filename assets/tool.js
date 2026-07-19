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
  };

  document.querySelectorAll(".tool[data-calc]").forEach(tool => {
    const type = tool.dataset.calc;
    const cfg = tool.dataset.config ? JSON.parse(tool.dataset.config) : {};
    const out = tool.querySelector("[data-out]");
    const inputs = tool.querySelectorAll("[data-in]");
    function run() {
      const v = {};
      inputs.forEach(el => {
        v[el.dataset.in] = el.tagName === "SELECT" && isNaN(+el.value) ? el.value : +el.value;
      });
      const res = CALCS[type] && CALCS[type](v, cfg);
      out.innerHTML = res || "";
    }
    inputs.forEach(el => el.addEventListener("input", run));
    run();
  });
})();
