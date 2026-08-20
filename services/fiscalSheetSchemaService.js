const TAX_FIELDS = [
  'icms',
  'icmsProtege',
  'irpj',
  'csll',
  'pis',
  'cofins',
  'simples',
  'icmsSt',
  'difal',
];

const TAX_FIELD_LABELS = {
  icms: 'ICMS',
  icmsProtege: 'ICMS PROTEGE',
  irpj: 'IRPJ',
  csll: 'CSLL',
  pis: 'PIS',
  cofins: 'COFINS',
  simples: 'SIMPLES',
  icmsSt: 'ICMS ST',
  difal: 'DIFAL',
};

const EMPTY_TAXES = () => Object.fromEntries(TAX_FIELDS.map((field) => [field, null]));

const BASE_ROWS = [
  { id: 'row-14', dominio: '14', sistemaDauto: '22', local: 'GUARA II', empresa: 'DT TINTAS', ...EMPTY_TAXES(), icms: 'SALDO CREDOR' },
  { id: 'row-44', dominio: '44', sistemaDauto: '20', local: 'PARACATU', empresa: 'DT TINTAS', ...EMPTY_TAXES() },
  { id: 'row-45', dominio: '45', sistemaDauto: '8', local: 'LUZIANIA', empresa: 'DT TINTAS', ...EMPTY_TAXES() },
  { id: 'row-48', dominio: '48', sistemaDauto: '21', local: 'CIDADE AUT', empresa: 'DT TINTAS', ...EMPTY_TAXES(), icms: 'SALDO CREDOR', icmsProtege: 231.99 },
  { id: 'row-49', dominio: '49', sistemaDauto: '7', local: 'SOF', empresa: 'DT TINTAS', ...EMPTY_TAXES() },
  { id: 'row-50', dominio: '50', sistemaDauto: '4', local: 'ADE', empresa: 'DT TINTAS', ...EMPTY_TAXES(), icms: 'SALDO CREDOR' },
  { id: 'row-53', dominio: '53', sistemaDauto: '2', local: 'GAMA', empresa: 'DT TINTAS', ...EMPTY_TAXES() },
  { id: 'row-58', dominio: '58', sistemaDauto: '16', local: 'CEILANDIA', empresa: 'DT TINTAS', ...EMPTY_TAXES() },
  { id: 'row-59', dominio: '59', sistemaDauto: '23', local: 'S.I.A', empresa: 'DT TINTAS', ...EMPTY_TAXES() },
  { id: 'row-60', dominio: '60', sistemaDauto: '24', local: 'UNAÍ', empresa: 'DT TINTAS', ...EMPTY_TAXES() },
  { id: 'row-61', dominio: '61', sistemaDauto: '25', local: 'AGUAS LINDAS', empresa: 'DT TINTAS', ...EMPTY_TAXES() },
  { id: 'row-servicos', dominio: '', sistemaDauto: '', local: '', empresa: 'DAUTO SERVIÇOS', ...EMPTY_TAXES() },
  { id: 'row-vt', dominio: '', sistemaDauto: '', local: '', empresa: 'V&T', ...EMPTY_TAXES() },
  { id: 'row-unica', dominio: '', sistemaDauto: '', local: '', empresa: 'ÚNICA', ...EMPTY_TAXES() },
  { id: 'row-etica', dominio: '', sistemaDauto: '', local: '', empresa: 'ETICA', ...EMPTY_TAXES() },
  { id: 'row-mercado', dominio: '', sistemaDauto: '', local: '', empresa: 'MERCADO', ...EMPTY_TAXES() },
  { id: 'row-dalmar', dominio: '', sistemaDauto: '', local: '', empresa: 'DALMAR', ...EMPTY_TAXES() },
];

const BASE_RECORD = {
  competencia: '07/2026',
  dataPreenchimento: '',
  responsavel: '',
  observacoes: '',
  statusGeral: 'Em conferência',
  metadata: {
    title: 'RESUMO DE IMPOSTOS GRUPO DAUTO',
    sourceFile: 'RESUMO DE IMPOSTOS GRUPO DAUTO.xlsx',
  },
  rows: BASE_ROWS,
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createEmptyTaxValues() {
  return EMPTY_TAXES();
}

function createInitialFiscalRecord() {
  return clone(BASE_RECORD);
}

function getBaseFiscalRecord() {
  return clone(BASE_RECORD);
}

function createBlankFiscalRow(index = 0) {
  return {
    id: `row-custom-${Date.now()}-${index}`,
    dominio: '',
    sistemaDauto: '',
    local: '',
    empresa: '',
    ...createEmptyTaxValues(),
  };
}

function createBlankFiscalRecord(competencia) {
  const record = createInitialFiscalRecord();
  record.competencia = competencia;
  record.rows = record.rows.map((row) => ({
    ...row,
    ...createEmptyTaxValues(),
  }));
  return record;
}

function migrateFiscalRecord(record) {
  const base = createInitialFiscalRecord();
  const source = record && typeof record === 'object' ? record : {};

  return {
    ...base,
    ...source,
    metadata: {
      ...base.metadata,
      ...(source.metadata || {}),
    },
    rows: Array.isArray(source.rows) && source.rows.length > 0
      ? source.rows.map((row, index) => ({
        ...createBlankFiscalRow(index),
        ...row,
        id: String(row.id || `row-${index + 1}`),
      }))
      : base.rows,
  };
}

function mergeFiscalPayloadIntoSchema(payload) {
  return migrateFiscalRecord(payload);
}

module.exports = {
  TAX_FIELDS,
  TAX_FIELD_LABELS,
  createBlankFiscalRecord,
  createBlankFiscalRow,
  createEmptyTaxValues,
  createInitialFiscalRecord,
  getBaseFiscalRecord,
  mergeFiscalPayloadIntoSchema,
  migrateFiscalRecord,
};
