const { calculateFiscalRecord, formatFiscalCell } = require('../services/fiscalCalculationService');
const { createInitialFiscalRecord } = require('../services/fiscalSheetSchemaService');

describe('fiscal calculation', () => {
  it('soma apenas valores numericos e preserva SALDO CREDOR', () => {
    const record = createInitialFiscalRecord();
    const calculated = calculateFiscalRecord(record);

    expect(calculated.rows[0].icms).toBe('SALDO CREDOR');
    expect(calculated.rows[3].icmsProtege).toBe(231.99);
    expect(calculated.totals.icmsProtege).toBe(231.99);
    expect(calculated.totals.icms).toBe(0);
    expect(formatFiscalCell(null)).toBe('R$ -');
    expect(formatFiscalCell('SALDO CREDOR')).toBe('SALDO CREDOR');
  });
});
