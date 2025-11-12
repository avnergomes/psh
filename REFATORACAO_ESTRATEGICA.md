# 🔧 PLANO ESTRATÉGICO DE REFATORAÇÃO - PSH
**Programa de Segurança Hídrica - Diagnóstico Territorial**

---

## 📋 SUMÁRIO EXECUTIVO

Este documento detalha um plano completo de modernização e refatoração da aplicação PSH, focando em melhorias de UX, acessibilidade, responsividade e arquitetura de código.

### Status Atual
- **Tecnologia**: JavaScript Vanilla + Leaflet.js + CSS customizado
- **Estrutura**: Monolítico em arquivo único (~2100 linhas)
- **Dados**: GeoJSON comprimido com manifesto dinâmico
- **Interface**: Painéis fixos com controles básicos

### Objetivos da Refatoração
1. Modernizar interface e interações
2. Implementar acessibilidade WCAG AA
3. Otimizar para dispositivos móveis
4. Melhorar arquitetura de código
5. Adicionar feedback visual e estados de loading

---

## 🎯 PROBLEMAS IDENTIFICADOS E PRIORIZAÇÃO

### P0 - CRÍTICO (Implementação Imediata)

#### 1. **Status de Carregamento Inadequado**
**Problema**: Texto estático "Carregando microbacias..." sem indicador visual
```javascript
// Atual (linha ~1850)
microUi.summary.textContent = 'Carregando microbacias…';
```

**Solução**:
```javascript
// Implementar spinner animado
function showLoadingState(element, message) {
  element.innerHTML = `
    <div class="loading-container">
      <svg class="spinner" viewBox="0 0 50 50">
        <circle cx="25" cy="25" r="20" fill="none" stroke-width="3"></circle>
      </svg>
      <span>${message}</span>
    </div>
  `;
}
```

**CSS Necessário**:
```css
.spinner {
  animation: rotate 2s linear infinite;
  width: 20px;
  height: 20px;
}

.spinner circle {
  stroke: #6366f1;
  stroke-linecap: round;
  animation: dash 1.5s ease-in-out infinite;
}

@keyframes rotate {
  100% { transform: rotate(360deg); }
}

@keyframes dash {
  0% {
    stroke-dasharray: 1, 150;
    stroke-dashoffset: 0;
  }
  50% {
    stroke-dasharray: 90, 150;
    stroke-dashoffset: -35;
  }
  100% {
    stroke-dasharray: 90, 150;
    stroke-dashoffset: -124;
  }
}
```

#### 2. **Sincronização de Opacidade**
**Problema**: HTML mostra `value="60"` mas texto exibe "70%"
```html
<!-- Linha 44 do index.html -->
<input id="opacity" type="range" min="20" max="100" value="70" />
<span id="opacityVal" class="muted">70%</span>
```

**Solução**: Garantir sincronização no carregamento
```javascript
// No início do script, após definir defaultOpacity
if (opacityInput && opacityValue) {
  const currentValue = parseInt(opacityInput.value);
  opacityValue.textContent = `${currentValue}%`;
  defaultOpacity = currentValue / 100;
}
```

#### 3. **Feedback de Busca Ausente**
**Problema**: Sem indicação visual durante busca ou quando não há resultados

**Solução**:
```javascript
function handleSearchInput(query) {
  const normalizedQuery = normaliseText(query);
  
  if (!normalizedQuery) {
    clearSearchState();
    return;
  }
  
  // Mostrar loading
  showSearchLoading(true);
  
  // Debounce search (300ms)
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    performSearch(normalizedQuery);
    showSearchLoading(false);
  }, 300);
}

function performSearch(query) {
  rebuildMicroRows();
  
  // Verificar se há resultados
  if (microState.rows.length === 0) {
    showNoResults(query);
  } else {
    renderMicroList({ resetScroll: true });
  }
}

function showNoResults(query) {
  microUi.listInner.innerHTML = `
    <div class="search-no-results">
      <svg class="icon-search-empty" viewBox="0 0 24 24">
        <path d="M15.5 14h-.79l-.28-.27..."></path>
      </svg>
      <p>Nenhum resultado para <strong>${escapeHtml(query)}</strong></p>
      <button class="btn-chip" onclick="clearSearch()">Limpar busca</button>
    </div>
  `;
}
```

