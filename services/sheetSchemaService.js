const { normalizeGroupStatus, resolveEstablishmentType } = require('./calculationService');

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

const BASE_GROUP_IDS = new Set(BASE_RECORD.groups.map((group) => group.id));

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function isCustomGroupId(groupId) {
  return !BASE_GROUP_IDS.has(groupId);
}

function getBaseGroupCompanyCount(groupId) {
  const baseGroup = BASE_RECORD.groups.find((group) => group.id === groupId);
  return baseGroup ? baseGroup.companies.length : 0;
}

function createInitialRecord() {
  return clone(BASE_RECORD);
}

function getBaseRecord() {
  return clone(BASE_RECORD);
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

  migrated.establishmentType = resolveEstablishmentType(migrated);

  delete migrated.fgts;

  return migrated;
}

function createEmptyCompany(groupId, suffix = Date.now()) {
  return migrateCompany({
    id: `${groupId}-custom-${suffix}`,
    code: '',
    name: 'Nova empresa',
    cnpj: '',
    inss: 0,
    irrf: 0,
    emprestimoConsignado: 0,
    fgtsMensal: 0,
    fgtsDecimoTerceiro: 0,
    inssDecimoTerceiro: 0,
    irrfDecimoTerceiro: 0,
    establishmentType: '',
  });
}

function createEmptyGroup(suffix = Date.now()) {
  const groupId = `custom-${suffix}`;
  const company = createEmptyCompany(groupId, suffix);

  return {
    id: groupId,
    label: company.name,
    statusLeft: 'em_processo',
    statusRight: 'em_processo',
    companies: [company],
  };
}

function normalizeCustomGroup(group = {}) {
  const groupId = group.id || `custom-${Date.now()}`;
  const companies = (group.companies || []).slice(0, 1).map((company, index) => migrateCompany({
    ...createEmptyCompany(groupId, `${Date.now()}-${index}`),
    ...company,
    id: company.id || `${groupId}-company-${index}`,
  }));

  if (companies.length === 0) {
    companies.push(createEmptyCompany(groupId));
  }

  const label = String(group.label || companies[0].name || 'Nova empresa').trim() || 'Nova empresa';

  return {
    id: groupId,
    label,
    statusLeft: normalizeGroupStatus(group.statusLeft),
    statusRight: normalizeGroupStatus(group.statusRight),
    companies,
  };
}

function companyToCustomGroup(company, sourceGroup = {}) {
  const suffix = `${company.id || Date.now()}-${Math.random().toString(36).slice(2, 5)}`;

  return normalizeCustomGroup({
    id: `custom-${suffix}`,
    label: company.name || 'Nova empresa',
    statusLeft: sourceGroup.statusLeft,
    statusRight: sourceGroup.statusRight,
    companies: [company],
  });
}

function normalizeGroupsStructure(groups = []) {
  const incomingById = new Map(groups.map((group) => [group.id, group]));
  const normalizedBaseGroups = BASE_RECORD.groups.map((baseGroup) => {
    const incomingGroup = incomingById.get(baseGroup.id) || {};
    const expectedCount = baseGroup.companies.length;
    const incomingCompanies = Array.isArray(incomingGroup.companies) ? incomingGroup.companies : [];
    const keptCompanies = incomingCompanies.slice(0, expectedCount);

    while (keptCompanies.length < expectedCount) {
      keptCompanies.push(clone(baseGroup.companies[keptCompanies.length]));
    }

    return {
      ...baseGroup,
      label: incomingGroup.label || baseGroup.label,
      statusLeft: incomingGroup.statusLeft !== undefined ? incomingGroup.statusLeft : baseGroup.statusLeft,
      statusRight: incomingGroup.statusRight !== undefined ? incomingGroup.statusRight : baseGroup.statusRight,
      companies: keptCompanies.map((company, index) => migrateCompany({
        ...clone(baseGroup.companies[index]),
        ...company,
        id: company.id || baseGroup.companies[index].id,
      })),
    };
  });

  const extractedCustomGroups = [];

  BASE_RECORD.groups.forEach((baseGroup) => {
    const incomingGroup = incomingById.get(baseGroup.id) || {};
    const incomingCompanies = Array.isArray(incomingGroup.companies) ? incomingGroup.companies : [];
    const extras = incomingCompanies.slice(baseGroup.companies.length);

    extras.forEach((company) => {
      extractedCustomGroups.push(companyToCustomGroup(company, incomingGroup));
    });
  });

  const payloadCustomGroups = groups
    .filter((group) => isCustomGroupId(group.id))
    .map(normalizeCustomGroup);

  const mergedCustomGroups = [...extractedCustomGroups, ...payloadCustomGroups];
  const uniqueCustomGroups = [];
  const seenCustomIds = new Set();

  mergedCustomGroups.forEach((group) => {
    if (seenCustomIds.has(group.id)) {
      return;
    }

    seenCustomIds.add(group.id);
    uniqueCustomGroups.push(group);
  });

  return [...normalizedBaseGroups, ...uniqueCustomGroups];
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

    if (Array.isArray(incomingGroup.companies)) {
      return {
        ...group,
        label: incomingGroup.label || group.label,
        statusLeft: incomingGroup.statusLeft !== undefined ? incomingGroup.statusLeft : group.statusLeft,
        statusRight: incomingGroup.statusRight !== undefined ? incomingGroup.statusRight : group.statusRight,
        companies: incomingGroup.companies.map((company, index) => migrateCompany({
          ...createEmptyCompany(group.id, `${Date.now()}-${index}`),
          ...company,
          id: company.id || `${group.id}-custom-${Date.now()}-${index}`,
        })),
      };
    }

    const companiesMap = new Map((incomingGroup.companies || []).map((company) => [company.id, company]));

    return {
      ...group,
      label: incomingGroup.label || group.label,
      statusLeft: incomingGroup.statusLeft !== undefined ? incomingGroup.statusLeft : group.statusLeft,
      statusRight: incomingGroup.statusRight !== undefined ? incomingGroup.statusRight : group.statusRight,
      companies: group.companies.map((company) => migrateCompany({
        ...company,
        ...(companiesMap.get(company.id) || {}),
      })),
    };
  });

  const baseGroupIds = new Set(base.groups.map((group) => group.id));
  const extraGroups = (payload.groups || [])
    .filter((group) => group.id && !baseGroupIds.has(group.id))
    .map(normalizeCustomGroup);

  base.groups = normalizeGroupsStructure([...base.groups, ...extraGroups]);

  return base;
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

  migrated.groups = normalizeGroupsStructure(migrated.groups || []).map((group) => ({
    ...group,
    statusLeft: normalizeGroupStatus(group.statusLeft),
    statusRight: normalizeGroupStatus(group.statusRight),
    companies: (group.companies || []).map(migrateCompany),
  }));

  return migrated;
}

module.exports = {
  BASE_GROUP_IDS,
  createEmptyGroup,
  createInitialRecord,
  createEmptyCompany,
  getBaseRecord,
  isCustomGroupId,
  mergePayloadIntoSchema,
  migrateCompany,
  migrateRecord,
  normalizeCustomGroup,
  normalizeGroupsStructure,
};
