const { DEFAULT_SEED_YEAR, buildCompetenciaList } = require('./competenciaSeedService');
const { calculateFiscalRecord } = require('./fiscalCalculationService');
const { createBlankFiscalRecord, createInitialFiscalRecord } = require('./fiscalSheetSchemaService');

function createBlankFiscalCompetenciaRecord(competencia) {
  return calculateFiscalRecord(createBlankFiscalRecord(competencia));
}

function ensureFiscalYearCompetenciasInData(data, year = DEFAULT_SEED_YEAR) {
  const records = [...(data.records || [])];
  const existing = new Set(records.map((entry) => entry.competencia));
  let created = 0;

  if (!existing.has('07/2026') && year === 2026) {
    records.push({
      ...calculateFiscalRecord(createInitialFiscalRecord()),
      updatedAt: new Date().toISOString(),
      updatedBy: 'sistema',
    });
    existing.add('07/2026');
    created += 1;
  }

  for (const competencia of buildCompetenciaList(year)) {
    if (existing.has(competencia)) {
      continue;
    }

    records.push({
      ...createBlankFiscalCompetenciaRecord(competencia),
      updatedAt: new Date().toISOString(),
      updatedBy: 'sistema',
    });
    existing.add(competencia);
    created += 1;
  }

  return {
    records,
    created,
  };
}

module.exports = {
  createBlankFiscalCompetenciaRecord,
  ensureFiscalYearCompetenciasInData,
};
