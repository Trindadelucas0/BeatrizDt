const { isDecemberCompetencia } = require('./calculationService');

const BASE_MONETARY_FIELDS = ['inss', 'irrf', 'emprestimoConsignado', 'fgtsMensal', 'fgtsDecimoTerceiro'];
const DECEMBER_MONETARY_FIELDS = ['inssDecimoTerceiro', 'irrfDecimoTerceiro'];

function getMonetaryFields(record) {
  const fields = [...BASE_MONETARY_FIELDS];

  if (isDecemberCompetencia(record?.competencia)) {
    fields.push(...DECEMBER_MONETARY_FIELDS);
  }

  return fields;
}

function getOrganizationLabel(record) {
  const labels = (record.groups || [])
    .map((group) => group.label)
    .filter(Boolean);

  if (labels.length === 0) {
    return 'Grupo Empresarial';
  }

  return labels.join(' • ');
}

function getPrimaryCompanyName(record) {
  const firstCompany = record.groups?.[0]?.companies?.[0];
  return firstCompany?.name || 'Empresa';
}

function computeFillMetrics(record) {
  let totalFields = 0;
  let filledFields = 0;

  for (const group of record.groups || []) {
    for (const company of group.companies || []) {
      for (const field of getMonetaryFields(record)) {
        totalFields += 1;
        const value = Number(company[field] ?? 0);
        if (Number.isFinite(value) && value > 0) {
          filledFields += 1;
        }
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

function buildLayoutViewModel(record) {
  const fill = computeFillMetrics(record);

  return {
    organizationLabel: getOrganizationLabel(record),
    primaryCompanyName: getPrimaryCompanyName(record),
    fillStatus: fill.status,
    fillStatusLabel: fill.statusLabel,
    fillPercent: fill.percent,
    filledFields: fill.filledFields,
    totalFields: fill.totalFields,
  };
}

function buildCompetenciaStatusMap(records) {
  return Object.fromEntries(
    (records || []).map((record) => {
      const fill = computeFillMetrics(record);
      return [record.competencia, {
        percent: fill.percent,
        status: fill.status,
        statusLabel: fill.statusLabel,
      }];
    }),
  );
}

module.exports = {
  buildCompetenciaStatusMap,
  buildLayoutViewModel,
  computeFillMetrics,
  getOrganizationLabel,
  getPrimaryCompanyName,
};
