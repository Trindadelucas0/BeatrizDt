const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const request = require('supertest');
const { createInitialRecord } = require('../services/sheetSchemaService');
const { buildLayoutViewModel } = require('../services/layoutViewModelService');
const { renderPdfHtml } = require('../services/pdfService');
const { formatCnpj, formatCurrency, formatGroupStatus, normalizeGroupStatus, spacedLabel } = require('../services/calculationService');

let tempDir;
let app;

const helpers = {
  formatCnpj,
  formatCurrency,
  formatGroupStatus,
  normalizeGroupStatus,
  spacedLabel,
  toCompetenciaSlug: (competencia) => String(competencia || '').replace('/', '-'),
  formatDateTime(value) {
    if (!value) {
      return '--';
    }

    return new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(value));
  },
};

beforeAll(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'impostos-folha-'));

  process.env.STORAGE_BACKEND = 'json';
  process.env.USERS_FILE = path.join(tempDir, 'users.json');
  process.env.RECORDS_FILE = path.join(tempDir, 'records.json');
  process.env.BACKUP_DIR = path.join(tempDir, 'backups');
  process.env.HISTORY_DIR = path.join(tempDir, 'history');
  process.env.DISABLE_PDF_BROWSER = '1';

  const users = {
    users: [
      { username: 'admin', password: 'admin123', role: 'admin', displayName: 'Administrador', active: true },
      { username: 'usuario', password: 'usuario123', role: 'user', displayName: 'Usuario comum', active: true },
    ],
  };

  const records = {
    records: [
      {
        ...createInitialRecord(),
        updatedAt: new Date().toISOString(),
        updatedBy: 'teste',
      },
    ],
  };

  await fs.writeFile(process.env.USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');
  await fs.writeFile(process.env.RECORDS_FILE, JSON.stringify(records, null, 2), 'utf-8');

  const { getApp } = require('../server');
  app = getApp();
});

