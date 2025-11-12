
# PSH WebGIS – GitHub Pages Fix

This drop-in replaces your current `index.html`, `styles.css`, and `script.js` with a version that:

- Works under a **project site subpath** (e.g. `/psh/`) without broken links.
- Loads **`.geojson_part-*.gz`** files correctly on GitHub Pages using **pako**.
- Auto-discovers multi-part files (tries part `0..N`) and stops on 404 streaks.
- Shows a small **warning panel** if files are missing.

## Expected data layout

```
data/
  microbacias_selecionadas__microbacias.geojson_part-0.gz
  microbacias_selecionadas__microbacias.geojson_part-1.gz
  uso_solo__usodosolo_otto.geojson_part-0.gz
  conflitosdeuso__uso_solo_em_app.geojson_part-0.gz
  ...
assets/
  IDR_GOV_Seab_V_1.webp
```

You can keep your current filenames. The script will attempt parts `0..19` (configurable in `script.js`).

## Deploy

Commit these three files to your repo root (keeping your existing `data/` and `assets/` folders) and push.
GitHub Pages will serve `https://<user>.github.io/psh/` correctly.