#### 4. **Acessibilidade - Labels**
**Problema**: Labels sem `htmlFor` e ARIA inadequados

**Solução**:
```html
<!-- Antes -->
<span class="muted">Opacidade padrão</span>
<input id="opacity" type="range" min="20" max="100" value="70" />

<!-- Depois -->
<label for="opacity" class="opacity-label">
  Opacidade padrão
  <span class="sr-only">Ajustar opacidade das camadas de 20% a 100%</span>
</label>
<input 
  id="opacity" 
  type="range" 
  min="20" 
  max="100" 
  value="70"
  aria-label="Controle de opacidade das camadas"
  aria-valuemin="20"
  aria-valuemax="100"
  aria-valuenow="70"
  aria-valuetext="70 por cento"
/>
```

**CSS para sr-only**:
```css
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}
```

---

### P1 - IMPORTANTE (Próxima Sprint)

#### 5. **Modernização de Radio Buttons/Checkboxes**
**Solução com CSS Modules**:
```css
/* Custom checkbox styling */
.micro-row input[type="checkbox"] {
  appearance: none;
  -webkit-appearance: none;
  width: 20px;
  height: 20px;
  border: 2px solid #cbd5f5;
  border-radius: 6px;
  background: white;
  cursor: pointer;
  position: relative;
  transition: all 0.2s ease;
}

.micro-row input[type="checkbox"]:hover {
  border-color: #6366f1;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
}

.micro-row input[type="checkbox"]:checked {
  background: #6366f1;
  border-color: #6366f1;
}

.micro-row input[type="checkbox"]:checked::after {
  content: '';
  position: absolute;
  left: 6px;
  top: 2px;
  width: 5px;
  height: 10px;
  border: solid white;
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}

.micro-row input[type="checkbox"]:indeterminate {
  background: #e0e7ff;
  border-color: #6366f1;
}

.micro-row input[type="checkbox"]:indeterminate::after {
  content: '';
  position: absolute;
  left: 4px;
  top: 8px;
  width: 10px;
  height: 2px;
  background: #6366f1;
}
```

#### 6. **Slider de Opacidade Modernizado**
```html
<div class="opacity-control">
  <label for="opacity" class="opacity-label">
    <svg class="icon-opacity" viewBox="0 0 24 24">
      <path d="M12 2L2 17h20L12 2z" opacity="0.3"/>
      <path d="M12 2L2 17h20L12 2z" fill="none" stroke="currentColor"/>
    </svg>
    Opacidade
  </label>
  <div class="slider-wrapper">
    <input 
      id="opacity" 
      type="range" 
      class="custom-slider"
      min="20" 
      max="100" 
      value="70"
    />
    <div class="slider-track">
      <div class="slider-progress" style="width: 70%"></div>
    </div>
    <div class="slider-thumb" style="left: 70%"></div>
  </div>
  <span class="opacity-value">70%</span>
</div>
```

```css
.custom-slider {
  position: relative;
  width: 160px;
  height: 6px;
  -webkit-appearance: none;
  appearance: none;
  background: transparent;
  outline: none;
  z-index: 2;
}

.slider-track {
  position: absolute;
  width: 100%;
  height: 6px;
  background: #e2e8f0;
  border-radius: 999px;
  pointer-events: none;
}

.slider-progress {
  position: absolute;
  height: 100%;
  background: linear-gradient(90deg, #6366f1, #8b5cf6);
  border-radius: 999px;
  transition: width 0.15s ease;
}

.custom-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: white;
  border: 3px solid #6366f1;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.4);
  transition: all 0.2s ease;
}

.custom-slider::-webkit-slider-thumb:hover {
  transform: scale(1.15);
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.5);
}

.custom-slider::-webkit-slider-thumb:active {
  transform: scale(1.05);
}
```

