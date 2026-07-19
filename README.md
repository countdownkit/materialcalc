# Material Calculators

Free "how much do I need" calculators for home and yard projects — mulch, topsoil, compost,
gravel, river rock, sand, concrete, paint, sod, grass seed, tile, and pavers. Interactive
calculators plus pre-computed answer pages for common project sizes (cubic yards, bags,
gallons, rolls, pallets — waste factors included).

Live at **https://materials.elevatedprogress.com/**

## How it works

Zero-dependency Node static-site generator:

- `generate.js` — reads `data/materials.json` and writes every page into `public/`
- `data/materials.json` — materials, coverage presets, seed rates, tile/paver sizes
- `assets/` — stylesheet + the interactive calculator script, copied into the build
- `server.js` — local preview server (`http://localhost:5056`)

```
node generate.js   # build ./public
node server.js     # preview
```

Deployment is GitHub Actions → GitHub Pages on every push to `main` (`public/` is build
output and never committed).

Estimates use standard industry coverage values (e.g. 1 cu yd covers 108 sq ft at 3",
80 lb concrete bag yields 0.60 cu ft, 350 sq ft per gallon of paint) — always confirm with
your supplier for large orders.