afterAll(async () => {
  delete process.env.STORAGE_BACKEND;
  delete process.env.USERS_FILE;
  delete process.env.RECORDS_FILE;
  delete process.env.BACKUP_DIR;
  delete process.env.HISTORY_DIR;
  delete process.env.DISABLE_PDF_BROWSER;

  if (tempDir) {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

describe('aplicacao web', () => {
  it('bloqueia login invalido', async () => {
    const response = await request(app)
      .post('/login')
      .type('form')
      .send({ username: 'admin', password: 'errada' });

    expect(response.statusCode).toBe(401);
    expect(response.text).toContain('Usuario ou senha invalidos');
  });

  it('permite login e visualizacao do dashboard para administrador', async () => {
    const agent = request.agent(app);

    await agent
      .post('/login')
      .type('form')
      .send({ username: 'admin', password: 'admin123' })
      .expect(302);

    const dashboard = await agent.get('/dashboard');
    expect(dashboard.statusCode).toBe(200);
    expect(dashboard.text).toContain('Controle folha de pagamento');
    expect(dashboard.text).toContain('sidebar-nav');
    expect(dashboard.text).toContain('01/2026');
    expect(dashboard.text).toContain('12/2026');
    expect(dashboard.text).toContain('03/2026');
    expect(dashboard.text).not.toMatch(/<aside[^>]*class="[^"]*sidebar-panel/);
    expect(dashboard.text).toContain('13º FGTS');
    expect(dashboard.text).toContain('ETICA');
    expect(dashboard.text).toContain('guias-panel');
    expect(dashboard.text).toContain('js-sheet-add-row');
    expect(dashboard.text).toContain('js-sheet-remove-row');
    expect(dashboard.text).not.toContain('theme-switcher');
    expect(dashboard.text).toContain('logo-card dauto');
    expect(dashboard.text).toContain('/images/logo.png');
    expect(dashboard.text).toContain('/images/dauto-login-logo.png');
    expect(dashboard.text).toContain('sheet-table-desktop');
    expect(dashboard.text).toContain('sheet-table-mobile');
    expect(dashboard.text).toContain('mobile-company-card');
  });

  it('exibe login simplificado com logo', async () => {
    const response = await request(app).get('/login');
    expect(response.statusCode).toBe(200);
    expect(response.text).toContain('login-brand__logo');
    expect(response.text).not.toContain('logo-card dauto');
    expect(response.text).not.toContain('logo-card exito');
    expect(response.text).not.toContain('theme-switcher');
    expect(response.text).toContain('/images/dauto-login-page-logo.png');
    expect(response.text).not.toContain('/images/dauto-login-logo.png');
    expect(response.text).not.toContain('/images/logo.png');
    expect(response.text).toContain('Folha de Pagamento');
    expect(response.text).not.toContain('Resumo de Impostos – Folha de Pagamento');
    expect(response.text).not.toContain('Controle mensal por empresa · Dauto Tintas');
    expect(response.text).toContain('btn-dauto');
    expect(response.text).toContain('viewport');
    expect(response.text).toContain('width=device-width');
  });

  it('impede usuario comum de salvar alteracoes', async () => {
    const agent = request.agent(app);
    const payload = createInitialRecord();

    await agent
      .post('/login')
      .type('form')
      .send({ username: 'usuario', password: 'usuario123' })
      .expect(302);

    const response = await agent
      .post('/dashboard/save')
      .type('form')
      .send({ payload: JSON.stringify(payload) });

    expect(response.statusCode).toBe(403);
    expect(response.text).toContain('Somente administradores podem salvar alteracoes');
  });

  it('salva dados e gera PDF para administrador', async () => {
    const agent = request.agent(app);
    const payload = createInitialRecord();
    payload.competencia = '04/2026';
    payload.groups[0].companies[0].inss = 10000;

    await agent
      .post('/login')
      .type('form')
      .send({ username: 'admin', password: 'admin123' })
      .expect(302);

    const saveResponse = await agent
      .post('/dashboard/save')
      .type('form')
      .send({ payload: JSON.stringify(payload) });

    expect(saveResponse.statusCode).toBe(302);
    expect(saveResponse.headers.location).toContain('/dashboard/04-2026');

    const pdfResponse = await agent.get('/dashboard/pdf/04-2026');
    expect(pdfResponse.statusCode).toBe(200);
    expect(pdfResponse.headers['content-type']).toContain('application/pdf');
  });

  it('realiza autosave e retorna status da competencia', async () => {
    const agent = request.agent(app);
    const payload = createInitialRecord();
    payload.groups[0].companies[0].fgtsDecimoTerceiro = 250;

    await agent
      .post('/login')
      .type('form')
      .send({ username: 'admin', password: 'admin123' })
      .expect(302);

    const autosaveResponse = await agent
      .post('/api/competencias/03-2026/autosave')
      .send(payload);

    expect(autosaveResponse.statusCode).toBe(200);
    expect(autosaveResponse.body.ok).toBe(true);
    expect(autosaveResponse.body.revisionId).toBeGreaterThanOrEqual(1);

    const statusResponse = await agent.get('/api/competencias/03-2026/status');
    expect(statusResponse.statusCode).toBe(200);
    expect(statusResponse.body.competencia).toBe('03/2026');
    expect(statusResponse.body.fillPercent).toBeGreaterThan(0);

    const historyResponse = await agent.get('/api/competencias/03-2026/history');
    expect(historyResponse.statusCode).toBe(200);
    expect(historyResponse.body.revisions.length).toBeGreaterThan(0);
  });

  it('exibe colunas de INSS e IRRF decimo terceiro apenas em dezembro', async () => {
    const agent = request.agent(app);

    await agent
      .post('/login')
      .type('form')
      .send({ username: 'admin', password: 'admin123' })
      .expect(302);

    const decemberDashboard = await agent.get('/dashboard/12-2026');
    expect(decemberDashboard.statusCode).toBe(200);
    expect(decemberDashboard.text).toContain('INSS Décimo');
    expect(decemberDashboard.text).toContain('IRRF Décimo');

    const marchDashboard = await agent.get('/dashboard/03-2026');
    expect(marchDashboard.statusCode).toBe(200);
    expect(marchDashboard.text).not.toContain('INSS Décimo');
    expect(marchDashboard.text).not.toContain('IRRF Décimo');
  });

  it('exibe status somente leitura para usuario comum', async () => {
    const agent = request.agent(app);

    await agent
      .post('/login')
      .type('form')
      .send({ username: 'usuario', password: 'usuario123' })
      .expect(302);

    const dashboard = await agent.get('/dashboard');
    expect(dashboard.statusCode).toBe(200);
    expect(dashboard.text).toContain('status-badge');
    expect(dashboard.text).toContain('readonly');
    expect(dashboard.text).not.toContain('Salvar dados');
  });

  it('gera pdf respeitando cookie de tema', async () => {
    const agent = request.agent(app);

    await agent
      .post('/login')
      .type('form')
      .send({ username: 'admin', password: 'admin123' })
      .expect(302);

    const pdfResponse = await agent
      .get('/dashboard/pdf/03-2026')
      .set('Cookie', 'app-theme=escuro');

    expect(pdfResponse.statusCode).toBe(200);
    expect(pdfResponse.headers['content-type']).toContain('application/pdf');
  });
});

describe('layout e pdf', () => {
  it('monta view model com destaque da organizacao', () => {
    const record = createInitialRecord();
    const layout = buildLayoutViewModel(record);

    expect(layout.organizationLabel).toContain('ETICA');
    expect(layout.primaryCompanyName).toBe('ETICA MATRIZ');
    expect(layout.fillPercent).toBeGreaterThan(0);
  });

  it('gera html do pdf com layout do demonstrativo unificado', async () => {
    const record = {
      ...createInitialRecord(),
      dataPreenchimento: '2026-03-15',
      responsavel: 'Beatriz',
      observacoes: 'Conferir valores.',
      statusGeral: 'Em conferência',
      updatedAt: new Date().toISOString(),
      updatedBy: 'teste',
    };

    const html = await renderPdfHtml(record, helpers);

    expect(html).toContain('Demonstrativo de Impostos – Folha de Pagamento');
    expect(html).toContain('pdf-head');
    expect(html).toContain('pdf-box-guias');
    expect(html).toContain('Demonstrativo por empresa');
    expect(html).toContain('ETICA MATRIZ');
    expect(html).toContain('Total DARF INSS/IRRF');
    expect(html).toContain('Conferir valores.');
    expect(html).toContain('data:image/png;base64,');
    expect(html).not.toContain('DEMONSTRATIVO IMPOSTOS FOLHA MENSAL');
    expect(html).not.toContain('excel-table');
    expect(html).not.toContain('pdf-header--dauto');
    expect(html).not.toMatch(/<div class="sheet-table-mobile"/);
    expect(html).not.toMatch(/class="mobile-company-card/);
  });

  it('gera html do pdf de dezembro com colunas de INSS e IRRF decimo terceiro', async () => {
    const record = {
      ...createInitialRecord(),
      competencia: '12/2026',
      updatedAt: new Date().toISOString(),
      updatedBy: 'teste',
    };

    const html = await renderPdfHtml(record, helpers);

    expect(html).toContain('INSS Décimo');
    expect(html).toContain('IRRF Décimo');
    expect(html).toContain('pdf-table--full');
  });

  it('gera html do pdf com metadados do record', async () => {
    const record = {
      ...createInitialRecord(),
      responsavel: 'Maria',
      statusGeral: 'Conferido',
      updatedAt: new Date().toISOString(),
      updatedBy: 'teste',
    };

    const html = await renderPdfHtml(record, helpers);

    expect(html).toContain('Maria');
    expect(html).toContain('Conferido');
  });
});