#### 7. **Ícones nos Botões de Zoom**
**Opção 1: SVG Inline**
```html
<button id="fitAll" class="btn btn-icon" type="button">
  <svg class="icon" viewBox="0 0 24 24" width="18" height="18">
    <path d="M15 3l2.3 2.3-2.89 2.87 1.42 1.42L18.7 6.7 21 9V3h-6zM3 9l2.3-2.3 2.87 2.89 1.42-1.42L6.7 5.3 9 3H3v6zm6 12l-2.3-2.3 2.89-2.87-1.42-1.42L5.3 17.3 3 15v6h6zm12-6l-2.3 2.3-2.87-2.89-1.42 1.42 2.89 2.87L15 21h6v-6z"/>
  </svg>
  Ajustar visão
</button>
```

**Opção 2: Usar Lucide Icons via CDN**
```html
<script src="https://unpkg.com/lucide@latest"></script>
<script>
  lucide.createIcons();
</script>

<button id="fitAll" class="btn btn-icon" type="button">
  <i data-lucide="maximize-2"></i>
  Ajustar visão
</button>
```

```css
.btn-icon {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
}

.btn-icon .icon,
.btn-icon svg {
  width: 18px;
  height: 18px;
  stroke-width: 2;
}
```

#### 8. **Normalização de Labels de Temas**
```javascript
// Substituir no setupOverlayManager
const baseLayers = {
  'Claro': layerCartoLight,
  'Escuro': layerCartoDark,
  'OSM Padrão': layerOsm,
  'Satélite': layerEsri,
  'Topográfico': layerTopo
};
```

```html
<!-- No select de temas -->
<select id="themePreset">
  <option value="light">Claro</option>
  <option value="streets">OSM Padrão</option>
  <option value="satellite">Satélite</option>
  <option value="terrain">Topográfico</option>
  <option value="dark">Escuro</option>
</select>
```

#### 9. **Autocomplete com Debounce**
```javascript
let searchTimeout = null;
const SEARCH_DEBOUNCE_MS = 300;

if (microUi.search) {
  microUi.search.addEventListener('input', (e) => {
    const value = e.target.value || '';
    
    // Limpar timeout anterior
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }
    
    // Mostrar indicador de loading
    if (value.length >= 2) {
      showSearchLoading(true);
    }
    
    // Debounce
    searchTimeout = setTimeout(() => {
      searchQuery = value;
      rebuildMicroRows();
      renderMicroList({ resetScroll: true });
      updateAutocomplete();
      showSearchLoading(false);
    }, SEARCH_DEBOUNCE_MS);
  });
}

function showSearchLoading(show) {
  const wrapper = microUi.search?.parentElement;
  if (!wrapper) return;
  
  if (show) {
    wrapper.classList.add('loading');
  } else {
    wrapper.classList.remove('loading');
  }
}
```

```css
.micro-search-wrapper.loading::after {
  content: '';
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  width: 16px;
  height: 16px;
  border: 2px solid #e5e7eb;
  border-top-color: #6366f1;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: translateY(-50%) rotate(360deg); }
}
```

---

### P2 - NICE TO HAVE (Backlog)

#### 10. **Tooltips com Hover States**
```javascript
function createTooltip(element, text, position = 'bottom') {
  element.setAttribute('data-tooltip', text);
  element.setAttribute('data-tooltip-position', position);
}

// Uso
createTooltip(
  document.getElementById('fitAll'),
  'Ajustar o mapa para mostrar todas as camadas ativas',
  'bottom'
);
```

