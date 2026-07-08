const {
  mergePayloadIntoSchema,
  migrateRecord,
  createInitialRecord,
  isCustomGroupId,
} = require('../services/sheetSchemaService');
const { calculateRecord } = require('../services/calculationService');
const { normalizeRecordInput } = require('../services/validationService');

describe('sheetSchemaService', () => {
  it('preserva grupos custom no mergePayloadIntoSchema', () => {
    const base = createInitialRecord();
    const payload = {
      ...base,
      groups: [
        ...base.groups,
        {
          id: 'custom-test-1',
          label: 'DAUTO PARAC',
          statusLeft: 'em_processo',
          statusRight: 'em_processo',
          companies: [{
            id: 'custom-test-1-company',
            code: '44',
            name: 'DAUTO PARAC',
            cnpj: '12345678000199',
            inss: 100,
            irrf: 20,
            emprestimoConsignado: 0,
            fgtsMensal: 50,
            fgtsDecimoTerceiro: 0,
          }],
        },
      ],
    };

    const merged = mergePayloadIntoSchema(payload);
    const customGroup = merged.groups.find((group) => group.id === 'custom-test-1');

    expect(customGroup).toBeTruthy();
    expect(customGroup.companies[0].code).toBe('44');
    expect(isCustomGroupId(customGroup.id)).toBe(true);
  });

  it('extrai empresa extra de UNICA para grupo custom no migrateRecord', () => {
    const base = createInitialRecord();
    const unicaGroup = base.groups.find((group) => group.id === 'unica');
    unicaGroup.companies.push({
      id: 'unica-extra-44',
      code: '44',
      name: 'DAUTO PARAC',
      cnpj: '',
      inss: 200,
      irrf: 0,
      emprestimoConsignado: 0,
      fgtsMensal: 80,
      fgtsDecimoTerceiro: 0,
    });

    const migrated = migrateRecord(base);
    const unicaAfter = migrated.groups.find((group) => group.id === 'unica');
    const customGroups = migrated.groups.filter((group) => isCustomGroupId(group.id));

    expect(unicaAfter.companies).toHaveLength(1);
    expect(unicaAfter.companies[0].code).toBe('46');
    expect(customGroups).toHaveLength(1);
    expect(customGroups[0].companies[0].code).toBe('44');
    expect(customGroups[0].companies[0].name).toBe('DAUTO PARAC');
  });

  it('inclui grupo custom nos totais após normalizeRecordInput', () => {
    const base = createInitialRecord();
    const payload = {
      ...base,
      groups: [
        ...base.groups.slice(0, 4),
        {
          id: 'custom-test-2',
          label: 'DAUTO PARAC',
          statusLeft: 'em_processo',
          statusRight: 'em_processo',
          companies: [{
            id: 'custom-test-2-company',
            code: '44',
            name: 'DAUTO PARAC',
            cnpj: '',
            inss: 100,
            irrf: 0,
            emprestimoConsignado: 0,
            fgtsMensal: 50,
            fgtsDecimoTerceiro: 0,
          }],
        },
      ],
    };

    const normalized = normalizeRecordInput(payload);
    const customGroup = normalized.groups.find((group) => group.id === 'custom-test-2');

    expect(customGroup.summary.totalLeft).toBe(100);
    expect(customGroup.summary.totalRight).toBe(50);
    expect(normalized.grandTotals.totalLeft).toBe(Number((26280.93 + 100).toFixed(2)));
    expect(normalized.grandTotals.totalRight).toBe(Number((33970.91 + 50).toFixed(2)));
  });
});
