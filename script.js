/* eslint-disable no-undef */
// Robust loader for GitHub Pages subfolder deployments (e.g., https://<user>.github.io/psh/)
const BASE_URL = (() => {
  // If loaded from /psh/, relative '.' works. This helper is a safe fallback for <base> issues.
  const url = new URL(import.meta.url);
  return url.href.replace(/\/script\.js(\?.*)?$/, '/');
})();

// Map setup
const map = L.map('map', { preferCanvas: true }).setView([-24.5, -51.6], 7);
const baseLayers = {
  'CARTO Light': L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { attribution: '© OpenStreetMap © CARTO' }),
  'Padrão': L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }),
  'Esri Imagery': L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { attribution: 'Tiles © Esri' })
};
baseLayers['CARTO Light'].addTo(map);
L.control.layers(baseLayers, null, { position: 'topright' }).addTo(map);

document.getElementById('btn-fit').onclick = () => map.fitBounds(allBounds());
const opacityInput = document.getElementById('opacity');
const opacityVal = document.getElementById('opacity-val');
opacityInput.addEventListener('input', () => {
  opacityVal.textContent = `${opacityInput.value}%`;
  applyOpacity();
});

const errors = [];
function showErrors() {
  const box = document.getElementById('errors');
  if (errors.length === 0) { box.hidden = true; return; }
  box.hidden = false;
  box.innerHTML = `<h4>Warnings</h4><ul>${errors.map(e => `<li>${e}</li>`).join('')}</ul>`;
  console.warn('Warnings:', errors);
}

// Layers
const styleFor = (name, opacity=0.7) => {
  if (name === 'microbacias') return { color: '#2c3e50', weight: 1, fillColor: '#3498db', fillOpacity: 0.45 * opacity, opacity };
  if (name === 'uso_solo')   return { color: '#6b7280', weight: 0.5, fillColor: '#e6ab02', fillOpacity: 0.35 * opacity, opacity };
  if (name === 'conflitos')  return { color: '#9b1c1c', weight: 0.8, fillColor: '#ef4444', fillOpacity: 0.25 * opacity, opacity };
  return { color: '#111827', weight: 1, fillColor: '#60a5fa', fillOpacity: 0.3 * opacity, opacity };
};

const layerDefs = [
  { key: 'microbacias', label: 'Microbacias',   pattern: 'microbacias_selecionadas__microbacias.geojson_part-', maxParts: 20 },
  { key: 'uso_solo',    label: 'Uso do Solo',   pattern: 'uso_solo__usodosolo_otto.geojson_part-',             maxParts: 30 },
  { key: 'conflitos',   label: 'Conflitos',     pattern: 'conflitosdeuso__uso_solo_em_app.geojson_part-',      maxParts: 20 }
];

const groups = new Map();
for (const def of layerDefs) {
  groups.set(def.key, L.featureGroup().addTo(map));
}
function applyOpacity() {
  const o = Number(opacityInput.value) / 100;
  for (const [key, group] of groups) {
    group.eachLayer(layer => layer.setStyle && layer.setStyle(styleFor(key, o)));
  }
}

function allBounds() {
  let bounds = null;
  for (const [, group] of groups) {
    const b = group.getBounds();
    if (b && b.isValid()) bounds = bounds ? bounds.extend(b) : b;
  }
  return bounds || L.latLngBounds([-26.5, -54.5], [-22.5, -48.5]);
}

// Robust .gz loader using pako
async function fetchGZ(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  // Must read as binary; do NOT use res.json() for .gz
  const buf = await res.arrayBuffer();
  // GitHub Pages does not set Content-Encoding for .gz in subfolders; inflate manually
  const inflated = pako.ungzip(new Uint8Array(buf), { to: 'string' });
  return JSON.parse(inflated);
}

// Try to discover available parts: fetch sequentially until first 404 streak >= 2
async function loadMultipartLayer(def) {
  const group = groups.get(def.key);
  let found = 0, misses = 0;
  for (let i = 0; i < def.maxParts; i++) {
    const url = `${BASE_URL}data/${def.pattern}${i}.gz`;
    try {
      const gj = await fetchGZ(url);
      const layer = L.geoJSON(gj, { style: styleFor(def.key, Number(opacityInput.value)/100) });
      layer.addTo(group);
      found++;
      misses = 0;
    } catch (err) {
      if (String(err).includes('HTTP 404')) {
        misses++;
        if (misses >= 2 && found > 0) break;
      } else {
        errors.push(`Falha ao carregar ${def.key} parte ${i}: ${err.message}`);
      }
    }
  }
  if (found === 0) {
    errors.push(`Nenhum arquivo encontrado para ${def.label} em ./data/${def.pattern}*.gz`);
  }
}

async function init() {
  // hook checkboxes
  document.querySelectorAll('input[type="checkbox"][data-layer]').forEach(cb => {
    cb.addEventListener('change', () => {
      const key = cb.getAttribute('data-layer');
      const group = groups.get(key);
      if (cb.checked) group.addTo(map); else map.removeLayer(group);
    });
  });

  await Promise.all(layerDefs.map(loadMultipartLayer));
  const b = allBounds();
  map.fitBounds(b);
  showErrors();
}

init().catch(e => {
  errors.push(`Erro geral de inicialização: ${e.message}`);
  showErrors();
});
