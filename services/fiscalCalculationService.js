const { TAX_FIELDS, migrateFiscalRecord } = require('./fiscalSheetSchemaService');

const SPECIAL_CELL_VALUES = new Set(['SALDO CREDOR']);

function sanitizeNumber(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? Number(value.toFixed(2)) : 0;
  }

  const normalized = String(value || '')
    .replace(/[R$\s]/g, '')
    .replace(/\./g, '')
    .replace(',', '.')
    .trim();

  if (!normalized || normalized === '-') {
    return 0;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? Number(parsed.toFixed(2)) : 0;
}

function normalizeCellValue(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? Number(value.toFixed(2)) : null;
  }

  const text = String(value).trim();
  if (!text || text === '-' || text.toUpperCase() === 'R$ -') {
    return null;
  }

  const upper = text.toUpperCase();
  if (SPECIAL_CELL_VALUES.has(upper)) {
    return upper;
  }

  if (/[a-zA-Z]/.test(text) && !/^R\$/i.test(text)) {
    return upper;
  }

  const numeric = sanitizeNumber(text);
  return Number.isFinite(numeric) ? numeric : null;
}

function isNumericCell(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function formatFiscalCell(value) {
  if (value === null || value === undefined || value === '') {
    return 'R$ -';
  }

  if (typeof value === 'string') {
    return value;
  }

  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

function calculateFiscalTotals(rows) {
  const totals = Object.fromEntries(TAX_FIELDS.map((field) => [field, 0]));

  for (const row of rows || []) {
    for (const field of TAX_FIELDS) {
      const value = row[field];
      if (isNumericCell(value)) {
        totals[field] = Number((totals[field] + value).toFixed(2));
      }
    }
  }

  return totals;
}

function calculateFiscalRecord(record) {
  const migrated = migrateFiscalRecord(record);
  const rows = (migrated.rows || []).map((row) => {
    const next = {
      ...row,
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

  return {
    ...migrated,
    rows,
    totals: calculateFiscalTotals(rows),
  };
}

function computeFiscalFillMetrics(record) {
  const calculated = calculateFiscalRecord(record);
  let totalFields = 0;
  let filledFields = 0;

  for (const row of calculated.rows || []) {
    for (const field of TAX_FIELDS) {
      totalFields += 1;
      const value = row[field];
      if (value !== null && value !== undefined && value !== '') {
        filledFields += 1;
      }
    }
  }

  const percent = totalFields > 0 ? Math.round((filledFields / totalFields) * 100) : 0;
  let status = 'rascunho';
  let statusLabel = 'Rascunho';

  if (percent === 100) {
    status = 'concluido';
    statusLabel = 'Concluido';
  } else if (percent > 0) {
    status = 'em_preenchimento';
    statusLabel = 'Em preenchimento';
  }

  return {
    percent,
    status,
    statusLabel,
    filledFields,
    totalFields,
  };
}

function buildFiscalCompetenciaStatusMap(records) {
  return Object.fromEntries(
    (records || []).map((record) => {
      const fill = computeFiscalFillMetrics(record);
      return [record.competencia, {
        percent: fill.percent,
        status: fill.status,
        statusLabel: fill.statusLabel,
      }];
    }),
  );
}

module.exports = {
  SPECIAL_CELL_VALUES,
  buildFiscalCompetenciaStatusMap,
  calculateFiscalRecord,
  calculateFiscalTotals,
  computeFiscalFillMetrics,
  formatFiscalCell,
  isNumericCell,
  normalizeCellValue,
  sanitizeNumber,
};
