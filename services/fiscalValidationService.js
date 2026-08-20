const { TAX_FIELDS, mergeFiscalPayloadIntoSchema, migrateFiscalRecord } = require('./fiscalSheetSchemaService');
const { calculateFiscalRecord, normalizeCellValue } = require('./fiscalCalculationService');

function validateCompetencia(competencia) {
  return /^(0[1-9]|1[0-2])\/\d{4}$/.test(String(competencia || '').trim());
}

function normalizeFiscalRecordInput(payload) {
  const merged = migrateFiscalRecord(mergeFiscalPayloadIntoSchema(payload));

  merged.competencia = String(merged.competencia || '').trim();
  merged.dataPreenchimento = String(merged.dataPreenchimento || '').trim();
  merged.responsavel = String(merged.responsavel || '').trim();
  merged.observacoes = String(merged.observacoes || '');
  merged.statusGeral = String(merged.statusGeral || 'Em conferência').trim() || 'Em conferência';
  merged.rows = (merged.rows || []).map((row, index) => {
    const next = {
      ...row,
      id: String(row.id || `row-${index + 1}`),
      dominio: String(row.dominio || '').trim(),
      sistemaDauto: String(row.sistemaDauto || '').trim(),
      local: String(row.local || '').trim(),
      empresa: String(row.empresa || '').trim(),
    };

    for (const field of TAX_FIELDS) {
      next[field] = normalizeCellValue(row[field]);
    }

    return next;
  });

  return calculateFiscalRecord(merged);
}

function validateFiscalRecord(record) {
  const errors = [];

  if (!validateCompetencia(record.competencia)) {
    errors.push('A competencia deve estar no formato MM/AAAA.');
  }

  for (const row of record.rows || []) {
    if (!row.empresa) {
      errors.push('Toda linha fiscal precisa ter o nome da empresa.');
    }

    for (const field of TAX_FIELDS) {
      const value = row[field];
      if (value === null || value === undefined || typeof value === 'string') {
        continue;
      }

      if (!Number.isFinite(value)) {
        errors.push(`O campo ${field} da empresa ${row.empresa || row.id} e invalido.`);
      }
    }
  }

  return errors;
}

module.exports = {
  normalizeFiscalRecordInput,
  validateCompetencia,
  validateFiscalRecord,
};