```css
[data-tooltip] {
  position: relative;
  cursor: help;
}

[data-tooltip]::before {
  content: attr(data-tooltip);
  position: absolute;
  bottom: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%) translateY(-4px);
  padding: 0.5rem 0.75rem;
  background: #1e293b;
  color: white;
  font-size: 0.8rem;
  border-radius: 8px;
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  transition: all 0.2s ease;
  z-index: 1000;
}

[data-tooltip]::after {
  content: '';
  position: absolute;
  bottom: calc(100% + 2px);
  left: 50%;
  transform: translateX(-50%);
  border: 6px solid transparent;
  border-top-color: #1e293b;
  opacity: 0;
  transition: opacity 0.2s ease;
}

[data-tooltip]:hover::before,
[data-tooltip]:hover::after {
  opacity: 1;
}

[data-tooltip][data-tooltip-position="top"]::before {
  bottom: auto;
  top: calc(100% + 8px);
  transform: translateX(-50%) translateY(4px);
}
```

---

## 📱 RESPONSIVIDADE

### Breakpoints Estratégicos
```css
/* Mobile First */
:root {
  --panel-width: 100%;
  --topbar-height: auto;
}

/* Tablet (768px+) */
@media (min-width: 768px) {
  :root {
    --panel-width: 380px;
    --topbar-height: 56px;
  }
}

/* Desktop (1024px+) */
@media (min-width: 1024px) {
  :root {
    --panel-width: 420px;
  }
}

/* Large Desktop (1440px+) */
@media (min-width: 1440px) {
  :root {
    --panel-width: 480px;
  }
}
```

### Mobile: Painel como Drawer/Modal
```html
<!-- Adicionar toggle button no mobile -->
<button class="mobile-toggle" id="togglePanel" aria-label="Abrir painel de microbacias">
  <svg viewBox="0 0 24 24">
    <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/>
  </svg>
</button>
```

```css
@media (max-width: 767px) {
  .leaflet-control.micro-filter {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    max-width: 100%;
    max-height: 70vh;
    border-radius: 20px 20px 0 0;
    transform: translateY(calc(100% - 60px));
    transition: transform 0.3s ease;
    z-index: 1001;
  }
  
  .leaflet-control.micro-filter.expanded {
    transform: translateY(0);
  }
  
  .mobile-toggle {
    position: fixed;
    bottom: 16px;
    right: 16px;
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: #6366f1;
    color: white;
    border: none;
    box-shadow: 0 8px 24px rgba(99, 102, 241, 0.4);
    z-index: 1002;
  }
}
```

---

## ♿ ACESSIBILIDADE WCAG AA

### Navegação por Teclado
```javascript
// Adicionar suporte completo a teclado
function setupKeyboardNavigation() {
  // Tab entre elementos interativos
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeAllModals();
    }
    
    if (e.key === 'Tab' && e.shiftKey) {
      // Tab reverso
      handleReverseTab(e);
    }
  });
  
  // Atalhos de teclado
  document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + K: Focar busca
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      microUi.search?.focus();
    }
    
    // Ctrl/Cmd + F: Ajustar visão
    if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
      e.preventDefault();
      document.getElementById('fitAll')?.click();
    }
  });
}
```

### ARIA Live Regions
```html
<!-- Adicionar região de anúncio -->
<div 
  role="status" 
  aria-live="polite" 
  aria-atomic="true" 
  class="sr-only"
  id="status-announcer"
></div>
```

```javascript
function announceStatus(message) {
  const announcer = document.getElementById('status-announcer');
  if (announcer) {
    announcer.textContent = message;
  }
}

// Uso
announceStatus('Carregando 150 microbacias...');
announceStatus('20 ottobacias selecionadas');
announceStatus('Busca retornou 5 resultados');
```

### Contraste de Cores
```css
/* Garantir contraste mínimo 4.5:1 para texto normal */
:root {
  --text-primary: #0f172a;     /* Contraste 12.63:1 */
  --text-secondary: #475569;   /* Contraste 7.15:1 */
  --text-muted: #64748b;       /* Contraste 5.05:1 */
  --link: #2563eb;             /* Contraste 5.14:1 */
  --link-hover: #1d4ed8;       /* Contraste 6.72:1 */
}

/* Estados de foco visíveis */
*:focus-visible {
  outline: 3px solid #2563eb;
  outline-offset: 2px;
  border-radius: 4px;
}

button:focus-visible,
a:focus-visible,
input:focus-visible,
select:focus-visible {
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.3);
}
```

