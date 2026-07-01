const { mergePayloadIntoSchema, migrateRecord } = require('./sheetSchemaService');
const { calculateRecord, GROUP_STATUS, normalizeGroupStatus, sanitizeNumber } = require('./calculationService');

const VALID_GROUP_STATUSES = new Set([GROUP_STATUS.EM_PROCESSO, GROUP_STATUS.CONCLUIDO]);

function validateCompetencia(competencia) {
  return /^(0[1-9]|1[0-2])\/\d{4}$/.test(String(competencia || '').trim());
}

function normalizeRecordInput(payload) {
  const merged = migrateRecord(mergePayloadIntoSchema(payload));

  merged.competencia = String(merged.competencia || '').trim();
  merged.groups = merged.groups.map((group) => ({
    ...group,
    label: String(group.label || '').trim(),
    statusLeft: normalizeGroupStatus(group.statusLeft),
    statusRight: normalizeGroupStatus(group.statusRight),
    companies: group.companies.map((company) => ({
      ...company,
      code: String(company.code || '').trim(),
      name: String(company.name || '').trim(),
      cnpj: String(company.cnpj || '').replace(/\D/g, ''),
      inss: sanitizeNumber(company.inss),
      irrf: sanitizeNumber(company.irrf),
      inssDecimoTerceiro: sanitizeNumber(company.inssDecimoTerceiro),
      irrfDecimoTerceiro: sanitizeNumber(company.irrfDecimoTerceiro),
      emprestimoConsignado: sanitizeNumber(company.emprestimoConsignado),
      fgtsMensal: sanitizeNumber(company.fgtsMensal ?? company.fgts),
      fgtsDecimoTerceiro: sanitizeNumber(company.fgtsDecimoTerceiro),
    })),
  }));

  return calculateRecord(merged);
}

function validateRecord(record) {
  const errors = [];

  if (!validateCompetencia(record.competencia)) {
    errors.push('A competencia deve estar no formato MM/AAAA.');
  }

  for (const group of record.groups || []) {
    ['statusLeft', 'statusRight'].forEach((field) => {
      if (!VALID_GROUP_STATUSES.has(normalizeGroupStatus(group[field]))) {
        errors.push(`O status ${field} do grupo ${group.label} e invalido.`);
      }
    });

    for (const company of group.companies || []) {
      if (!company.code) {
        errors.push(`O codigo da empresa no grupo ${group.label} e obrigatorio.`);
      }

      if (!company.name) {
        errors.push(`O nome da empresa ${company.code || ''} no grupo ${group.label} e obrigatorio.`);
      }

      ['inss', 'irrf', 'inssDecimoTerceiro', 'irrfDecimoTerceiro', 'emprestimoConsignado', 'fgtsMensal', 'fgtsDecimoTerceiro'].forEach((field) => {
        if (!Number.isFinite(company[field])) {
          errors.push(`O campo ${field} da empresa ${company.name || company.code} precisa ser numerico.`);
        }
      });
    }
  }

  return errors;
}

module.exports = {
  normalizeRecordInput,
  validateCompetencia,
  validateRecord,
};
