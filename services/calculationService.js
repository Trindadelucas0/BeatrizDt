const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

function sanitizeNumber(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value !== 'string') {
    return 0;
  }

  const normalized = value
    .replace(/[R$\s]/g, '')
    .replace(/\./g, '')
    .replace(',', '.')
    .trim();

  if (!normalized) {
    return 0;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function roundCurrency(value) {
  return Number(sanitizeNumber(value).toFixed(2));
}

function formatCurrency(value) {
  return currencyFormatter.format(roundCurrency(value));
}

function sanitizeCnpjDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

function formatCnpj(value) {
  const digits = sanitizeCnpjDigits(value);

  if (digits.length === 14) {
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
  }

  return digits || '-';
}

function parseCnpj(value) {
  const digits = sanitizeCnpjDigits(value);

  if (digits.length !== 14) {
    return {
      root: digits.slice(0, 8),
      branch: '',
      isMatriz: false,
      isFilial: false,
      isValid: false,
      establishmentType: '',
    };
  }

  const root = digits.slice(0, 8);
  const branch = digits.slice(8, 12);
  const isMatriz = branch === '0001';

  return {
    root,
    branch,
    isMatriz,
    isFilial: !isMatriz,
    isValid: true,
    establishmentType: isMatriz ? 'matriz' : 'filial',
  };
}

function resolveEstablishmentType(company = {}) {
  if (company.establishmentType === 'matriz' || company.establishmentType === 'filial') {
    return company.establishmentType;
  }

  const parsed = parseCnpj(company.cnpj);
  return parsed.establishmentType || '';
}

function isDecemberCompetencia(competencia) {
  return /^12\/\d{4}$/.test(String(competencia || '').trim());
}

const GROUP_STATUS = {
  EM_PROCESSO: 'em_processo',
  CONCLUIDO: 'concluido',
};

function normalizeGroupStatus(value) {
  const normalized = String(value || '').trim().toLowerCase();

  if (normalized === 'concluido' || normalized === 'concluído') {
    return GROUP_STATUS.CONCLUIDO;
  }

  if (normalized === 'em_processo' || normalized === 'em processo') {
    return GROUP_STATUS.EM_PROCESSO;
  }

  if (normalized === 'ok' || normalized === 'erro' || !normalized) {
    return GROUP_STATUS.EM_PROCESSO;
  }

  return GROUP_STATUS.EM_PROCESSO;
}

function formatGroupStatus(value) {
  return normalizeGroupStatus(value) === GROUP_STATUS.CONCLUIDO ? 'CONCLUÍDO' : 'EM PROCESSO';
}

function spacedLabel(text) {
  return String(text || '').toUpperCase().split('').join(' ');
}

function resolveFgtsMensal(company) {
  if (company.fgtsMensal !== undefined && company.fgtsMensal !== null) {
    return company.fgtsMensal;
  }

  return company.fgts ?? 0;
}

function calculateCompany(company, competencia) {
  const inss = roundCurrency(company.inss);
  const irrf = roundCurrency(company.irrf);
  const inssDecimoTerceiro = roundCurrency(company.inssDecimoTerceiro);
  const irrfDecimoTerceiro = roundCurrency(company.irrfDecimoTerceiro);
  const emprestimoConsignado = roundCurrency(company.emprestimoConsignado);
  const fgtsMensal = roundCurrency(resolveFgtsMensal(company));
  const fgtsDecimoTerceiro = roundCurrency(company.fgtsDecimoTerceiro);
  const includeDecimoLeft = isDecemberCompetencia(competencia);
  const totalLeft = includeDecimoLeft
    ? roundCurrency(inss + irrf + inssDecimoTerceiro + irrfDecimoTerceiro)
    : roundCurrency(inss + irrf);

  return {
    ...company,
    inss,
    irrf,
    inssDecimoTerceiro,
    irrfDecimoTerceiro,
    emprestimoConsignado,
    fgtsMensal,
    fgtsDecimoTerceiro,
    totalLeft,
    totalRight: roundCurrency(emprestimoConsignado + fgtsMensal + fgtsDecimoTerceiro),
  };
}

function calculateGroup(group, competencia) {
  const companies = group.companies.map((company) => calculateCompany(company, competencia));
  const summary = companies.reduce((acc, company) => ({
    inss: roundCurrency(acc.inss + company.inss),
    irrf: roundCurrency(acc.irrf + company.irrf),
    inssDecimoTerceiro: roundCurrency(acc.inssDecimoTerceiro + company.inssDecimoTerceiro),
    irrfDecimoTerceiro: roundCurrency(acc.irrfDecimoTerceiro + company.irrfDecimoTerceiro),
    totalLeft: roundCurrency(acc.totalLeft + company.totalLeft),
    emprestimoConsignado: roundCurrency(acc.emprestimoConsignado + company.emprestimoConsignado),
    fgtsMensal: roundCurrency(acc.fgtsMensal + company.fgtsMensal),
    fgtsDecimoTerceiro: roundCurrency(acc.fgtsDecimoTerceiro + company.fgtsDecimoTerceiro),
    totalRight: roundCurrency(acc.totalRight + company.totalRight),
  }), {
    inss: 0,
    irrf: 0,
    inssDecimoTerceiro: 0,
    irrfDecimoTerceiro: 0,
    totalLeft: 0,
    emprestimoConsignado: 0,
    fgtsMensal: 0,
    fgtsDecimoTerceiro: 0,
    totalRight: 0,
  });

  return {
    ...group,
    companies,
    summary,
    statusLeft: normalizeGroupStatus(group.statusLeft),
    statusRight: normalizeGroupStatus(group.statusRight),
  };
}

function calculateRecord(record) {
  const competencia = record.competencia;
  const groups = (record.groups || []).map((group) => calculateGroup(group, competencia));
  const grandTotals = groups.reduce((acc, group) => ({
    inss: roundCurrency(acc.inss + group.summary.inss),
    irrf: roundCurrency(acc.irrf + group.summary.irrf),
    inssDecimoTerceiro: roundCurrency(acc.inssDecimoTerceiro + group.summary.inssDecimoTerceiro),
    irrfDecimoTerceiro: roundCurrency(acc.irrfDecimoTerceiro + group.summary.irrfDecimoTerceiro),
    totalLeft: roundCurrency(acc.totalLeft + group.summary.totalLeft),
    emprestimoConsignado: roundCurrency(acc.emprestimoConsignado + group.summary.emprestimoConsignado),
    fgtsMensal: roundCurrency(acc.fgtsMensal + group.summary.fgtsMensal),
    fgtsDecimoTerceiro: roundCurrency(acc.fgtsDecimoTerceiro + group.summary.fgtsDecimoTerceiro),
    totalRight: roundCurrency(acc.totalRight + group.summary.totalRight),
    fgts: roundCurrency(acc.fgts + group.summary.fgtsMensal + group.summary.fgtsDecimoTerceiro),
  }), {
    inss: 0,
    irrf: 0,
    inssDecimoTerceiro: 0,
    irrfDecimoTerceiro: 0,
    totalLeft: 0,
    emprestimoConsignado: 0,
    fgtsMensal: 0,
    fgtsDecimoTerceiro: 0,
    totalRight: 0,
    fgts: 0,
  });

  return {
    ...record,
    groups,
    grandTotals,
  };
}

function toCompetenciaSlug(competencia) {
  return String(competencia || '').replace('/', '-');
}

function fromCompetenciaSlug(slug) {
  if (!slug) {
    return '';
  }

  const match = String(slug).match(/^(\d{2})-(\d{4})$/);
  return match ? `${match[1]}/${match[2]}` : String(slug);
}

module.exports = {
  GROUP_STATUS,
  calculateCompany,
  calculateGroup,
  calculateRecord,
  formatCnpj,
  formatCurrency,
  formatGroupStatus,
  fromCompetenciaSlug,
  isDecemberCompetencia,
  normalizeGroupStatus,
  parseCnpj,
  resolveEstablishmentType,
  resolveFgtsMensal,
  roundCurrency,
  sanitizeNumber,
  sanitizeCnpjDigits,
  spacedLabel,
  toCompetenciaSlug,
};
