(() => {
  'use strict';

  const turf = window.turf || null;
  const pako = window.pako || null;

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
      key: 'uso_app',
      manifestKey: 'conflitosdeuso__uso_solo_em_app',
      name: 'Uso do Solo em APP',
      type: 'polygon',
      filesFallback: buildSequenceFiles('conflitosdeuso__uso_solo_em_app.geojson_part-', 2, 2),
      areaProperty: 'area_ha',
      legend: {
        type: 'area-classes',
        title: 'Uso do Solo em APP',
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

  function buildLayerDefinitions(manifest) {
    const defs = [];
    const consumedKeys = new Set();
    LAYER_CONFIGS.forEach(config => {
      const { filesFallback = [], ...rest } = config;
      const manifestFiles = manifest && Array.isArray(manifest[config.manifestKey])
        ? manifest[config.manifestKey]
        : null;
      if (manifestFiles) {
        consumedKeys.add(config.manifestKey);
      }
      const files = manifestFiles && manifestFiles.length ? manifestFiles : filesFallback;
      if (!files || !files.length) return;
      defs.push({ ...rest, files });
    });
    if (manifest) {
      Object.keys(manifest).forEach(key => {
        if (consumedKeys.has(key)) return;
        const files = manifest[key];
        if (!Array.isArray(files) || !files.length) return;
        defs.push({
          key,
          manifestKey: key,
          name: key.replace(/_/g, ' '),
          type: 'polygon',
          files,
          legend: null
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

  function buildGeoJsonLayer(def, features) {
    const options = {};
    options.style = feature => getFeatureStyle(def, feature);
    options.onEachFeature = (feature, layer) => {
      const content = createPopupContent(feature);
      if (content) {
        layer.bindPopup(`<div class=\"popup-content\">${content}</div>`);
      }
    };
    return L.geoJSON(features, options);
  }

  function getFeatureStyle(def, feature) {
    const context = { opacity: currentOpacity };
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
    if (def.type === 'line') {
      return {
        color: '#1f2937',
        weight: 1,
        opacity: Math.min(1, Math.max(0.35, currentOpacity))
      };
    }
    return {
      color: '#1f2937',
      weight: 0.5,
      fillColor: '#cbd5f5',
      fillOpacity: 0.5 * currentOpacity,
      opacity: currentOpacity
    };
  }

  function legendColorFor(def, feature) {
    const style = getFeatureStyle(def, feature);
    return style.fillColor || style.color || '#1f2937';
  }

  const baseLayers = {
    'CARTO Light': L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap • © CARTO'
    }),
    'OSM Padrão': L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap colaboradores'
    }),
    'Esri Imagery': L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Imagens © Esri & partners'
    })
  };

  const map = L.map('map', {
    center: [-24.5, -51.5],
    zoom: 7,
    preferCanvas: true,
    layers: [baseLayers['CARTO Light']]
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

  const microUi = setupMicroFilterControl();
  let microOptions = [];
  const allMicroIds = new Set();
  let activeIds = new Set();
  let microOptionsReady = false;

  let currentOpacity = 0.7;
  const opacityInput = document.getElementById('opacity');
  const opacityValue = document.getElementById('opacityVal');
  if (opacityInput) {
    const initial = Number(opacityInput.value || 70);
    const clamped = Math.min(100, Math.max(20, Number.isFinite(initial) ? initial : 70));
    currentOpacity = clamped / 100;
    if (opacityValue) {
      opacityValue.textContent = `${clamped}%`;
    }
    opacityInput.addEventListener('input', event => {
      const raw = Number(event.target.value);
      const next = Math.min(100, Math.max(20, Number.isFinite(raw) ? raw : 70));
      currentOpacity = next / 100;
      if (opacityValue) {
        opacityValue.textContent = `${next}%`;
      }
      stateByKey.forEach(updateLayerOpacity);
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
        idField: null
      };
      stateByKey.set(def.key, state);
      groupLookup.set(group, def.key);
      layerControl.addOverlay(group, def.name || def.key);
    });
  }

  map.on('overlayadd', event => {
    const key = groupLookup.get(event.layer);
    if (!key) return;
    const state = stateByKey.get(key);
    if (!state) return;
    if (!state.ready) {
      loadLayer(state).then(() => {
        applyFilters();
      }).catch(error => {
        console.error(`Falha ao carregar a camada ${state.def.name}`, error);
      });
    } else {
      applyFilters();
    }
  });

  map.on('overlayremove', event => {
    if (!groupLookup.has(event.layer)) return;
    updateLegendDock();
  });

  if (microUi.search) {
    microUi.search.addEventListener('input', () => {
      renderMicroList();
    });
  }

  if (microUi.selectAll) {
    microUi.selectAll.addEventListener('click', () => {
      if (!microOptions.length) return;
      activeIds = new Set(allMicroIds);
      updateMicroSummary();
      renderMicroList();
      applyFilters({ fitToMicro: true });
    });
  }

  if (microUi.clear) {
    microUi.clear.addEventListener('click', () => {
      activeIds = new Set();
      updateMicroSummary();
      renderMicroList();
      applyFilters({ fitToMicro: true });
    });
  }

  function getEffectiveIds() {
    if (!microOptionsReady || !microOptions.length) return null;
    if (!activeIds) return null;
    if (activeIds.size === 0) return new Set();
    if (activeIds.size >= microOptions.length) return null;
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
        const layer = buildGeoJsonLayer(def, features);
        state.group.addLayer(layer);
        state.displayLayer = layer;
        updateLayerOpacity(state);
      } else {
        state.displayLayer = null;
      }
    });
    updateLegendDock();
    if (options.fitToMicro) {
      const microState = stateByKey.get('microbacias');
      if (microState && microState.displayLayer) {
        const bounds = microState.displayLayer.getBounds?.();
        if (bounds && bounds.isValid && bounds.isValid()) {
          map.fitBounds(bounds.pad(0.08));
        }
      }
    }
  }

  function updateLayerOpacity(state) {
    if (!state.displayLayer) return;
    state.displayLayer.eachLayer(layer => {
      const feature = layer?.feature;
      if (!feature || typeof layer.setStyle !== 'function') return;
      layer.setStyle(getFeatureStyle(state.def, feature));
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
      const idField = sampleProps ? findField(sampleProps, ID_FIELD_CANDIDATES) : null;
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
    const mapById = new Map();
    enriched.forEach(entry => {
      const { feature, id } = entry;
      const props = feature?.properties || {};
      const riverName = trim(id || getFirstValue(props, MICRO_RIVER_FIELDS));
      const fallbackId = trim(getFirstValue(props, MICRO_ID_FALLBACK_FIELDS));
      const optionId = riverName || fallbackId;
      if (!optionId || mapById.has(optionId)) return;
      const bacia = trim(getFirstValue(props, MICRO_BACIA_FIELDS));
      const manancial = trim(getFirstValue(props, MICRO_MANANCIAL_FIELDS));
      const subtitleParts = [];
      if (fallbackId && fallbackId !== optionId) {
        subtitleParts.push(`Ottobacia ${fallbackId}`);
      }
      if (bacia) subtitleParts.push(bacia);
      if (manancial && manancial !== riverName) subtitleParts.push(manancial);
      const title = riverName || (fallbackId ? `Ottobacia ${fallbackId}` : optionId);
      mapById.set(optionId, {
        id: optionId,
        title,
        subtitle: subtitleParts.join(' • '),
        search: normaliseText(`${optionId} ${riverName} ${fallbackId} ${bacia} ${manancial}`)
      });
    });
    microOptions = Array.from(mapById.values()).sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'));
    allMicroIds.clear();
    microOptions.forEach(option => allMicroIds.add(option.id));
    activeIds = new Set(allMicroIds);
    microOptionsReady = true;
    refreshMicroUi();
  }

  function refreshMicroUi() {
    updateMicroSummary();
    renderMicroList();
  }

  function updateMicroSummary() {
    if (!microUi.summary) return;
    if (!microOptionsReady) {
      microUi.summary.textContent = 'Carregando microbacias…';
      microUi.summary.classList.add('muted');
      return;
    }
    if (!microOptions.length) {
      microUi.summary.textContent = 'Nenhuma microbacia disponível.';
      microUi.summary.classList.add('muted');
      return;
    }
    const total = allMicroIds.size || microOptions.length;
    const selected = activeIds ? activeIds.size : 0;
    if (!selected) {
      microUi.summary.textContent = 'Nenhuma microbacia selecionada.';
      microUi.summary.classList.remove('muted');
    } else if (selected >= total) {
      microUi.summary.textContent = `Todas as ${microOptions.length} microbacias selecionadas.`;
      microUi.summary.classList.remove('muted');
    } else {
      microUi.summary.textContent = `${selected} de ${microOptions.length} microbacias selecionadas.`;
      microUi.summary.classList.remove('muted');
    }
  }

  function renderMicroList() {
    if (!microUi.list) return;
    microUi.list.innerHTML = '';
    const fragment = document.createDocumentFragment();
    const query = microUi.search ? normaliseText(microUi.search.value) : '';
    let rendered = 0;
    if (!microOptionsReady) {
      const info = document.createElement('div');
      info.className = 'micro-empty muted';
      info.textContent = 'Carregando microbacias…';
      fragment.appendChild(info);
    } else {
      microOptions.forEach(option => {
        if (query && !option.search.includes(query)) return;
        rendered += 1;
        const label = document.createElement('label');
        label.className = 'micro-option';
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.value = option.id;
        input.checked = activeIds.size ? activeIds.has(option.id) : false;
        input.addEventListener('change', event => {
          handleOptionToggle(option.id, event.target.checked);
        });
        const text = document.createElement('div');
        text.className = 'micro-option-text';
        const title = document.createElement('div');
        title.className = 'micro-option-title';
        title.textContent = option.title;
        text.appendChild(title);
        if (option.subtitle) {
          const subtitle = document.createElement('div');
          subtitle.className = 'micro-option-sub';
          subtitle.textContent = option.subtitle;
          text.appendChild(subtitle);
        }
        label.appendChild(input);
        label.appendChild(text);
        fragment.appendChild(label);
      });
    }
    if (microOptionsReady && rendered === 0) {
      const empty = document.createElement('div');
      empty.className = 'micro-empty muted';
      empty.textContent = query ? 'Nenhuma microbacia corresponde à busca.' : 'Nenhuma microbacia disponível.';
      fragment.appendChild(empty);
    }
    microUi.list.appendChild(fragment);
  }

  function handleOptionToggle(id, checked) {
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
          </div>
          <div class="micro-actions">
            <input type="search" class="micro-search" placeholder="Buscar por rio, bacia ou ID" data-role="search" />
            <div class="micro-buttons">
              <button type="button" class="btn-chip" data-action="select-all">Selecionar todas</button>
              <button type="button" class="btn-chip" data-action="clear">Limpar seleção</button>
            </div>
          </div>
          <div class="micro-list" data-role="list"></div>
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
      list: container.querySelector('[data-role="list"]'),
      selectAll: container.querySelector('[data-action="select-all"]'),
      clear: container.querySelector('[data-action="clear"]')
    };
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