---

## 🏗️ ARQUITETURA E REFATORAÇÃO DE CÓDIGO

### Estrutura Modular Proposta
```
psh/
├── src/
│   ├── core/
│   │   ├── map-manager.js       # Gerenciamento do mapa Leaflet
│   │   ├── layer-loader.js      # Carregamento de camadas GeoJSON
│   │   └── state-manager.js     # Estado global da aplicação
│   ├── components/
│   │   ├── micro-filter/
│   │   │   ├── micro-filter.js
│   │   │   ├── micro-filter.css
│   │   │   └── micro-hierarchy.js
│   │   ├── layer-manager/
│   │   │   ├── layer-manager.js
│   │   │   └── layer-manager.css
│   │   ├── legend/
│   │   │   ├── legend.js
│   │   │   └── legend.css
│   │   └── topbar/
│   │       ├── topbar.js
│   │       └── topbar.css
│   ├── utils/
│   │   ├── geospatial.js       # Funções GeoJSON e geometria
│   │   ├── formatting.js       # Formatação de números
│   │   ├── dom.js              # Helpers DOM
│   │   └── accessibility.js   # Utilitários a11y
│   ├── styles/
│   │   ├── variables.css       # CSS variables
│   │   ├── base.css            # Reset e base styles
│   │   ├── components.css      # Componentes reutilizáveis
│   │   └── responsive.css      # Media queries
│   └── main.js                 # Entry point
├── public/
│   ├── index.html
│   └── assets/
└── dist/                       # Build output
```

### Exemplo de Refatoração: MapManager
```javascript
// src/core/map-manager.js
export class MapManager {
  constructor(containerId, options = {}) {
    this.containerId = containerId;
    this.options = {
      center: [-24.5, -51.5],
      zoom: 7,
      preferCanvas: true,
      ...options
    };
    
    this.map = null;
    this.baseLayers = new Map();
    this.activeBaseLayer = null;
    this.overlayGroups = new Map();
  }
  
  initialize() {
    this.map = L.map(this.containerId, this.options);
    this.setupBaseLayers();
    this.setupControls();
    this.setupEventListeners();
    return this.map;
  }
  
  setupBaseLayers() {
    const layers = {
      light: L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap • © CARTO'
      }),
      dark: L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap • © CARTO'
      }),
      // ... outros layers
    };
    
    Object.entries(layers).forEach(([key, layer]) => {
      this.baseLayers.set(key, layer);
    });
    
    // Ativar layer padrão
    const defaultLayer = this.baseLayers.get('light');
    if (defaultLayer) {
      defaultLayer.addTo(this.map);
      this.activeBaseLayer = defaultLayer;
    }
  }
  
  switchBaseLayer(key) {
    const newLayer = this.baseLayers.get(key);
    if (!newLayer || newLayer === this.activeBaseLayer) return;
    
    if (this.activeBaseLayer) {
      this.map.removeLayer(this.activeBaseLayer);
    }
    
    newLayer.addTo(this.map);
    this.activeBaseLayer = newLayer;
  }
  
  addOverlayGroup(key, group) {
    this.overlayGroups.set(key, group);
  }
  
  fitToBounds(bounds, options = {}) {
    if (!bounds || !bounds.isValid()) return;
    this.map.fitBounds(bounds, {
      padding: [40, 40],
      maxZoom: 14,
      ...options
    });
  }
  
  setupEventListeners() {
    this.map.on('overlayadd', this.handleOverlayAdd.bind(this));
    this.map.on('overlayremove', this.handleOverlayRemove.bind(this));
  }
  
  handleOverlayAdd(event) {
    // Emitir evento customizado
    document.dispatchEvent(new CustomEvent('map:overlay:add', {
      detail: { layer: event.layer }
    }));
  }
  
  handleOverlayRemove(event) {
    document.dispatchEvent(new CustomEvent('map:overlay:remove', {
      detail: { layer: event.layer }
    }));
  }
}
```

