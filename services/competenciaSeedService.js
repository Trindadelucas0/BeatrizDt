const { calculateRecord } = require('./calculationService');
const { createInitialRecord } = require('./sheetSchemaService');

const DEFAULT_SEED_YEAR = 2026;
const MONETARY_FIELDS = ['inss', 'irrf', 'inssDecimoTerceiro', 'irrfDecimoTerceiro', 'emprestimoConsignado', 'fgtsMensal', 'fgtsDecimoTerceiro'];

function buildCompetenciaList(year = DEFAULT_SEED_YEAR) {
  return Array.from({ length: 12 }, (_, index) => {
    const month = String(index + 1).padStart(2, '0');
    return `${month}/${year}`;
  });
}

function zeroMonetaryFields(record) {
  const nextRecord = JSON.parse(JSON.stringify(record));

  nextRecord.groups = (nextRecord.groups || []).map((group) => ({
    ...group,
    companies: (group.companies || []).map((company) => {
      const cleared = { ...company };
      MONETARY_FIELDS.forEach((field) => {
        cleared[field] = 0;
      });
      return cleared;
    }),
  }));

  return nextRecord;
}

function createBlankRecord(competencia) {
  const record = zeroMonetaryFields(createInitialRecord());
  record.competencia = competencia;
  return calculateRecord(record);
}

function ensureYearCompetenciasInData(data, year = DEFAULT_SEED_YEAR) {
  const records = [...(data.records || [])];
  const existing = new Set(records.map((entry) => entry.competencia));
  let created = 0;

  for (const competencia of buildCompetenciaList(year)) {
    if (existing.has(competencia)) {
      continue;
    }

    records.push({
      ...createBlankRecord(competencia),
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
  DEFAULT_SEED_YEAR,
  buildCompetenciaList,
  createBlankRecord,
  ensureYearCompetenciasInData,
  zeroMonetaryFields,
};
