const { normalizeGroupStatus } = require('./calculationService');

const BASE_RECORD = {
  competencia: '03/2026',
  dataPreenchimento: '',
  responsavel: '',
  observacoes: '',
  statusGeral: 'Em conferência',
  metadata: {
    titleLeft: 'RESUMO IMPOSTOS DARF INSS/IRRF',
    titleRight: 'RESUMO IMPOSTOS - FGTS MENSAL E DECIMO TERCEIRO',
    titleThird: 'RESUMO IMPOSTOS - FGTS DECIMO TERCEIRO',
    sourceFile: 'RESUMO IMPOSTOS FOLHA.xlsx',
  },
  groups: [
    {
      id: 'etica',
      label: 'ETICA',
      statusLeft: 'em_processo',
      statusRight: 'em_processo',
      companies: [
        { id: 'etica-56', code: '56', name: 'ETICA MATRIZ', cnpj: '4744446000181', inss: 9607.99, irrf: 170.23, emprestimoConsignado: 6452.3, fgtsMensal: 9015.07, fgtsDecimoTerceiro: 0 },
        { id: 'etica-92', code: '92', name: 'ETICA FILIAL', cnpj: '', inss: 4634.02, irrf: 0, emprestimoConsignado: 1095.04, fgtsMensal: 4244.66, fgtsDecimoTerceiro: 0 },
      ],
    },
    {
      id: 'mercado',
      label: 'MERCADO',
      statusLeft: 'em_processo',
      statusRight: 'em_processo',
      companies: [
        { id: 'mercado-67', code: '67', name: 'MERCADO MATRIZ', cnpj: '72628407000179', inss: 3040.65, irrf: 418.19, emprestimoConsignado: 1489.14, fgtsMensal: 2302.71, fgtsDecimoTerceiro: 0 },
        { id: 'mercado-69', code: '69', name: 'MERCADO FILIAL 03', cnpj: '', inss: 1101.83, irrf: 0, emprestimoConsignado: 702.72, fgtsMensal: 1066.23, fgtsDecimoTerceiro: 0 },
      ],
    },
    {
      id: 'vt',
      label: 'V&T',
      statusLeft: 'em_processo',
      statusRight: 'em_processo',
      companies: [
        { id: 'vt-45', code: '45', name: 'V&T MATRIZ', cnpj: '36113768000119', inss: 1545.17, irrf: 209.13, emprestimoConsignado: 2240.15, fgtsMensal: 1446.6, fgtsDecimoTerceiro: 0 },
        { id: 'vt-150', code: '150', name: 'V&T FILIAL', cnpj: '', inss: 766.58, irrf: 0, emprestimoConsignado: 853.14, fgtsMensal: 728.17, fgtsDecimoTerceiro: 0 },
      ],
    },
    {
      id: 'unica',
      label: 'UNICA',
      statusLeft: 'em_processo',
      statusRight: 'em_processo',
      companies: [
        { id: 'unica-46', code: '46', name: 'UNICA', cnpj: '36517206000130', inss: 4787.14, irrf: 0, emprestimoConsignado: 1673.46, fgtsMensal: 661.52, fgtsDecimoTerceiro: 0 },
      ],
    },
  ],
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createInitialRecord() {
  return clone(BASE_RECORD);
}

function getBaseRecord() {
  return clone(BASE_RECORD);
}

function mergePayloadIntoSchema(payload = {}) {
  const base = createInitialRecord();
  const incomingGroups = new Map((payload.groups || []).map((group) => [group.id, group]));

  base.competencia = typeof payload.competencia === 'string' && payload.competencia.trim()
    ? payload.competencia.trim()
    : base.competencia;

  base.dataPreenchimento = typeof payload.dataPreenchimento === 'string'
    ? payload.dataPreenchimento.trim()
    : base.dataPreenchimento;

  base.responsavel = typeof payload.responsavel === 'string'
    ? payload.responsavel.trim()
    : base.responsavel;

  base.observacoes = typeof payload.observacoes === 'string'
    ? payload.observacoes
    : base.observacoes;

  base.statusGeral = typeof payload.statusGeral === 'string' && payload.statusGeral.trim()
    ? payload.statusGeral.trim()
    : base.statusGeral;

  base.metadata = {
    ...base.metadata,
    ...(payload.metadata || {}),
  };

  base.groups = base.groups.map((group) => {
    const incomingGroup = incomingGroups.get(group.id) || {};
    const companiesMap = new Map((incomingGroup.companies || []).map((company) => [company.id, company]));

    return {
      ...group,
      label: incomingGroup.label || group.label,
      statusLeft: incomingGroup.statusLeft !== undefined ? incomingGroup.statusLeft : group.statusLeft,
      statusRight: incomingGroup.statusRight !== undefined ? incomingGroup.statusRight : group.statusRight,
      companies: group.companies.map((company) => ({
        ...company,
        ...(companiesMap.get(company.id) || {}),
      })),
    };
  });

  return base;
}

function migrateCompany(company = {}) {
  const migrated = { ...company };

  if (migrated.fgtsMensal === undefined && migrated.fgts !== undefined) {
    migrated.fgtsMensal = migrated.fgts;
  }

  if (migrated.fgtsDecimoTerceiro === undefined) {
    migrated.fgtsDecimoTerceiro = 0;
  }

  if (migrated.inssDecimoTerceiro === undefined) {
    migrated.inssDecimoTerceiro = 0;
  }

  if (migrated.irrfDecimoTerceiro === undefined) {
    migrated.irrfDecimoTerceiro = 0;
  }

  delete migrated.fgts;

  return migrated;
}

function migrateRecord(record = {}) {
  const migrated = clone(record);

  migrated.metadata = {
    titleLeft: 'RESUMO IMPOSTOS DARF INSS/IRRF',
    titleRight: 'RESUMO IMPOSTOS - FGTS MENSAL E DECIMO TERCEIRO',
    titleThird: 'RESUMO IMPOSTOS - FGTS DECIMO TERCEIRO',
    sourceFile: 'RESUMO IMPOSTOS FOLHA.xlsx',
    ...(migrated.metadata || {}),
  };

  migrated.dataPreenchimento = typeof migrated.dataPreenchimento === 'string'
    ? migrated.dataPreenchimento
    : '';

  migrated.responsavel = typeof migrated.responsavel === 'string'
    ? migrated.responsavel
    : '';

  migrated.observacoes = typeof migrated.observacoes === 'string'
    ? migrated.observacoes
    : '';

  migrated.statusGeral = typeof migrated.statusGeral === 'string' && migrated.statusGeral.trim()
    ? migrated.statusGeral.trim()
    : 'Em conferência';

  if (!migrated.metadata.titleThird) {
    migrated.metadata.titleThird = 'RESUMO IMPOSTOS - FGTS DECIMO TERCEIRO';
  }

  if (!migrated.metadata.titleRight || migrated.metadata.titleRight === 'RESUMO IMPOSTOS - FGTS') {
    migrated.metadata.titleRight = 'RESUMO IMPOSTOS - FGTS MENSAL E DECIMO TERCEIRO';
  }

  migrated.groups = (migrated.groups || []).map((group) => ({
    ...group,
    statusLeft: normalizeGroupStatus(group.statusLeft),
    statusRight: normalizeGroupStatus(group.statusRight),
    companies: (group.companies || []).map(migrateCompany),
  }));

  return migrated;
}

module.exports = {
  createInitialRecord,
  getBaseRecord,
  mergePayloadIntoSchema,
  migrateCompany,
  migrateRecord,
};
