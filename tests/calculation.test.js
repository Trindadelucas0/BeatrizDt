const { calculateRecord, formatCnpj, formatCurrency, sanitizeNumber } = require('../services/calculationService');
const { createInitialRecord } = require('../services/sheetSchemaService');

describe('calculationService', () => {
  it('calcula os totais por empresa, grupo e geral', () => {
    const record = calculateRecord(createInitialRecord());

    expect(record.groups[0].companies[0].totalLeft).toBe(9778.22);
    expect(record.groups[0].companies[0].totalRight).toBe(15467.37);
    expect(record.groups[0].summary.totalLeft).toBe(14412.24);
    expect(record.groups[0].summary.totalRight).toBe(20807.07);
    expect(record.grandTotals.totalLeft).toBe(26280.93);
    expect(record.grandTotals.totalRight).toBe(33970.91);
    expect(record.grandTotals.fgtsMensal).toBe(19464.96);
    expect(record.grandTotals.fgtsDecimoTerceiro).toBe(0);
    expect(record.grandTotals.fgts).toBe(19464.96);
  });

  it('inclui FGTS decimo terceiro no total do quadro FGTS', () => {
    const record = createInitialRecord();
    record.groups[0].companies[0].fgtsDecimoTerceiro = 500;
    const calculated = calculateRecord(record);

    expect(calculated.groups[0].companies[0].totalRight).toBe(15967.37);
    expect(calculated.groups[0].summary.totalRight).toBe(21307.07);
    expect(calculated.grandTotals.fgtsDecimoTerceiro).toBe(500);
    expect(calculated.grandTotals.totalRight).toBe(34470.91);
    expect(calculated.grandTotals.fgts).toBe(19964.96);
  });

  it('inclui INSS e IRRF decimo terceiro no total esquerdo apenas em dezembro', () => {
    const december = createInitialRecord();
    december.competencia = '12/2026';
    december.groups[0].companies[0].inssDecimoTerceiro = 100;
    december.groups[0].companies[0].irrfDecimoTerceiro = 50;
    const calculatedDecember = calculateRecord(december);

    expect(calculatedDecember.groups[0].companies[0].totalLeft).toBe(9928.22);
    expect(calculatedDecember.grandTotals.inssDecimoTerceiro).toBe(100);
    expect(calculatedDecember.grandTotals.irrfDecimoTerceiro).toBe(50);

    const march = createInitialRecord();
    march.competencia = '03/2026';
    march.groups[0].companies[0].inssDecimoTerceiro = 100;
    march.groups[0].companies[0].irrfDecimoTerceiro = 50;
    const calculatedMarch = calculateRecord(march);

    expect(calculatedMarch.groups[0].companies[0].totalLeft).toBe(9778.22);
  });

  it('sanitiza valores monetarios no formato brasileiro', () => {
    expect(sanitizeNumber('R$ 1.234,56')).toBe(1234.56);
    expect(formatCurrency(1234.56)).toBe('R$ 1.234,56');
  });

  it('formata CNPJ com mascara brasileira', () => {
    expect(formatCnpj('72628407000179')).toBe('72.628.407/0001-79');
    expect(formatCnpj('')).toBe('-');
  });
});