### State Manager com Pub/Sub
```javascript
// src/core/state-manager.js
export class StateManager {
  constructor() {
    this.state = {
      layers: new Map(),
      microbacias: {
        hierarchy: null,
        selectedIds: new Set(),
        searchQuery: '',
        collapsed: new Map()
      },
      ui: {
        defaultOpacity: 0.7,
        activeTheme: 'light',
        panelExpanded: false
      }
    };
    
    this.subscribers = new Map();
  }
  
  subscribe(event, callback) {
    if (!this.subscribers.has(event)) {
      this.subscribers.set(event, []);
    }
    this.subscribers.get(event).push(callback);
    
    // Retornar função de unsubscribe
    return () => {
      const callbacks = this.subscribers.get(event);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    };
  }
  
  notify(event, data) {
    const callbacks = this.subscribers.get(event);
    if (callbacks) {
      callbacks.forEach(callback => callback(data));
    }
  }
  
  updateMicroSelection(ids) {
    this.state.microbacias.selectedIds = new Set(ids);
    this.notify('microbacias:selection:change', {
      selectedIds: this.state.microbacias.selectedIds
    });
  }
  
  updateOpacity(value) {
    this.state.ui.defaultOpacity = value;
    this.notify('ui:opacity:change', { opacity: value });
  }
  
  getState() {
    return this.state;
  }
}
```

---

## 🧪 TESTES E QUALIDADE

### Setup de Testes com Vitest
```javascript
// tests/unit/formatting.test.js
import { describe, it, expect } from 'vitest';
import { fmt } from '../../src/utils/formatting';

describe('Formatting utilities', () => {
  describe('fmt.ha', () => {
    it('formats large areas with 0 decimals', () => {
      expect(fmt.ha(150.5)).toBe('151');
    });
    
    it('formats medium areas with 1 decimal', () => {
      expect(fmt.ha(45.67)).toBe('45,7');
    });
    
    it('formats small areas with 2 decimals', () => {
      expect(fmt.ha(1.234)).toBe('1,23');
    });
    
    it('handles invalid input', () => {
      expect(fmt.ha(null)).toBe('0,00');
      expect(fmt.ha(undefined)).toBe('0,00');
      expect(fmt.ha(NaN)).toBe('0,00');
    });
  });
  
  describe('fmt.pct', () => {
    it('formats percentages with 1 decimal', () => {
      expect(fmt.pct(45.678)).toBe('45,7');
    });
  });
});
```

### E2E Tests com Playwright
```javascript
// tests/e2e/micro-filter.spec.js
import { test, expect } from '@playwright/test';

test.describe('Micro Filter Component', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.micro-filter');
  });
  
  test('loads microbacias and displays summary', async ({ page }) => {
    // Aguardar carregamento
    await page.waitForSelector('.micro-summary:not(.muted)', {
      timeout: 5000
    });
    
    const summary = await page.textContent('.micro-summary');
    expect(summary).toContain('ottobacias');
    expect(summary).toContain('rios');
  });
  
  test('search filters microbacias', async ({ page }) => {
    const searchInput = page.locator('[data-role="search"]');
    await searchInput.fill('Iguaçu');
    
    // Aguardar debounce
    await page.waitForTimeout(350);
    
    // Verificar resultados
    const rows = await page.locator('.micro-row').count();
    expect(rows).toBeGreaterThan(0);
  });
  
  test('toggles ottobacia selection', async ({ page }) => {
    // Clicar em primeiro checkbox
    const firstCheckbox = page.locator('.micro-otto input[type="checkbox"]').first();
    await firstCheckbox.click();
    
    // Verificar estado
    expect(await firstCheckbox.isChecked()).toBeTruthy();
    
    // Verificar se mapa atualizou
    // (pode verificar através de evento customizado ou DOM)
  });
});
```

---

## 📦 BUILD E DEPLOY

