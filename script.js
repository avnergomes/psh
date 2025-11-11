(() => {
  'use strict';

  const turf = window.turf || null;
  const pako = window.pako || null;
  const MicroAggregation = window.MicroAggregation || null;

  function resolveAppBaseUrl() {
    try {
      if (typeof window !== 'undefined' && window.__APP_BASE_URL__) {
        return window.__APP_BASE_URL__;
      }
      const base = new URL('./', window.location.href);
      if (typeof window !== 'undefined') {
        window.__APP_BASE_URL__ = base.href;
      }
      return base.href;
    } catch (error) {
      console.warn('Não foi possível determinar a URL base automaticamente.', error);
      return './';
    }
  }

  const APP_BASE_URL = resolveAppBaseUrl();
  const DATA_BASE_URL = new URL('data/', APP_BASE_URL);

  const fmt = {
    ha(value) {
      if (!Number.isFinite(value)) return '0,00';
      const abs = Math.abs(value);
      const digits = abs >= 100 ? 0 : abs >= 10 ? 1 : 2;
      return value.toLocaleString('pt-BR', {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits
      });
    },
    count(value) {
      if (!Number.isFinite(value)) return '0';
      return Math.round(value).toLocaleString('pt-BR');
    },
    pct(value) {
      if (!Number.isFinite(value)) return '0,0';
      return value.toLocaleString('pt-BR', {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1
      });
    }
  };

  // Campos de identificação
  const MICRO_RIVER_FIELDS = [
    'Microbacias Nome Manancial',
    'Microbacias Nome do Rio',
    'Nome do Rio',
    'Nome Rio',
    'Nome Manancial',
    'Nome do Manancial',
    'Nome_Rio',
    'nome_rio',
    'rio',
    'rio_nome'
  ];
  const ID_FIELD_CANDIDATES = [
    ...MICRO_RIVER_FIELDS,
    'ID',
    'id',
    'Cod_otto',
    'COD_OTTO'
  ];
  const MICRO_ID_FALLBACK_FIELDS = ['ID', 'id', 'Cod_otto', 'COD_OTTO'];
  const MICRO_BACIA_FIELDS = ['Bacia', 'BACIA', 'Microbacias_Bacia', 'Microbacias Bacia'];
  const MICRO_MANANCIAL_FIELDS = ['Manancial', 'MANANCIAL', 'Microbacias_Manancial', 'Microbacias Manancial'];
  const USO_FIELDS = ['Nivel_II', 'NIVEL_II', 'nivel_ii'];
  const USO_FALLBACK_FIELDS = ['Nivel_I', 'NIVEL_I', 'nivel_i'];
  const DECLIVIDADE_FIELDS = ['ClDec', 'CLDEC', 'cldec'];

  // Cores para uso do solo
  const USO_COLORS = {
    'Agricultura Anual': '#e6ab02',
    'Agricultura Perene': '#c98c00',
    'Corpos d\'Água': '#67a9cf',
    'Floresta Nativa': '#1b9e77',
    'Pastagem/Campo': '#a6d854',
    'Plantios Florestais': '#106b21',
    'Solo Exposto/Mineração': '#bdbdbd',
    'Área Construída': '#7570b3',
    'Área Urbanizada': '#6a51a3'
  };

  const USO_FALLBACK_COLORS = {
    'Água': '#67a9cf',
    'Áreas de Vegetação Natural': '#1b9e77',
    'Áreas Antrópicas Agrícolas': '#e6ab02',
    'Áreas Antrópicas Não Agrícolas': '#6a51a3'
  };

  const DECLIVIDADE_CLASS_LOOKUP = {
    '000a003': { label: '0% a 3%', color: '#edf8fb' },
    '003a008': { label: '3% a 8%', color: '#d0e1f2' },
    '008a015': { label: '8% a 15%', color: '#a6bddb' },
    '015a025': { label: '15% a 25%', color: '#74a9cf' },
    '025a045': { label: '25% a 45%', color: '#2b8cbe' },
    '045a100': { label: '45% a 100%', color: '#045a8d' },
    '>100': { label: '> 100%', color: '#023858' }
  };

  const DECLIVIDADE_LABEL_TO_COLOR = Object.create(null);
  Object.values(DECLIVIDADE_CLASS_LOOKUP).forEach(entry => {
    DECLIVIDADE_LABEL_TO_COLOR[entry.label] = entry.color;
  });

  function buildSequenceFiles(base, start, end) {
    const files = [];
    for (let index = start; index <= end; index += 1) {
      const suffix = String(index).padStart(3, '0');
      files.push(`${base}${suffix}.gz`);
    }
    return files;
  }

  function trim(value) {
    if (value === undefined || value === null) return '';
    return String(value).trim();
  }

  function normaliseText(value) {
    return trim(value)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }

  function normaliseKey(value) {
    return normaliseText(value).replace(/[^a-z0-9]+/g, '');
  }

  function normaliseLayerType(value, fallback = 'polygon') {
    if (!value) return fallback;
    const normalized = String(value).trim().toLowerCase();
    if (['line', 'polyline', 'multiline'].includes(normalized)) {
      return 'line';
    }
    if (['point', 'marker', 'multipoint'].includes(normalized)) {
      return 'point';
    }
    return 'polygon';
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function parseNumeric(value) {
    if (value === undefined || value === null || value === '') return Number.NaN;
    if (typeof value === 'number') return value;
    const text = String(value).trim();
    if (!text) return Number.NaN;
    const cleaned = text.replace(/\s+/g, '').replace(/[^0-9.,-]/g, '');
    const hasComma = cleaned.includes(',');
    const hasDot = cleaned.includes('.');
    let normalised = cleaned;
    if (hasComma && hasDot) {
      normalised = cleaned.replace(/\./g, '').replace(',', '.');
    } else if (hasComma) {
      normalised = cleaned.replace(',', '.');
    }
    const parsed = Number(normalised);
    return Number.isFinite(parsed) ? parsed : Number.NaN;
  }

  function getFirstValue(props, candidates) {
    if (!props) return '';
    const key = findField(props, candidates);
    if (!key) return '';
    const value = props[key];
    return value !== undefined && value !== null && value !== '' ? value : '';
  }

  function getUsoClass(props) {
    const value = getFirstValue(props, USO_FIELDS);
    if (value) return value;
    return getFirstValue(props, USO_FALLBACK_FIELDS);
  }

  function getUsoColor(value) {
    if (!value) return '#31a354';
    return USO_COLORS[value] || USO_FALLBACK_COLORS[value] || '#31a354';
  }

  function getDeclividadeEntry(props) {
    if (!props) return null;
    const code = trim(getFirstValue(props, DECLIVIDADE_FIELDS));
    if (!code) return null;
    const entry = DECLIVIDADE_CLASS_LOOKUP[code];
    if (!entry) {
      return {
        code,
        label: code,
        color: '#4b5563'
      };
    }
    return {
      code,
      label: entry.label,
      color: entry.color
    };
  }

  function getDeclividadeClass(props) {
    const entry = getDeclividadeEntry(props);
    return entry ? entry.label : '';
  }

  function getDeclividadeColor(value) {
    if (!value) return '#4b5563';
    return DECLIVIDADE_LABEL_TO_COLOR[value] || DECLIVIDADE_CLASS_LOOKUP[value]?.color || '#4b5563';
  }

  function makeDataUrl(file) {
    return new URL(file, DATA_BASE_URL).href;
  }

  const LAYER_CONFIGS = [
    {
      key: 'microbacias',
      manifestKey: 'microbacias_selecionadas__microbacias',
      name: 'Microbacias (PSH)',
      type: 'polygon',
      filesFallback: buildSequenceFiles('microbacias_selecionadas__microbacias.geojson_part-', 1, 1),
      areaProperty: 'area_ha',
      legend: {
        type: 'area-total',
        title: 'Microbacias',
        color: '#3498db',
        includeCount: true
      },
      style: (_, { opacity }) => ({
        color: '#2c3e50',
        weight: 1,
        fillColor: '#3498db',
        fillOpacity: 0.45 * opacity,
        opacity
      })
    },
    {
      key: 'uso_solo',
      manifestKey: 'uso_solo__usodosolo_otto',
      name: 'Uso do Solo (Ottobacias)',
      type: 'polygon',
      filesFallback: buildSequenceFiles('uso_solo__usodosolo_otto.geojson_part-', 2, 16),
      areaProperty: 'area_ha',
      legend: {
        type: 'area-classes',
        title: 'Uso do Solo',
        getClass: (_, props) => getUsoClass(props),
        getColor: value => getUsoColor(value)
      },
      style: (feature, { opacity }) => {
        const props = feature?.properties || {};
        const value = trim(getUsoClass(props));
        return {
          color: '#1f2937',
          weight: 0.6,
          fillColor: getUsoColor(value),
          fillOpacity: 0.6 * opacity,
          opacity
        };
      }
    },
    {
      key: 'conflito_uso',
      manifestKey: 'conflitosdeuso__uso_solo_em_app',
      name: 'Conflito de Uso',
      type: 'polygon',
      filesFallback: buildSequenceFiles('conflitosdeuso__uso_solo_em_app.geojson_part-', 2, 2),
      areaProperty: 'area_ha',
      legend: {
        type: 'area-classes',
        title: 'Conflito de Uso',
        getClass: (_, props) => getUsoClass(props),
        getColor: value => getUsoColor(value)
      },
      style: (feature, { opacity }) => {
        const props = feature?.properties || {};
        const value = trim(getUsoClass(props));
        return {
          color: '#1f2937',
          weight: 0.6,
          fillColor: getUsoColor(value),
          fillOpacity: 0.6 * opacity,
          opacity
        };
      }
    },
    {
      key: 'declividade',
      manifestKey: 'declividade__declividade_otto',
      name: 'Declividade (Classes %)',
      type: 'polygon',
      filesFallback: buildSequenceFiles('declividade__declividade_otto.geojson_part-', 3, 5),
      areaProperty: 'AreaHa',
      legend: {
        type: 'area-classes',
        title: 'Declividade (%)',
        getClass: (_, props) => getDeclividadeClass(props),
        getColor: value => getDeclividadeColor(value)
      },
      style: (feature, { opacity }) => {
        const props = feature?.properties || {};
        const entry = getDeclividadeEntry(props);
        const color = entry?.color || '#4b5563';
        return {
          color: '#0f172a',
          weight: 0.4,
          fillColor: color,
          fillOpacity: 0.55 * opacity,
          opacity: 0.85 * opacity
        };
      }
    },
    {
      key: 'curvas_nivel',
      manifestKey: 'curvasdenivel__curvas_otto',
      name: 'Curvas de Nível',
      type: 'line',
      filesFallback: buildSequenceFiles('curvasdenivel__curvas_otto.geojson_part-', 2, 42),
      legend: null,
      style: (_, { opacity }) => ({
        color: '#5b627a',
        weight: 0.7,
        opacity: Math.min(1, Math.max(0.35, opacity * 0.9))
      })
    }
  ];

  async function loadLayerManifest() {
    try {
      const response = await fetch(makeDataUrl('layer_manifest.json'), { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      if (!data || typeof data !== 'object') {
        return null;
      }
      return data;
    } catch (error) {
      console.warn('Não foi possível carregar o manifest de camadas.', error);
      return null;
    }
  }

  function normaliseManifestEntry(rawEntry) {
    if (!rawEntry) {
      return { files: [], type: null, name: null, description: null };
    }
    if (Array.isArray(rawEntry)) {
      return { files: rawEntry.filter(Boolean), type: null, name: null, description: null };
    }
    if (typeof rawEntry === 'object') {
      const files = Array.isArray(rawEntry.files) ? rawEntry.files.filter(Boolean) : [];
      const type = rawEntry.type ? normaliseLayerType(rawEntry.type) : null;
      const name = rawEntry.name || rawEntry.title || null;
      const description = rawEntry.description || null;
      return { files, type, name, description };
    }
    return { files: [], type: null, name: null, description: null };
  }

  function buildLayerDefinitions(manifest) {
    const defs = [];
    const consumedKeys = new Set();
    LAYER_CONFIGS.forEach(config => {
      const { filesFallback = [], ...rest } = config;
      const hasManifestEntry = manifest && Object.prototype.hasOwnProperty.call(manifest, config.manifestKey);
      const manifestEntry = hasManifestEntry ? normaliseManifestEntry(manifest[config.manifestKey]) : null;
      if (hasManifestEntry) {
        consumedKeys.add(config.manifestKey);
      }
      const files = manifestEntry && manifestEntry.files.length ? manifestEntry.files : filesFallback;
      if (!files || !files.length) return;
      const nextType = manifestEntry?.type || rest.type || 'polygon';
      const nextName = manifestEntry?.name || rest.name || rest.key || config.key;
      const description = manifestEntry?.description || rest.description || null;
      defs.push({
        ...rest,
        type: normaliseLayerType(nextType, rest.type || 'polygon'),
        name: nextName,
        description,
        files
      });
    });
    if (manifest) {
      Object.entries(manifest).forEach(([key, rawEntry]) => {
        if (consumedKeys.has(key)) return;
        const entry = normaliseManifestEntry(rawEntry);
        if (!entry.files.length) return;
        const fallbackName = key
          .replace(/__/g, ' • ')
          .replace(/_/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        defs.push({
          key,
          manifestKey: key,
          name: entry.name || fallbackName || key,
          type: normaliseLayerType(entry.type, 'polygon'),
          files: entry.files,
          legend: null,
          description: entry.description || null
        });
      });
    }
    return defs;
  }

  async function fetchGeoJsonFile(file) {
    const url = makeDataUrl(file);
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ao carregar ${file}`);
    }
    if (file.toLowerCase().endsWith('.gz')) {
      const buffer = await response.arrayBuffer();
      if (!buffer || !buffer.byteLength) return [];
      let text;
      try {
        if (pako && typeof pako.ungzip === 'function') {
          text = pako.ungzip(new Uint8Array(buffer), { to: 'string' });
        } else if (pako && typeof pako.inflate === 'function') {
          text = pako.inflate(new Uint8Array(buffer), { to: 'string' });
        } else {
          text = new TextDecoder('utf-8').decode(new Uint8Array(buffer));
        }
      } catch (error) {
        console.warn('Falha ao descompactar', file, error);
        text = new TextDecoder('utf-8').decode(new Uint8Array(buffer));
      }
      return parseGeoJson(text);
    }
    const text = await response.text();
    return parseGeoJson(text);
  }

  function parseGeoJson(payload) {
    if (!payload) return [];
    let data = payload;
    if (typeof payload === 'string') {
      try {
        data = JSON.parse(payload);
      } catch (error) {
        console.warn('JSON inválido detectado durante o carregamento.', error);
        return [];
      }
    }
    if (!data) return [];
    if (data.type === 'FeatureCollection' && Array.isArray(data.features)) {
      return data.features.filter(Boolean);
    }
    if (data.type === 'Feature') {
      return [data];
    }
    return [];
  }

  function computeAreaHa(feature) {
    if (!feature || !turf) return 0;
    try {
      const area = turf.area(feature);
      return Number.isFinite(area) ? area / 10000 : 0;
    } catch (error) {
      console.warn('Falha ao calcular área de uma feição.', error);
      return 0;
    }
  }

  function findField(props, candidates) {
    if (!props) return null;
    const lower = Object.create(null);
    const normalizedMap = Object.create(null);
    const normalizedEntries = [];
    Object.keys(props).forEach(key => {
      const lowerKey = key.toLowerCase();
      lower[lowerKey] = key;
      const normalizedKey = normaliseKey(key);
      if (normalizedKey) {
        normalizedMap[normalizedKey] = key;
        normalizedEntries.push({ normalized: normalizedKey, key });
      }
    });
    for (const candidate of candidates) {
      if (!candidate) continue;
      const lowerCandidate = candidate.toLowerCase();
      const direct = lower[lowerCandidate];
      if (direct) return direct;
      const normalizedCandidate = normaliseKey(candidate);
      if (!normalizedCandidate) continue;
      const exact = normalizedMap[normalizedCandidate];
      if (exact) return exact;
      for (const entry of normalizedEntries) {
        if (entry.normalized.includes(normalizedCandidate)) {
          return entry.key;
        }
      }
    }
    return null;
  }

  function findFieldWithValues(features, candidates) {
    if (!features || !features.length || !candidates || !candidates.length) {
      return null;
    }
    let fallbackKey = null;
    for (const candidate of candidates) {
      if (!candidate) continue;
      let resolvedKey = null;
      for (const feature of features) {
        const props = feature?.properties;
        if (!props) continue;
        const key = findField(props, [candidate]);
        if (!key) continue;
        resolvedKey = key;
        if (trim(props[key])) {
          return key;
        }
      }
      if (resolvedKey && !fallbackKey) {
        fallbackKey = resolvedKey;
      }
    }
    return fallbackKey;
  }

  function enrichFeature(def, feature, idField) {
    const props = feature?.properties || {};
    const id = idField ? trim(props[idField]) : '';
    let areaHa = 0;
    if (def.areaProperty) {
      const raw = props[def.areaProperty];
      const parsed = parseNumeric(raw);
      if (Number.isFinite(parsed)) {
        areaHa = parsed;
      }
    }
    if (!areaHa && def.type === 'polygon') {
      areaHa = computeAreaHa(feature);
    }
    let classValue = '';
    if (def.legend && def.legend.type === 'area-classes') {
      try {
        classValue = trim(def.legend.getClass(feature, props));
      } catch (error) {
        console.warn('Falha ao obter a classe da feição.', error);
        classValue = '';
      }
    }
    return {
      feature,
      id,
      areaHa,
      classValue
    };
  }

  function createPopupContent(feature) {
    const props = feature?.properties;
    if (!props) return '';
    const keys = Object.keys(props);
    if (!keys.length) return '';
    const limit = Math.min(keys.length, 12);
    const pieces = [];
    for (let i = 0; i < limit; i += 1) {
      const key = keys[i];
      const value = props[key];
      if (value === undefined || value === null) continue;
      pieces.push(`<div><span class=\"popup-key\">${escapeHtml(key)}</span>: ${escapeHtml(value)}</div>`);
    }
    return pieces.join('');
  }

  function buildGeoJsonLayer(def, features, opacity) {
    const effectiveOpacity = Number.isFinite(opacity) ? opacity : defaultOpacity;
    const options = {};
    if (def.type === 'point') {
      options.pointToLayer = (feature, latlng) => L.circleMarker(latlng, getFeatureStyle(def, feature, effectiveOpacity));
    } else {
      options.style = feature => getFeatureStyle(def, feature, effectiveOpacity);
    }
    options.onEachFeature = (feature, layer) => {
      const content = createPopupContent(feature);
      if (content) {
        layer.bindPopup(`<div class=\"popup-content\">${content}</div>`);
      }
    };
    return L.geoJSON(features, options);
  }

  function getFeatureStyle(def, feature, opacity = defaultOpacity) {
    const safeOpacity = Math.min(1, Math.max(0.1, Number.isFinite(opacity) ? opacity : defaultOpacity));
    const context = { opacity: safeOpacity };
    if (typeof def.style === 'function') {
      try {
        const result = def.style(feature, context);
        if (result && typeof result === 'object') {
          return result;
        }
      } catch (error) {
        console.warn(`Falha ao aplicar estilo personalizado da camada ${def.name || def.key}.`, error);
      }
    } else if (def.style && typeof def.style === 'object') {
      return { ...def.style };
    }
    const adjustedOpacity = Math.min(1, Math.max(0.1, safeOpacity));
    if (def.type === 'point') {
      return {
        radius: 6,
        color: '#1f2937',
        weight: 1,
        fillColor: '#2563eb',
        fillOpacity: adjustedOpacity,
        opacity: adjustedOpacity
      };
    }
    if (def.type === 'line') {
      return {
        color: '#1f2937',
        weight: 1,
        opacity: adjustedOpacity
      };
    }
    return {
      color: '#1f2937',
      weight: 0.5,
      fillColor: '#cbd5f5',
      fillOpacity: 0.5 * safeOpacity,
      opacity: safeOpacity
    };
  }

  function legendColorFor(def, feature) {
    const style = getFeatureStyle(def, feature);
    return style.fillColor || style.color || '#1f2937';
  }

  const layerCartoLight = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap • © CARTO'
  });
  const layerCartoDark = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap • © CARTO'
  });
  const layerOsm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap colaboradores'
  });
  const layerEsri = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Imagens © Esri & partners'
  });
  const layerTopo = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors • © OpenTopoMap'
  });

  const baseLayers = {
    'Tema Claro (CARTO)': layerCartoLight,
    'Tema Escuro (CARTO)': layerCartoDark,
    'OSM Padrão': layerOsm,
    'Satélite (Esri)': layerEsri,
    'Topográfico (OTM)': layerTopo
  };

  const themeLayers = {
    light: layerCartoLight,
    dark: layerCartoDark,
    streets: layerOsm,
    satellite: layerEsri,
    terrain: layerTopo
  };

  let activeBaseLayer = themeLayers.light;

  const map = L.map('map', {
    center: [-24.5, -51.5],
    zoom: 7,
    preferCanvas: true,
    layers: [activeBaseLayer]
  });

  const layerControl = L.control.layers(baseLayers, {}, {
    collapsed: false,
    position: 'topleft'
  }).addTo(map);

  map.attributionControl.setPrefix(false);
  map.attributionControl.addAttribution('IDR-Paraná • PSH');

  const legendControl = createLegendDock().addTo(map);
  const legendContainer = legendControl.getContainer();

  const stateByKey = new Map();
  const groupLookup = new Map();
  let layerDefs = [];
  let overlayOrder = [];

  const microUi = setupMicroFilterControl();
  const overlayUi = setupOverlayManager({
    onToggle: handleOverlayToggle,
    onOpacityChange: handleLayerOpacityChange,
    onReorder: handleLayerReorder
  });

  const microState = {
    hierarchy: { groups: [], idLookup: new Map(), allIds: [] },
    collapsed: new Map(),
    rows: [],
    offsets: [],
    totalHeight: 0,
    virtualizationScheduled: false
  };
  const MICRO_GROUP_HEIGHT = 52;
  const MICRO_OTTO_HEIGHT = 44;
  const allMicroIds = new Set();
  let activeIds = new Set();
  let microOptionsReady = false;
  let searchQuery = '';

  let defaultOpacity = 0.7;
  const opacityInput = document.getElementById('opacity');
  const opacityValue = document.getElementById('opacityVal');
  if (opacityInput) {
    const initial = Number(opacityInput.value || 70);
    const clamped = Math.min(100, Math.max(20, Number.isFinite(initial) ? initial : 70));
    defaultOpacity = clamped / 100;
    if (opacityValue) {
      opacityValue.textContent = `${clamped}%`;
    }
    opacityInput.addEventListener('input', event => {
      const raw = Number(event.target.value);
      const next = Math.min(100, Math.max(20, Number.isFinite(raw) ? raw : 70));
      defaultOpacity = next / 100;
      if (opacityValue) {
        opacityValue.textContent = `${next}%`;
      }
      stateByKey.forEach(state => {
        if (state.customOpacity) return;
        state.opacity = defaultOpacity;
        overlayUi.updateLayer(state.def.key, { opacity: state.opacity });
        updateLayerOpacity(state);
      });
    });
  }

  const themeSelect = document.getElementById('themePreset');
  if (themeSelect) {
    if (!themeSelect.value) {
      themeSelect.value = 'light';
    }
    themeSelect.addEventListener('change', event => {
      const selected = event.target.value;
      const nextLayer = themeLayers[selected] || themeLayers.light;
      if (nextLayer === activeBaseLayer) return;
      if (activeBaseLayer && map.hasLayer(activeBaseLayer)) {
        map.removeLayer(activeBaseLayer);
      }
      map.addLayer(nextLayer);
      activeBaseLayer = nextLayer;
    });
  }

  const fitAllButton = document.getElementById('fitAll');
  if (fitAllButton) {
    fitAllButton.addEventListener('click', () => {
      let combined = null;
      stateByKey.forEach(state => {
        if (!map.hasLayer(state.group) || !state.displayLayer) return;
        const bounds = state.displayLayer.getBounds?.();
        if (!bounds || !bounds.isValid || !bounds.isValid()) return;
        combined = combined ? combined.extend(bounds) : L.latLngBounds(bounds.getSouthWest(), bounds.getNorthEast());
      });
      if (combined && combined.isValid && combined.isValid()) {
        map.fitBounds(combined.pad(0.08));
      }
    });
  }

  bootstrapLayers().catch(error => {
    console.error('Falha ao inicializar as camadas.', error);
  });

  async function bootstrapLayers() {
    const manifest = await loadLayerManifest();
    layerDefs = buildLayerDefinitions(manifest);
    if (!layerDefs.length) {
      console.warn('Nenhuma camada configurada disponível para exibição.');
      return;
    }
    const overlayItems = [];
    const defaultActive = new Set(['microbacias']);
    layerDefs.forEach(def => {
      const group = L.layerGroup();
      const state = {
        def,
        group,
        ready: false,
        loading: false,
        promise: null,
        features: [],
        enriched: [],
        filtered: [],
        displayLayer: null,
        idField: null,
        opacity: defaultOpacity,
        customOpacity: false
      };
      stateByKey.set(def.key, state);
      groupLookup.set(group, def.key);
      overlayItems.push({
        key: def.key,
        name: def.name || def.key,
        description: def.description || null,
        legend: def.legend || null
      });
    });
    overlayUi.setLayers(overlayItems, {
      defaultActive,
      defaultOpacity
    });
    overlayOrder = overlayUi.getOrder();
    defaultActive.forEach(key => {
      handleOverlayToggle(key, true);
    });
  }

  map.on('overlayadd', event => {
    const key = groupLookup.get(event.layer);
    if (!key) return;
    overlayUi.updateLayer(key, { active: true, loading: false });
    applyFilters();
  });

  map.on('overlayremove', event => {
    const key = groupLookup.get(event.layer);
    if (!key) return;
    overlayUi.updateLayer(key, { active: false, loading: false });
    updateLegendDock();
  });

  if (microUi.search) {
    microUi.search.addEventListener('input', () => {
      searchQuery = microUi.search.value || '';
      rebuildMicroRows();
      renderMicroList({ resetScroll: true });
      updateAutocomplete();
    });
    microUi.search.addEventListener('focus', () => {
      updateAutocomplete();
    });
    microUi.search.addEventListener('blur', () => {
      setTimeout(() => {
        if (microUi.autocomplete) {
          microUi.autocomplete.hidden = true;
        }
      }, 120);
    });
  }

  if (microUi.listViewport) {
    microUi.listViewport.addEventListener('scroll', () => {
      if (!microOptionsReady || microState.virtualizationScheduled) return;
      microState.virtualizationScheduled = true;
      const scheduler = typeof window.requestAnimationFrame === 'function'
        ? window.requestAnimationFrame.bind(window)
        : handler => window.setTimeout(handler, 16);
      scheduler(() => {
        microState.virtualizationScheduled = false;
        renderMicroList();
      });
    });
  }

  if (microUi.selectAll) {
    microUi.selectAll.addEventListener('click', () => {
      if (!microOptionsReady) return;
      activeIds = new Set(allMicroIds);
      updateMicroSummary();
      renderMicroList();
      applyFilters({ fitToMicro: true });
    });
  }

  if (microUi.clear) {
    microUi.clear.addEventListener('click', () => {
      if (!microOptionsReady) return;
      activeIds = new Set();
      updateMicroSummary();
      renderMicroList();
      applyFilters({ fitToMicro: true });
    });
  }

  function getEffectiveIds() {
    if (!microOptionsReady || !microState.hierarchy.allIds.length) return null;
    if (!activeIds) return null;
    if (activeIds.size === 0) return new Set();
    if (activeIds.size >= microState.hierarchy.allIds.length) return null;
    return activeIds;
  }

  function applyFilters(options = {}) {
    const effectiveIds = getEffectiveIds();
    stateByKey.forEach(state => {
      if (!state.ready) return;
      const { def } = state;
      const filteredItems = effectiveIds && state.idField
        ? state.enriched.filter(item => item.id && effectiveIds.has(item.id))
        : state.enriched;
      state.filtered = filteredItems;
      state.group.clearLayers();
      if (filteredItems.length) {
        const features = filteredItems.map(item => item.feature);
        const layer = buildGeoJsonLayer(def, features, state.opacity ?? defaultOpacity);
        state.group.addLayer(layer);
        state.displayLayer = layer;
        updateLayerOpacity(state);
      } else {
        state.displayLayer = null;
      }
    });
    applyOverlayOrder();
    updateLegendDock();
    if (options.fitToMicro) {
      const microStateEntry = stateByKey.get('microbacias');
      if (microStateEntry && microStateEntry.displayLayer) {
        const bounds = microStateEntry.displayLayer.getBounds?.();
        if (bounds && bounds.isValid && bounds.isValid()) {
          map.fitBounds(bounds.pad(0.08));
        }
      }
    }
  }

  function updateLayerOpacity(state) {
    if (!state.displayLayer) return;
    const effectiveOpacity = Number.isFinite(state.opacity) ? state.opacity : defaultOpacity;
    state.displayLayer.eachLayer(layer => {
      const feature = layer?.feature;
      if (!feature || typeof layer.setStyle !== 'function') return;
      layer.setStyle(getFeatureStyle(state.def, feature, effectiveOpacity));
    });
  }

  function loadLayer(state) {
    if (state.ready) return Promise.resolve(state);
    if (state.loading && state.promise) return state.promise;
    state.loading = true;
    state.promise = (async () => {
      const collected = [];
      for (const file of state.def.files) {
        try {
          const features = await fetchGeoJsonFile(file);
          collected.push(...features);
        } catch (error) {
          console.error(`Falha ao carregar ${file}`, error);
        }
      }
      state.features = collected;
      const sampleProps = collected.find(item => item && item.properties)?.properties || null;
      const idField = findFieldWithValues(collected, ID_FIELD_CANDIDATES)
        || (sampleProps ? findField(sampleProps, ID_FIELD_CANDIDATES) : null);
      state.idField = idField;
      state.enriched = collected.map(feature => enrichFeature(state.def, feature, idField));
      state.ready = true;
      state.loading = false;
      if (state.def.key === 'microbacias') {
        prepareMicroOptions(state.enriched);
      }
      applyFilters();
      return state;
    })();
    return state.promise;
  }

  function prepareMicroOptions(enriched) {
    if (!MicroAggregation || typeof MicroAggregation.buildRiverHierarchy !== 'function') {
      console.warn('Não foi possível inicializar o agrupamento hierárquico de microbacias.');
      return;
    }
    const merged = new Map();
    enriched.forEach(entry => {
      const { feature, id, areaHa } = entry || {};
      const props = feature?.properties || {};
      const fallbackId = trim(getFirstValue(props, MICRO_ID_FALLBACK_FIELDS)) || trim(id);
      const ottoId = fallbackId || trim(id);
      if (!ottoId) return;
      const rawRiver = trim(getFirstValue(props, MICRO_RIVER_FIELDS));
      const manancial = trim(getFirstValue(props, MICRO_MANANCIAL_FIELDS));
      const bacia = trim(getFirstValue(props, MICRO_BACIA_FIELDS));
      const riverFull = rawRiver || manancial || ottoId;
      const label = `Ottobacia ${ottoId}`;
      const fullLabel = manancial && manancial !== riverFull ? `${label} • ${manancial}` : label;
      const searchExtras = `${ottoId} ${riverFull} ${bacia} ${manancial} ${id}`;
      const existing = merged.get(ottoId);
      if (!existing) {
        merged.set(ottoId, {
          id: ottoId,
          riverRaw: rawRiver || riverFull,
          riverFull,
          areaHa: areaHa || 0,
          label,
          fullLabel,
          metadata: { bacia, manancial, fallbackId, rawId: id },
          searchExtras
        });
      } else {
        existing.areaHa = Math.max(existing.areaHa || 0, areaHa || 0);
        if (!existing.riverRaw && rawRiver) {
          existing.riverRaw = rawRiver;
        }
        existing.searchExtras = `${existing.searchExtras || ''} ${searchExtras}`.trim();
      }
    });
    const entries = Array.from(merged.values());
    microState.hierarchy = MicroAggregation.buildRiverHierarchy(entries);
    microState.collapsed = new Map();
    microState.hierarchy.groups.forEach((group, index) => {
      microState.collapsed.set(group.key, index >= 3);
    });
    allMicroIds.clear();
    microState.hierarchy.allIds.forEach(idValue => allMicroIds.add(idValue));
    activeIds = new Set(allMicroIds);
    microOptionsReady = true;
    updateMicroSummary();
    rebuildMicroRows();
    renderMicroList({ resetScroll: true });
    updateAutocomplete();
  }

  function updateMicroSummary() {
    if (!microUi.summary) return;
    if (!microOptionsReady) {
      microUi.summary.textContent = 'Carregando microbacias…';
      microUi.summary.classList.add('muted');
      return;
    }
    const totalRios = microState.hierarchy.groups.length;
    const totalOttos = allMicroIds.size;
    const selected = activeIds ? activeIds.size : 0;
    if (!totalOttos) {
      microUi.summary.textContent = 'Nenhuma ottobacia disponível.';
      microUi.summary.classList.add('muted');
      return;
    }
    microUi.summary.classList.remove('muted');
    if (!selected) {
      microUi.summary.textContent = `Nenhuma ottobacia selecionada em ${totalRios} rios.`;
    } else if (selected >= totalOttos) {
      microUi.summary.textContent = `Todas as ${totalOttos} ottobacias (${totalRios} rios) selecionadas.`;
    } else {
      microUi.summary.textContent = `${selected} de ${totalOttos} ottobacias em ${totalRios} rios.`;
    }
  }

  function rebuildMicroRows() {
    microState.rows = [];
    microState.offsets = [];
    microState.totalHeight = 0;
    if (!microOptionsReady) return;
    const normalizedQuery = normaliseText(searchQuery);
    const rows = [];
    microState.hierarchy.groups.forEach(group => {
      const groupMatches = !normalizedQuery || (group.search && group.search.includes(normalizedQuery));
      const ottoMatches = !normalizedQuery
        ? group.ottobacias
        : group.ottobacias.filter(otto => otto.search && otto.search.includes(normalizedQuery));
      if (!groupMatches && !ottoMatches.length) return;
      const collapsed = normalizedQuery ? false : microState.collapsed.get(group.key) !== false;
      rows.push({
        type: 'group',
        key: group.key,
        group,
        collapsed,
        height: MICRO_GROUP_HEIGHT
      });
      const children = collapsed && !normalizedQuery ? [] : ottoMatches;
      children.forEach(otto => {
        rows.push({
          type: 'otto',
          key: `${group.key}:${otto.id}`,
          id: otto.id,
          group,
          otto,
          height: MICRO_OTTO_HEIGHT
        });
      });
    });
    microState.rows = rows;
    const offsets = [];
    let acc = 0;
    rows.forEach(row => {
      offsets.push(acc);
      acc += row.height;
    });
    microState.offsets = offsets;
    microState.totalHeight = acc;
  }

  function findRowIndex(position) {
    const offsets = microState.offsets;
    if (!offsets.length || position <= 0) return 0;
    let low = 0;
    let high = offsets.length - 1;
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const value = offsets[mid];
      if (value === position) return mid;
      if (value < position) {
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }
    return Math.max(0, low - 1);
  }

  function renderMicroList(options = {}) {
    if (!microUi.listInner) return;
    if (options.resetScroll && microUi.listViewport) {
      microUi.listViewport.scrollTop = 0;
    }
    if (!microOptionsReady) {
      microUi.listInner.style.height = 'auto';
      microUi.listInner.innerHTML = '<div class="micro-empty muted">Carregando microbacias…</div>';
      return;
    }
    if (!microState.rows.length) {
      microUi.listInner.style.height = 'auto';
      microUi.listInner.innerHTML = '<div class="micro-empty muted">Nenhum resultado para o filtro atual.</div>';
      return;
    }
    const viewport = microUi.listViewport;
    const scrollTop = viewport ? viewport.scrollTop : 0;
    const viewportHeight = viewport ? viewport.clientHeight : microState.totalHeight;
    const startIndex = findRowIndex(scrollTop);
    const endIndex = findRowIndex(scrollTop + viewportHeight);
    const buffer = 6;
    const from = Math.max(0, startIndex - buffer);
    const to = Math.min(microState.rows.length, endIndex + buffer);
    const fragment = document.createDocumentFragment();
    for (let index = from; index < to; index += 1) {
      const row = microState.rows[index];
      const top = microState.offsets[index];
      fragment.appendChild(buildMicroRowElement(row, top));
    }
    microUi.listInner.style.height = `${microState.totalHeight}px`;
    microUi.listInner.replaceChildren(fragment);
  }

  function buildMicroRowElement(row, top) {
    if (row.type === 'group') {
      return createGroupRow(row, top);
    }
    return createOttoRow(row, top);
  }

  function createGroupRow(row, top) {
    const group = row.group;
    const stats = getGroupSelectionStats(group);
    const element = document.createElement('div');
    element.className = 'micro-row micro-group';
    element.style.position = 'absolute';
    element.style.transform = `translateY(${top}px)`;
    element.style.height = `${row.height}px`;

    const expander = document.createElement('button');
    expander.type = 'button';
    expander.className = row.collapsed ? 'micro-toggle collapsed' : 'micro-toggle';
    expander.title = row.collapsed ? 'Expandir ottobacias do rio' : 'Recolher ottobacias do rio';
    expander.addEventListener('click', () => {
      const current = microState.collapsed.get(group.key) !== false;
      microState.collapsed.set(group.key, !current);
      rebuildMicroRows();
      renderMicroList();
    });

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = stats.selected === stats.total && stats.total > 0;
    checkbox.indeterminate = stats.selected > 0 && stats.selected < stats.total;
    checkbox.addEventListener('change', event => {
      handleGroupToggle(group, event.target.checked);
    });

    const info = document.createElement('div');
    info.className = 'micro-group-info';
    const title = document.createElement('span');
    title.className = 'micro-group-name';
    title.textContent = group.name || group.fullName;
    if (group.fullName && group.fullName !== group.name) {
      title.title = group.fullName;
    }
    const meta = document.createElement('span');
    meta.className = 'micro-group-meta';
    meta.textContent = `${stats.selected}/${stats.total} • ${fmt.ha(group.totalArea)} ha`;

    info.appendChild(title);
    info.appendChild(meta);

    element.append(expander, checkbox, info);
    return element;
  }

  function createOttoRow(row, top) {
    const { otto, group } = row;
    const element = document.createElement('div');
    element.className = 'micro-row micro-otto';
    element.style.position = 'absolute';
    element.style.transform = `translateY(${top}px)`;
    element.style.height = `${row.height}px`;

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = activeIds.has(otto.id);
    checkbox.addEventListener('change', event => {
      handleOttoToggle(otto.id, event.target.checked);
    });

    const info = document.createElement('div');
    info.className = 'micro-otto-info';
    const name = document.createElement('span');
    name.className = 'micro-otto-name';
    name.textContent = otto.label;
    name.title = otto.fullLabel || otto.label;
    const chip = document.createElement('span');
    chip.className = 'micro-chip';
    chip.textContent = `${fmt.ha(otto.areaHa)} ha`;
    chip.title = `Área estimada da ottobacia no rio ${group.name}`;

    info.append(name, chip);
    element.append(checkbox, info);
    return element;
  }

  function getGroupSelectionStats(group) {
    const total = group.ottobacias.length;
    let selected = 0;
    group.ottobacias.forEach(otto => {
      if (activeIds.has(otto.id)) {
        selected += 1;
      }
    });
    return { total, selected };
  }

  function handleGroupToggle(group, checked) {
    if (!group) return;
    const next = new Set(activeIds);
    group.ottobacias.forEach(otto => {
      if (checked) {
        next.add(otto.id);
      } else {
        next.delete(otto.id);
      }
    });
    activeIds = next;
    updateMicroSummary();
    renderMicroList();
    applyFilters({ fitToMicro: true });
  }

  function handleOttoToggle(id, checked) {
    if (!id) return;
    const next = new Set(activeIds);
    if (checked) {
      next.add(id);
    } else {
      next.delete(id);
    }
    activeIds = next;
    updateMicroSummary();
    applyFilters({ fitToMicro: true });
    renderMicroList();
  }

  function scrollToGroup(key) {
    if (!microUi.listViewport) return;
    const index = microState.rows.findIndex(row => row.type === 'group' && row.group.key === key);
    if (index < 0) return;
    microUi.listViewport.scrollTop = microState.offsets[index] || 0;
  }

  function scrollToOtto(groupKey, id) {
    if (!microUi.listViewport) return;
    const index = microState.rows.findIndex(row => row.type === 'otto' && row.group.key === groupKey && row.id === id);
    if (index < 0) return;
    const offset = microState.offsets[index] || 0;
    microUi.listViewport.scrollTop = Math.max(0, offset - MICRO_GROUP_HEIGHT);
  }

  function updateAutocomplete() {
    if (!microUi.autocomplete) return;
    const queryRaw = microUi.search ? microUi.search.value : '';
    const query = normaliseText(queryRaw);
    microUi.autocomplete.innerHTML = '';
    if (!query || !microOptionsReady) {
      microUi.autocomplete.hidden = true;
      return;
    }
    const suggestions = [];
    const seen = new Set();
    microState.hierarchy.groups.forEach(group => {
      if (group.search && group.search.includes(query) && !seen.has(`river:${group.key}`)) {
        suggestions.push({ type: 'river', key: group.key, label: group.name, full: group.fullName });
        seen.add(`river:${group.key}`);
      }
      group.ottobacias.forEach(otto => {
        if (!otto.search || !otto.search.includes(query)) return;
        if (seen.has(`otto:${otto.id}`)) return;
        suggestions.push({ type: 'otto', key: otto.id, label: otto.label, full: otto.fullLabel, groupKey: group.key });
        seen.add(`otto:${otto.id}`);
      });
    });
    if (!suggestions.length) {
      microUi.autocomplete.hidden = true;
      return;
    }
    suggestions.slice(0, 8).forEach(item => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'micro-suggestion';
      button.textContent = item.type === 'river' ? `🌊 ${item.label}` : `🗺️ ${item.label}`;
      button.title = item.full || item.label;
      button.addEventListener('mousedown', event => event.preventDefault());
      button.addEventListener('click', () => {
        if (!microUi.search) return;
        microUi.search.value = item.label;
        searchQuery = microUi.search.value;
        if (item.type === 'river') {
          microState.collapsed.set(item.key, false);
          rebuildMicroRows();
          renderMicroList({ resetScroll: true });
          scrollToGroup(item.key);
        } else {
          microState.collapsed.set(item.groupKey, false);
          rebuildMicroRows();
          renderMicroList({ resetScroll: false });
          scrollToOtto(item.groupKey, item.key);
        }
        updateAutocomplete();
        microUi.search.focus();
      });
      microUi.autocomplete.appendChild(button);
    });
    microUi.autocomplete.hidden = false;
  }

  function setupMicroFilterControl() {
    const Control = L.Control.extend({
      options: { position: 'topright' },
      onAdd() {
        const container = L.DomUtil.create('div', 'leaflet-control micro-filter');
        container.innerHTML = `
          <div class="micro-header">
            <div>
              <h2>Microbacias</h2>
              <p class="micro-summary muted" data-role="summary">Carregando microbacias…</p>
            </div>
            <button type="button" class="micro-info" data-role="info" title="Selecione rios completos ou ottobacias específicas.">ℹ️</button>
          </div>
          <div class="micro-actions">
            <div class="micro-search-wrapper">
              <span class="micro-search-icon" aria-hidden="true">🔍</span>
              <input type="search" class="micro-search" placeholder="Buscar por nome do rio ou ottobacia" data-role="search" />
            </div>
            <div class="micro-autocomplete" data-role="autocomplete" hidden></div>
            <div class="micro-buttons">
              <button type="button" class="btn-chip" data-action="select-all">Selecionar todas</button>
              <button type="button" class="btn-chip" data-action="clear">Limpar seleção</button>
            </div>
          </div>
          <div class="micro-list-viewport" data-role="list-viewport">
            <div class="micro-list-inner" data-role="list"></div>
          </div>
        `;
        L.DomEvent.disableClickPropagation(container);
        L.DomEvent.disableScrollPropagation(container);
        return container;
      }
    });
    const control = new Control();
    map.addControl(control);
    const container = control.getContainer();
    return {
      container,
      summary: container.querySelector('[data-role="summary"]'),
      search: container.querySelector('[data-role="search"]'),
      autocomplete: container.querySelector('[data-role="autocomplete"]'),
      listViewport: container.querySelector('[data-role="list-viewport"]'),
      listInner: container.querySelector('[data-role="list"]'),
      selectAll: container.querySelector('[data-action="select-all"]'),
      clear: container.querySelector('[data-action="clear"]')
    };
  }

  function setupOverlayManager(callbacks = {}) {
    const { onToggle, onOpacityChange, onReorder } = callbacks;
    const Control = L.Control.extend({
      options: { position: 'topright' },
      onAdd() {
        const container = L.DomUtil.create('div', 'leaflet-control layer-manager');
        container.innerHTML = `
          <div class="layer-manager-header">
            <h2>Camadas</h2>
          </div>
          <div class="layer-manager-list" data-role="layer-list"></div>
        `;
        L.DomEvent.disableClickPropagation(container);
        L.DomEvent.disableScrollPropagation(container);
        return container;
      }
    });
    const control = new Control();
    map.addControl(control);
    const container = control.getContainer();
    const list = container.querySelector('[data-role="layer-list"]');
    const state = {
      items: new Map(),
      order: [],
      nodes: new Map(),
      defaultOpacity
    };

    function setLayers(layers, options = {}) {
      const defaultActive = options.defaultActive || new Set();
      const baseOpacity = Number.isFinite(options.defaultOpacity) ? options.defaultOpacity : defaultOpacity;
      state.items.clear();
      state.order = [];
      state.nodes.clear();
      (layers || []).forEach(layer => {
        if (!layer || !layer.key) return;
        state.items.set(layer.key, {
          ...layer,
          active: defaultActive.has(layer.key),
          opacity: baseOpacity,
          loading: false
        });
        state.order.push(layer.key);
      });
      render();
    }

    function render() {
      if (!list) return;
      list.innerHTML = '';
      state.nodes.clear();
      state.order.forEach(key => {
        const entry = state.items.get(key);
        if (!entry) return;
        const node = createLayerItem(entry);
        list.appendChild(node);
        state.nodes.set(key, node);
      });
    }

    function createLayerItem(entry) {
      const item = document.createElement('div');
      item.className = 'layer-item';
      item.dataset.key = entry.key;
      item.draggable = true;

      const drag = document.createElement('span');
      drag.className = 'layer-drag';
      drag.title = 'Arraste para reordenar a camada';
      drag.textContent = '⋮⋮';

      const toggleLabel = document.createElement('label');
      toggleLabel.className = 'layer-toggle';
      const toggle = document.createElement('input');
      toggle.type = 'checkbox';
      toggle.checked = !!entry.active;
      toggle.addEventListener('change', event => {
        entry.active = event.target.checked;
        if (typeof onToggle === 'function') {
          onToggle(entry.key, event.target.checked);
        }
      });
      const name = document.createElement('span');
      name.className = 'layer-name';
      name.textContent = entry.name || entry.key;
      if (entry.description) {
        name.title = entry.description;
      }
      toggleLabel.append(toggle, name);

      const opacityWrap = document.createElement('div');
      opacityWrap.className = 'layer-opacity';
      const slider = document.createElement('input');
      slider.type = 'range';
      slider.min = '20';
      slider.max = '100';
      const sliderValue = Math.round((Number.isFinite(entry.opacity) ? entry.opacity : defaultOpacity) * 100);
      slider.value = String(sliderValue);
      const valueLabel = document.createElement('span');
      valueLabel.className = 'layer-opacity-value';
      valueLabel.textContent = `${sliderValue}%`;
      slider.addEventListener('input', event => {
        const raw = Number(event.target.value);
        const next = Math.min(100, Math.max(20, Number.isFinite(raw) ? raw : sliderValue));
        valueLabel.textContent = `${next}%`;
        entry.opacity = next / 100;
        if (typeof onOpacityChange === 'function') {
          onOpacityChange(entry.key, entry.opacity);
        }
      });
      opacityWrap.append(slider, valueLabel);

      item.append(drag, toggleLabel, opacityWrap);

      item.addEventListener('dragstart', event => {
        item.classList.add('dragging');
        event.dataTransfer?.setData('text/plain', entry.key);
      });
      item.addEventListener('dragend', () => {
        item.classList.remove('dragging');
      });
      item.addEventListener('dragover', event => {
        event.preventDefault();
        item.classList.add('drag-over');
      });
      item.addEventListener('dragleave', () => {
        item.classList.remove('drag-over');
      });
      item.addEventListener('drop', event => {
        event.preventDefault();
        item.classList.remove('drag-over');
        const sourceKey = event.dataTransfer?.getData('text/plain');
        if (!sourceKey || sourceKey === entry.key) return;
        reorder(sourceKey, entry.key);
      });

      return item;
    }

    function reorder(sourceKey, targetKey) {
      const nextOrder = state.order.filter(key => key !== sourceKey);
      const targetIndex = nextOrder.indexOf(targetKey);
      if (targetIndex >= 0) {
        nextOrder.splice(targetIndex, 0, sourceKey);
      } else {
        nextOrder.push(sourceKey);
      }
      state.order = nextOrder;
      render();
      if (typeof onReorder === 'function') {
        onReorder(nextOrder.slice());
      }
    }

    function updateLayer(key, patch = {}) {
      const entry = state.items.get(key);
      if (!entry) return;
      Object.assign(entry, patch);
      const node = state.nodes.get(key);
      if (!node) return;
      const toggle = node.querySelector('.layer-toggle input[type="checkbox"]');
      if (toggle && patch.active !== undefined) {
        toggle.checked = !!entry.active;
      }
      const slider = node.querySelector('.layer-opacity input[type="range"]');
      const valueLabel = node.querySelector('.layer-opacity-value');
      if (slider && valueLabel && patch.opacity !== undefined) {
        const value = Math.round((entry.opacity ?? defaultOpacity) * 100);
        slider.value = String(value);
        valueLabel.textContent = `${value}%`;
      }
      if (patch.loading !== undefined) {
        node.classList.toggle('loading', !!patch.loading);
      }
    }

    return {
      container,
      setLayers,
      updateLayer,
      getOrder: () => state.order.slice()
    };
  }

  async function handleOverlayToggle(key, enabled) {
    const state = stateByKey.get(key);
    if (!state) return;
    if (enabled) {
      overlayUi.updateLayer(key, { loading: true, active: true });
      try {
        if (!state.ready) {
          await loadLayer(state);
        }
        if (!map.hasLayer(state.group)) {
          map.addLayer(state.group);
        }
        overlayUi.updateLayer(key, { loading: false, active: true });
        applyOverlayOrder();
      } catch (error) {
        console.error(`Falha ao ativar a camada ${state.def.name || key}.`, error);
        overlayUi.updateLayer(key, { loading: false, active: false });
      }
    } else {
      if (map.hasLayer(state.group)) {
        map.removeLayer(state.group);
      }
      overlayUi.updateLayer(key, { active: false, loading: false });
    }
  }

  function handleLayerOpacityChange(key, value) {
    const state = stateByKey.get(key);
    if (!state) return;
    const clamped = Math.min(1, Math.max(0.1, Number(value))); // value already normalised to 0-1
    state.opacity = clamped;
    state.customOpacity = true;
    updateLayerOpacity(state);
  }

  function handleLayerReorder(order) {
    if (!Array.isArray(order) || !order.length) return;
    overlayOrder = order.slice();
    applyOverlayOrder();
  }

  function applyOverlayOrder() {
    if (!overlayOrder || !overlayOrder.length) return;
    for (let index = overlayOrder.length - 1; index >= 0; index -= 1) {
      const key = overlayOrder[index];
      const state = stateByKey.get(key);
      if (!state || !state.displayLayer || !map.hasLayer(state.group)) continue;
      state.group.eachLayer(layer => {
        if (typeof layer.bringToFront === 'function') {
          layer.bringToFront();
        }
      });
    }
  }

  function createLegendDock() {
    const control = L.control({ position: 'bottomleft' });
    control.onAdd = () => {
      const container = L.DomUtil.create('div', 'legend-dock');
      container.innerHTML = '<div class="legend-empty muted">Ative uma camada para visualizar a legenda dinâmica.</div>';
      return container;
    };
    return control;
  }

  function updateLegendDock() {
    if (!legendContainer) return;
    const entries = [];
    stateByKey.forEach(state => {
      if (!state.ready) return;
      if (!map.hasLayer(state.group)) return;
      const entry = buildLegendEntry(state);
      if (entry) entries.push(entry);
    });
    if (!entries.length) {
      legendContainer.innerHTML = '<div class="legend-empty muted">Ative uma camada para visualizar a legenda dinâmica.</div>';
      return;
    }
    const fragment = document.createDocumentFragment();
    entries.forEach(entry => fragment.appendChild(entry));
    legendContainer.replaceChildren(fragment);
  }

  function buildLegendEntry(state) {
    const legend = state.def.legend;
    if (!legend) return null;
    if (legend.type === 'area-classes') {
      return buildAreaClassesLegend(state.def, legend, state.filtered);
    }
    if (legend.type === 'area-total') {
      return buildAreaTotalLegend(state.def, legend, state.filtered);
    }
    return null;
  }

  function buildAreaClassesLegend(def, legend, items) {
    if (!items || !items.length) {
      return createEmptyLegend(legend.title || def.name);
    }
    const totals = new Map();
    let totalArea = 0;
    items.forEach(item => {
      if (!item.classValue) return;
      const area = item.areaHa || 0;
      if (area <= 0) return;
      totalArea += area;
      totals.set(item.classValue, (totals.get(item.classValue) || 0) + area);
    });
    if (!totals.size || totalArea <= 0) {
      return createEmptyLegend(legend.title || def.name);
    }
    const entries = Array.from(totals.entries()).map(([value, area]) => ({
      value,
      label: value,
      color: legend.getColor ? legend.getColor(value) : legendColorFor(def, items[0]?.feature),
      area,
      pct: totalArea ? (area / totalArea) * 100 : 0
    }));
    entries.sort((a, b) => (a.label || '').localeCompare(b.label || '', 'pt-BR'));
    const block = document.createElement('section');
    block.className = 'legend-block';
    const title = document.createElement('h4');
    title.textContent = legend.title || def.name;
    block.appendChild(title);
    const list = document.createElement('ul');
    list.className = 'legend-list';
    entries.forEach(entry => {
      const item = document.createElement('li');
      item.className = 'legend-item';
      const swatch = document.createElement('span');
      swatch.className = 'legend-swatch';
      swatch.style.background = entry.color || '#4b5563';
      const label = document.createElement('span');
      label.className = 'legend-label';
      label.textContent = entry.label || entry.value || 'Classe';
      const value = document.createElement('span');
      value.className = 'legend-value';
      value.textContent = `${fmt.ha(entry.area)} ha (${fmt.pct(entry.pct)}%)`;
      item.append(swatch, label, value);
      list.appendChild(item);
    });
    block.appendChild(list);
    return block;
  }

  function createEmptyLegend(title) {
    const block = document.createElement('section');
    block.className = 'legend-block';
    const heading = document.createElement('h4');
    heading.textContent = title || 'Legenda';
    const note = document.createElement('div');
    note.className = 'legend-note';
    note.textContent = 'Nenhuma feição disponível para o filtro aplicado.';
    block.appendChild(heading);
    block.appendChild(note);
    return block;
  }

  function buildAreaTotalLegend(def, legend, items) {
    const totalArea = (items || []).reduce((sum, item) => sum + (item.areaHa || 0), 0);
    const totalCount = (items || []).length;
    const block = document.createElement('section');
    block.className = 'legend-block';
    const title = document.createElement('h4');
    title.textContent = legend.title || def.name;
    block.appendChild(title);
    const list = document.createElement('ul');
    list.className = 'legend-list';
    const color = legend.color || legendColorFor(def, items[0]?.feature);
    const row = document.createElement('li');
    row.className = 'legend-item';
    const swatch = document.createElement('span');
    swatch.className = 'legend-swatch';
    swatch.style.background = color;
    const label = document.createElement('span');
    label.className = 'legend-label';
    label.textContent = 'Área total';
    const value = document.createElement('span');
    value.className = 'legend-value';
    value.textContent = `${fmt.ha(totalArea)} ha`;
    row.append(swatch, label, value);
    list.appendChild(row);
    if (legend.includeCount) {
      const countRow = document.createElement('li');
      countRow.className = 'legend-item';
      const spacer = document.createElement('span');
      spacer.className = 'legend-swatch';
      spacer.style.background = 'transparent';
      spacer.style.border = '1px solid transparent';
      const countLabel = document.createElement('span');
      countLabel.className = 'legend-label';
      countLabel.textContent = 'Feições';
      const countValue = document.createElement('span');
      countValue.className = 'legend-value';
      countValue.textContent = fmt.count(totalCount);
      countRow.append(spacer, countLabel, countValue);
      list.appendChild(countRow);
    }
    block.appendChild(list);
    if (totalArea <= 0) {
      const note = document.createElement('div');
      note.className = 'legend-note';
      note.textContent = 'Nenhuma área calculada para o filtro atual.';
      block.appendChild(note);
    }
    return block;
  }

  (async function init() {
    const microState = stateByKey.get('microbacias');
    if (microState) {
      await loadLayer(microState);
      if (!map.hasLayer(microState.group)) {
        map.addLayer(microState.group);
      }
      applyFilters({ fitToMicro: true });
    }
  })();
})();
