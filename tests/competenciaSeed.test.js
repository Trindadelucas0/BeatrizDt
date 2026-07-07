const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const {
  buildCompetenciaList,
  createBlankRecord,
  ensureYearCompetenciasInData,
} = require('../services/competenciaSeedService');
const { createInitialRecord } = require('../services/sheetSchemaService');
const { listRecords, getRecordByCompetencia } = require('../services/recordService');

describe('competenciaSeedService', () => {
  it('gera as 12 competencias de 2026', () => {
    expect(buildCompetenciaList(2026)).toEqual([
      '01/2026', '02/2026', '03/2026', '04/2026', '05/2026', '06/2026',
      '07/2026', '08/2026', '09/2026', '10/2026', '11/2026', '12/2026',
    ]);
  });

  it('cria registro em branco com valores monetarios zerados', () => {
    const record = createBlankRecord('04/2026');

    expect(record.competencia).toBe('04/2026');
    expect(record.groups[0].companies[0].inss).toBe(0);
    expect(record.groups[0].companies[0].fgtsMensal).toBe(0);
    expect(record.groups[0].companies[0].name).toBe('ETICA MATRIZ');
  });

  it('nao sobrescreve competencias existentes ao semear o ano', () => {
    const existing = {
      ...createInitialRecord(),
      competencia: '03/2026',
      groups: [{
        ...createInitialRecord().groups[0],
        companies: [{
          ...createInitialRecord().groups[0].companies[0],
          inss: 99999,
        }],
      }],
    };

    const { records, created } = ensureYearCompetenciasInData({ records: [existing] }, 2026);
    const march = records.find((entry) => entry.competencia === '03/2026');

    expect(created).toBe(11);
    expect(records).toHaveLength(12);
    expect(march.groups[0].companies[0].inss).toBe(99999);
  });
});

describe('recordService seed integration', () => {
  let tempDir;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'impostos-seed-'));
    process.env.STORAGE_BACKEND = 'json';
    process.env.RECORDS_FILE = path.join(tempDir, 'records.json');
    await fs.writeFile(process.env.RECORDS_FILE, JSON.stringify({
      records: [{
        ...createInitialRecord(),
        competencia: '05/2026',
        updatedAt: new Date().toISOString(),
        updatedBy: 'teste',
      }],
    }, null, 2), 'utf-8');
  });

  afterEach(async () => {
    delete process.env.STORAGE_BACKEND;
    delete process.env.RECORDS_FILE;
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  it('garante 12 competencias de 2026 ao listar registros', async () => {
    const records = await listRecords();
    const competencias = records.map((entry) => entry.competencia).sort();

    expect(competencias).toEqual(buildCompetenciaList(2026));
    expect(records.find((entry) => entry.competencia === '05/2026').groups[0].companies[0].inss).toBeGreaterThan(0);
    expect(records.find((entry) => entry.competencia === '01/2026').groups[0].companies[0].inss).toBe(0);
  });

  it('cria competencia ausente sob demanda', async () => {
    const record = await getRecordByCompetencia('08/2026');

    expect(record).not.toBeNull();
    expect(record.competencia).toBe('08/2026');
    expect(record.updatedBy).toBe('sistema');
  });
});