### Vite Configuration
```javascript
// vite.config.js
import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: 'src',
  publicDir: resolve(__dirname, 'public'),
  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'src/index.html')
      }
    }
  },
  server: {
    port: 3000,
    open: true
  }
});
```

### GitHub Actions CI/CD
```yaml
# .github/workflows/deploy.yml
name: Deploy to GitHub Pages

on:
  push:
    branches: [ main ]

jobs:
  build-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run tests
        run: npm test
      
      - name: Build
        run: npm run build
      
      - name: Deploy to GitHub Pages
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist
```

---

## 📈 MÉTRICAS E PERFORMANCE

### Lighthouse Goals
- **Performance**: > 90
- **Accessibility**: > 95
- **Best Practices**: > 95
- **SEO**: > 90

### Otimizações de Performance
1. **Lazy Loading de Camadas**: Carregar apenas quando ativadas
2. **Virtualização**: Lista de microbacias já implementada
3. **Debounce**: Busca e eventos (já implementado)
4. **Code Splitting**: Dividir em chunks por rota/feature
5. **Service Worker**: Cache de tiles e dados GeoJSON

---

## 🚀 ROADMAP DE IMPLEMENTAÇÃO

### Fase 1 (Sprint 1-2): Fundação
- [ ] Setup de build moderno (Vite)
- [ ] Refatoração da arquitetura base
- [ ] Implementação P0 (loading, sincronização, busca)
- [ ] Acessibilidade básica (labels, ARIA)

### Fase 2 (Sprint 3-4): UX e Design
- [ ] Modernização de controles (checkboxes, sliders)
- [ ] Sistema de ícones (Lucide)
- [ ] Tooltips e feedback visual
- [ ] Responsividade mobile

### Fase 3 (Sprint 5-6): Polish e Testes
- [ ] Testes unitários completos
- [ ] Testes E2E
- [ ] Documentação
- [ ] Performance tuning

### Fase 4 (Sprint 7+): Inovação
- [ ] PWA support
- [ ] Modo offline
- [ ] Export/share features
- [ ] Analytics integration

---

## 📝 CHECKLIST DE IMPLEMENTAÇÃO

### P0 - Crítico
- [ ] Spinner animado em estados de loading
- [ ] Sincronização slider de opacidade
- [ ] Feedback de busca (loading + no results)
- [ ] Labels com htmlFor e ARIA descritivos
- [ ] Navegação por teclado básica

### P1 - Importante
- [ ] Custom checkboxes CSS
- [ ] Slider customizado com progress bar
- [ ] Ícones SVG em botões
- [ ] Normalização de labels de tema
- [ ] Debounce na busca (300ms)
- [ ] Autocomplete melhorado

### P2 - Nice to Have
- [ ] Sistema de tooltips
- [ ] Hover states consistentes
- [ ] Mensagens de estado vazias
- [ ] Animações de transição

### Responsividade
- [ ] Layout mobile-first
- [ ] Drawer/modal em mobile
- [ ] Menu hambúrguer se necessário
- [ ] Testes em 320px, 768px, 1024px, 1920px

### Acessibilidade
- [ ] Contraste WCAG AA
- [ ] ARIA live regions
- [ ] Skip links
- [ ] Foco visível
- [ ] Atalhos de teclado

---

## 🎓 RECURSOS E REFERÊNCIAS

### Design Systems
- [TailwindUI Components](https://tailwindui.com/)
- [Shadcn UI](https://ui.shadcn.com/)
- [Radix UI](https://www.radix-ui.com/)

### Acessibilidade
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)

### Performance
- [Web.dev Performance](https://web.dev/performance/)
- [Lighthouse CI](https://github.com/GoogleChrome/lighthouse-ci)

### Icons
- [Lucide Icons](https://lucide.dev/)
- [Heroicons](https://heroicons.com/)

---

**Documento elaborado por**: Assistente de Desenvolvimento  
**Data**: 2025-01-11  
**Versão**: 1.0  
**Status**: Draft para Revisão
