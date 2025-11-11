import { describe, it, expect } from 'vitest';
import MicroAggregation from '../utils/microAggregation.js';

const {
  normaliseRiverName,
  buildRiverHierarchy,
  calculateSelectionTotals
} = MicroAggregation;

describe('MicroAggregation helpers', () => {
  it('normalises river names by removing redundant suffixes', () => {
    expect(normaliseRiverName('Rio Pirapó (Trecho 1)')).toBe('Rio Pirapó');
    expect(normaliseRiverName('Córrego Água Fria - Jusante')).toBe('Córrego Água Fria');
    expect(normaliseRiverName('Ribeirão dos Patos / Alto Curso')).toBe('Ribeirão dos Patos');
  });

  it('builds grouped hierarchy without duplicating ottobacias', () => {
    const hierarchy = buildRiverHierarchy([
      { id: '001', riverRaw: 'Rio Pirapó (Trecho 1)', areaHa: 12.5, label: 'Otto 001' },
      { id: '002', riverRaw: 'Rio Pirapó – Jusante', areaHa: 8.1, label: 'Otto 002' },
      { id: '002', riverRaw: 'Rio Pirapó', areaHa: 8.1, label: 'Otto 002 duplicada' },
      { id: '003', riverRaw: 'Ribeirão dos Patos', areaHa: 5.2, label: 'Otto 003' },
      { id: '004', riverRaw: 'Córrego Água Fria / Alto', areaHa: 6.4, label: 'Otto 004' }
    ]);

    expect(hierarchy.groups).toHaveLength(3);
    const pirapo = hierarchy.groups.find(group => group.name === 'Rio Pirapó');
    expect(pirapo).toBeTruthy();
    expect(pirapo.ottobacias).toHaveLength(2);
    const duplicated = pirapo.ottobacias.find(item => item.id === '002');
    expect(duplicated.areaHa).toBeCloseTo(8.1, 3);
  });

  it('computes selection totals consistently for multiple scenarios', () => {
    const hierarchy = buildRiverHierarchy([
      { id: 'A1', riverRaw: 'Rio Pirapó (Montante)', areaHa: 10.25, label: 'A1' },
      { id: 'A2', riverRaw: 'Rio Pirapó – Jusante', areaHa: 14.5, label: 'A2' },
      { id: 'B1', riverRaw: 'Ribeirão dos Patos', areaHa: 9.75, label: 'B1' },
      { id: 'B2', riverRaw: 'Ribeirão dos Patos', areaHa: 11.1, label: 'B2' },
      { id: 'C1', riverRaw: 'Córrego Água Fria', areaHa: 7.35, label: 'C1' },
      { id: 'C2', riverRaw: 'Córrego Água Fria (Jusante)', areaHa: 6.2, label: 'C2' }
    ]);

    const single = calculateSelectionTotals(hierarchy, ['A1']);
    expect(single.totalArea).toBeCloseTo(10.25, 3);
    expect(single.uniqueCount).toBe(1);

    const triple = calculateSelectionTotals(hierarchy, ['A1', 'A2', 'B1']);
    expect(triple.totalArea).toBeCloseTo(10.25 + 14.5 + 9.75, 3);
    expect(triple.uniqueCount).toBe(3);

    const sextet = calculateSelectionTotals(hierarchy, ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']);
    const expectedTotal = 10.25 + 14.5 + 9.75 + 11.1 + 7.35 + 6.2;
    expect(sextet.totalArea).toBeCloseTo(expectedTotal, 3);
    expect(sextet.uniqueCount).toBe(6);
    let sumPartial = 0;
    sextet.byRiver.forEach(item => {
      sumPartial += item.areaHa;
    });
    expect(sumPartial).toBeCloseTo(sextet.totalArea, 6);
  });
});
