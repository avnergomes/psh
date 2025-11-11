(function (global, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    global.MicroAggregation = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function trim(value) {
    if (value === undefined || value === null) return '';
    return String(value).trim();
  }

  function normaliseText(value) {
    return trim(value)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .toLowerCase();
  }

  function normaliseKey(value) {
    return normaliseText(value).replace(/[^a-z0-9]+/g, '');
  }

  function normaliseRiverName(rawName) {
    const text = trim(rawName);
    if (!text) return '';
    const withoutParentheses = text.replace(/\s*\([^)]*\)\s*/g, ' ');
    const withoutSeparators = withoutParentheses
      .replace(/\s*[\/|\\]-?\s*.+$/, '')
      .replace(/\s*[–—-]\s*.+$/, '');
    const compact = withoutSeparators.replace(/\s+/g, ' ').trim();
    if (!compact) return '';
    return compact;
  }

  function deriveRiverKey(rawName) {
    const simplified = normaliseRiverName(rawName);
    const keySource = simplified || rawName;
    return normaliseKey(keySource || '');
  }

  function buildRiverHierarchy(entries) {
    const groupMap = new Map();
    const idLookup = new Map();
    const allIds = [];

    entries.forEach(entry => {
      if (!entry || !entry.id) return;
      const id = trim(entry.id);
      if (!id) return;
      const riverRaw = entry.riverRaw || '';
      const riverFull = trim(entry.riverFull || riverRaw);
      const riverDisplay = normaliseRiverName(riverFull) || riverFull || id;
      const riverKey = deriveRiverKey(riverFull || riverRaw || riverDisplay || id);
      if (!riverKey) return;
      const area = Number(entry.areaHa) || 0;
      let idInfo = idLookup.get(id);
      if (!idInfo) {
        idInfo = {
          id,
          areaHa: area > 0 ? area : 0,
          riverKey,
          riverDisplay,
          riverFullName: riverFull || riverDisplay,
          label: entry.label || `Ottobacia ${id}`,
          fullLabel: entry.fullLabel || entry.label || `Ottobacia ${id}`,
          searchTokens: new Set(),
          metadata: entry.metadata || null
        };
        idLookup.set(id, idInfo);
        allIds.push(id);
      } else if (area > 0) {
        idInfo.areaHa = Math.max(idInfo.areaHa || 0, area);
      }
      if (!idInfo.label && entry.label) {
        idInfo.label = entry.label;
      }
      if (!idInfo.fullLabel && entry.fullLabel) {
        idInfo.fullLabel = entry.fullLabel;
      }
      const searchExtras = entry.searchExtras ? normaliseText(entry.searchExtras) : '';
      idInfo.searchTokens.add(normaliseText(`${id} ${entry.label || ''} ${entry.fullLabel || ''} ${searchExtras}`));
      const group = groupMap.get(riverKey) || {
        key: riverKey,
        displayName: riverDisplay,
        fullNames: new Set(),
        ottobacias: new Map(),
        totalArea: 0,
        searchTokens: new Set()
      };
      group.fullNames.add(riverFull || riverDisplay);
      if (!group.ottobacias.has(id)) {
        group.ottobacias.set(id, idInfo);
      }
      group.totalArea += area > 0 ? area : 0;
      const groupSearchExtra = entry.searchExtras ? ` ${entry.searchExtras}` : '';
      group.searchTokens.add(normaliseText(`${riverDisplay} ${riverFull} ${idInfo.label}${groupSearchExtra}`));
      groupMap.set(riverKey, group);
    });

    const groups = Array.from(groupMap.values()).map(group => {
      const ottos = Array.from(group.ottobacias.values()).map(info => ({
        id: info.id,
        label: info.label,
        fullLabel: info.fullLabel,
        areaHa: info.areaHa,
        search: Array.from(info.searchTokens).join(' ')
      }));
      ottos.sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
      const fullName = Array.from(group.fullNames).sort((a, b) => a.length - b.length)[0] || group.displayName;
      return {
        key: group.key,
        name: group.displayName,
        fullName,
        totalArea: ottos.reduce((sum, item) => sum + (item.areaHa || 0), 0),
        ottobacias: ottos,
        search: Array.from(group.searchTokens).join(' ')
      };
    });

    groups.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

    return {
      groups,
      idLookup,
      allIds
    };
  }

  function calculateSelectionTotals(hierarchy, selectedIds) {
    const ids = Array.isArray(selectedIds) ? selectedIds : Array.from(selectedIds || []);
    const lookup = hierarchy?.idLookup;
    const byRiver = new Map();
    let total = 0;
    let unique = 0;
    if (!lookup || !(lookup instanceof Map) || !lookup.size) {
      return { totalArea: 0, byRiver, uniqueCount: 0 };
    }
    const seen = new Set();
    ids.forEach(rawId => {
      const id = trim(rawId);
      if (!id || seen.has(id)) return;
      const info = lookup.get(id);
      if (!info) return;
      seen.add(id);
      unique += 1;
      total += info.areaHa || 0;
      const riverKey = info.riverKey;
      const current = byRiver.get(riverKey) || {
        key: riverKey,
        name: info.riverDisplay || info.riverFullName || riverKey,
        areaHa: 0
      };
      current.areaHa += info.areaHa || 0;
      byRiver.set(riverKey, current);
    });
    return { totalArea: total, byRiver, uniqueCount: unique };
  }

  return {
    normaliseRiverName,
    deriveRiverKey,
    buildRiverHierarchy,
    calculateSelectionTotals
  };
});
