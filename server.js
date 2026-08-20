require('dotenv').config();

const express = require('express');
const path = require('node:path');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const { ensureAuthenticated } = require('./middlewares/auth');
const { authenticate } = require('./services/authService');
const { formatCnpj, formatCurrency, formatGroupStatus, fromCompetenciaSlug, normalizeGroupStatus, spacedLabel, toCompetenciaSlug } = require('./services/calculationService');
const { buildCompetenciaStatusMap, buildLayoutViewModel, computeFillMetrics } = require('./services/layoutViewModelService');
const { buildCompetenciaList, DEFAULT_SEED_YEAR } = require('./services/competenciaSeedService');
const { generateRecordPdf } = require('./services/pdfService');
const { generateFiscalRecordPdf } = require('./services/fiscalPdfService');
const { getLogoPublicPath, getLoginPageLogoPublicPath, getExitoLogoPublicPath } = require('./services/brandAssetService');
const { getThemeFromRequest, normalizeTheme } = require('./services/themeService');
const { getUserTheme, setUserTheme } = require('./services/preferenceService');
const { getLatestRecord, getRecordByCompetencia, listRecords, saveRecord } = require('./services/recordService');
const {
  getLatestFiscalRecord,
  getFiscalRecordByCompetencia,
  listFiscalRecords,
  saveFiscalRecord,
} = require('./services/fiscalRecordService');
const { createInitialRecord } = require('./services/sheetSchemaService');
const { createInitialFiscalRecord, TAX_FIELDS, TAX_FIELD_LABELS } = require('./services/fiscalSheetSchemaService');
const { normalizeRecordInput, validateRecord } = require('./services/validationService');
const { normalizeFiscalRecordInput, validateFiscalRecord } = require('./services/fiscalValidationService');
const { buildFiscalCompetenciaStatusMap, computeFiscalFillMetrics, formatFiscalCell } = require('./services/fiscalCalculationService');
const { listRevisions } = require('./services/versionHistoryService');
const { listFiscalRevisions } = require('./services/fiscalVersionHistoryService');
const { useJsonStorage } = require('./services/storage');
const { getPool, healthCheck, initDatabase } = require('./services/db/database');

const port = process.env.PORT || 3454;

const helpers = {
  formatCnpj,
  formatCurrency,
  formatFiscalCell,
  formatGroupStatus,
  normalizeGroupStatus,
  spacedLabel,
  toCompetenciaSlug,
  fromCompetenciaSlug,
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

let appInstance = null;

function createApp() {
  const app = express();

  app.set('view engine', 'ejs');
  app.set('views', path.join(process.cwd(), 'views'));

  app.use(express.urlencoded({ extended: true, limit: '2mb' }));
  app.use(express.json({ limit: '2mb' }));
  app.use(express.static(path.join(process.cwd(), 'public')));

  const sessionOptions = {
    secret: process.env.SESSION_SECRET || 'impostos-folha-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 8,
    },
  };

  if (!useJsonStorage()) {
    sessionOptions.store = new pgSession({
      pool: getPool(),
      tableName: 'session',
      createTableIfMissing: true,
    });
  }

  app.use(session(sessionOptions));

  app.locals.helpers = helpers;
  app.locals.logoPath = getLogoPublicPath();
  app.locals.loginLogoPath = getLoginPageLogoPublicPath();
  app.locals.exitoLogoPath = getExitoLogoPublicPath();
  app.locals.buildLayoutViewModel = buildLayoutViewModel;
  app.locals.buildCompetenciaStatusMap = buildCompetenciaStatusMap;
  app.locals.buildCompetenciaList = buildCompetenciaList;

  function consumeFlash(req) {
    const flash = req.session.flash || null;
    delete req.session.flash;
    return flash;
  }

  async function resolveRecord(competencia) {
    if (!competencia) {
      return getLatestRecord();
    }

    return (await getRecordByCompetencia(competencia)) || getLatestRecord();
  }

  async function resolveFiscalRecord(competencia) {
    if (!competencia) {
      return getLatestFiscalRecord();
    }

    return (await getFiscalRecordByCompetencia(competencia)) || getLatestFiscalRecord();
  }

  async function renderDashboard(req, res, options = {}) {
    const record = options.record || await resolveRecord(options.competencia);
    const records = await listRecords();
    const competencias = buildCompetenciaList(DEFAULT_SEED_YEAR);
    const layout = buildLayoutViewModel(record);
    const competenciaStatusMap = buildCompetenciaStatusMap(records);

    res.locals.record = record;
    res.locals.layout = layout;
    res.locals.competenciaStatusMap = competenciaStatusMap;
    res.locals.competencias = competencias;
    res.locals.isReadOnly = req.session.user.role !== 'admin';
    res.locals.user = req.session.user;

    return res.render('dashboard', {
      title: 'Resumo de Impostos | Dauto Tintas',
      user: req.session.user,
      record,
      competencias,
      competenciaStatusMap,
      layout,
      flash: options.flash ?? consumeFlash(req),
      error: options.error || null,
      isReadOnly: req.session.user.role !== 'admin',
      helpers,
      sidebarYears: [DEFAULT_SEED_YEAR, DEFAULT_SEED_YEAR + 1, DEFAULT_SEED_YEAR + 2],
      currentYear: parseInt(record.competencia.split('/')[1], 10),
    });
  }

  async function renderFiscalDashboard(req, res, options = {}) {
    const record = options.record || await resolveFiscalRecord(options.competencia);
    const records = await listFiscalRecords();
    const competencias = buildCompetenciaList(DEFAULT_SEED_YEAR);
    const competenciaStatusMap = buildFiscalCompetenciaStatusMap(records);

    return res.render('fiscal-dashboard', {
      title: 'Fiscal | Grupo Dauto',
      user: req.session.user,
      record,
      competencias,
      competenciaStatusMap,
      flash: options.flash ?? consumeFlash(req),
      error: options.error || null,
      isReadOnly: req.session.user.role !== 'admin',
      helpers,
      taxFields: TAX_FIELDS,
      taxFieldLabels: TAX_FIELD_LABELS,
      sidebarYears: [DEFAULT_SEED_YEAR, DEFAULT_SEED_YEAR + 1, DEFAULT_SEED_YEAR + 2],
      currentYear: parseInt(String(record.competencia || '01/2026').split('/')[1], 10),
    });
  }

  app.get('/health', async (req, res) => {
    if (useJsonStorage()) {
      return res.json({ ok: true, storage: 'json', db: 'skipped' });
    }

    try {
      const connected = await healthCheck();
      return res.json({
        ok: connected,
        storage: 'postgres',
        db: connected ? 'connected' : 'error',
      });
    } catch (error) {
      return res.status(503).json({
        ok: false,
        storage: 'postgres',
        db: 'error',
        error: error.message,
      });
    }
  });

  app.get('/', (req, res) => {
    if (req.session.user) {
      return res.redirect('/modulos');
    }

    return res.redirect('/login');
  });

  app.get('/login', (req, res) => {
    if (req.session.user) {
      return res.redirect('/modulos');
    }

    return res.render('login', {
      title: 'Acesso ao Sistema',
      error: null,
      lastUsername: '',
    });
  });

  app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const user = await authenticate(username, password);

    if (!user) {
      return res.status(401).render('login', {
        title: 'Acesso ao Sistema',
        error: 'Usuario ou senha invalidos.',
        lastUsername: username || '',
      });
    }

    req.session.user = user;
    return res.redirect('/modulos');
  });

  app.get('/modulos', ensureAuthenticated, (req, res) => {
    return res.render('modulos', {
      title: 'Módulos | Grupo Dauto',
      user: req.session.user,
    });
  });

  app.get('/dashboard', ensureAuthenticated, async (req, res) => {
    return renderDashboard(req, res);
  });

  app.get('/dashboard/:competencia', ensureAuthenticated, async (req, res) => {
    const competencia = fromCompetenciaSlug(req.params.competencia);
    return renderDashboard(req, res, { competencia });
  });

  app.post('/dashboard/save', ensureAuthenticated, async (req, res) => {
    if (req.session.user.role !== 'admin') {
      const latest = await resolveRecord();
      return renderDashboard(req, res.status(403), {
        record: latest,
        error: 'Somente administradores podem salvar alteracoes.',
        flash: null,
      });
    }

    let payload;
    try {
      payload = JSON.parse(req.body.payload || '{}');
    } catch {
      payload = createInitialRecord();
    }

    const normalizedRecord = normalizeRecordInput(payload);
    const errors = validateRecord(normalizedRecord);

    if (errors.length > 0) {
      return renderDashboard(req, res.status(400), {
        record: normalizedRecord,
        error: errors.join(' '),
        flash: null,
      });
    }

    await saveRecord(normalizedRecord, req.session.user.username);
    req.session.flash = 'Dados salvos com sucesso.';

    return res.redirect(`/dashboard/${toCompetenciaSlug(normalizedRecord.competencia)}`);
  });

  app.post('/api/competencias/:slug/autosave', ensureAuthenticated, async (req, res) => {
    if (req.session.user.role !== 'admin') {
      return res.status(403).json({ error: 'Somente administradores podem salvar alteracoes.' });
    }

    const competencia = fromCompetenciaSlug(req.params.slug);
    const payload = {
      ...req.body,
      competencia: req.body.competencia || competencia,
    };

    const normalizedRecord = normalizeRecordInput(payload);
    const errors = validateRecord(normalizedRecord);

    if (errors.length > 0) {
      return res.status(400).json({ error: errors.join(' ') });
    }

    const savedRecord = await saveRecord(normalizedRecord, req.session.user.username);
    const fill = computeFillMetrics(savedRecord);
    const revisions = await listRevisions(savedRecord.competencia);
    const latestRevision = revisions[revisions.length - 1] || null;

    return res.json({
      ok: true,
      competencia: savedRecord.competencia,
      updatedAt: savedRecord.updatedAt,
      updatedBy: savedRecord.updatedBy,
      fillStatus: fill.status,
      fillPercent: fill.percent,
      revisionId: latestRevision?.revision || 1,
    });
  });

  app.get('/api/competencias/:slug/status', ensureAuthenticated, async (req, res) => {
    const competencia = fromCompetenciaSlug(req.params.slug);
    const record = await getRecordByCompetencia(competencia);

    if (!record) {
      return res.status(404).json({ error: 'Competencia nao encontrada.' });
    }

    const fill = computeFillMetrics(record);
    const revisions = await listRevisions(competencia);
    const latestRevision = revisions[revisions.length - 1] || null;

    return res.json({
      competencia: record.competencia,
      fillStatus: fill.status,
      fillStatusLabel: fill.statusLabel,
      fillPercent: fill.percent,
      filledFields: fill.filledFields,
      totalFields: fill.totalFields,
      updatedAt: record.updatedAt,
      updatedBy: record.updatedBy,
      revisionId: latestRevision?.revision || 0,
    });
  });

  app.get('/api/competencias/:slug/history', ensureAuthenticated, async (req, res) => {
    if (req.session.user.role !== 'admin') {
      return res.status(403).json({ error: 'Somente administradores podem consultar o historico.' });
    }

    const competencia = fromCompetenciaSlug(req.params.slug);
    const revisions = await listRevisions(competencia);

    return res.json({
      competencia,
      revisions,
    });
  });

  app.get('/api/user/preferences/theme', ensureAuthenticated, async (req, res) => {
    const theme = await getUserTheme(req.session.user.username);
    return res.json({ theme: theme || 'dauto' });
  });

  app.put('/api/user/preferences/theme', ensureAuthenticated, async (req, res) => {
    const theme = normalizeTheme(req.body?.theme);
    await setUserTheme(req.session.user.username, theme);
    return res.json({ ok: true, theme });
  });

  app.get('/dashboard/pdf/:competencia', ensureAuthenticated, async (req, res) => {
    try {
      const competencia = fromCompetenciaSlug(req.params.competencia);
      const record = await resolveRecord(competencia);
      const theme = getThemeFromRequest(req);
      const pdfBuffer = await generateRecordPdf(record, helpers, { theme });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="Demonstrativo_Impostos_${toCompetenciaSlug(record.competencia)}.pdf"`,
      );
      return res.send(pdfBuffer);
    } catch (error) {
      console.error('Falha ao gerar PDF:', error.message);
      return res.status(500).send('Nao foi possivel gerar o PDF. Tente novamente.');
    }
  });

  app.get('/fiscal', ensureAuthenticated, async (req, res) => {
    return renderFiscalDashboard(req, res);
  });

  app.get('/fiscal/pdf/:competencia', ensureAuthenticated, async (req, res) => {
    try {
      const competencia = fromCompetenciaSlug(req.params.competencia);
      const record = await resolveFiscalRecord(competencia);
      const theme = getThemeFromRequest(req);
      const pdfBuffer = await generateFiscalRecordPdf(record, helpers, { theme });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="Resumo_Fiscal_${toCompetenciaSlug(record.competencia)}.pdf"`,
      );
      return res.send(pdfBuffer);
    } catch (error) {
      console.error('Falha ao gerar PDF fiscal:', error.message);
      return res.status(500).send('Nao foi possivel gerar o PDF fiscal. Tente novamente.');
    }
  });

  app.get('/fiscal/:competencia', ensureAuthenticated, async (req, res) => {
    const competencia = fromCompetenciaSlug(req.params.competencia);
    return renderFiscalDashboard(req, res, { competencia });
  });

  app.post('/fiscal/save', ensureAuthenticated, async (req, res) => {
    if (req.session.user.role !== 'admin') {
      const latest = await resolveFiscalRecord();
      return renderFiscalDashboard(req, res.status(403), {
        record: latest,
        error: 'Somente administradores podem salvar alteracoes.',
        flash: null,
      });
    }

    let payload;
    try {
      payload = JSON.parse(req.body.payload || '{}');
    } catch {
      payload = createInitialFiscalRecord();
    }

    const normalizedRecord = normalizeFiscalRecordInput(payload);
    const errors = validateFiscalRecord(normalizedRecord);

    if (errors.length > 0) {
      return renderFiscalDashboard(req, res.status(400), {
        record: normalizedRecord,
        error: errors.join(' '),
        flash: null,
      });
    }

    await saveFiscalRecord(normalizedRecord, req.session.user.username);
    req.session.flash = 'Dados fiscais salvos com sucesso.';

    return res.redirect(`/fiscal/${toCompetenciaSlug(normalizedRecord.competencia)}`);
  });

  app.post('/api/fiscal/competencias/:slug/autosave', ensureAuthenticated, async (req, res) => {
    if (req.session.user.role !== 'admin') {
      return res.status(403).json({ error: 'Somente administradores podem salvar alteracoes.' });
    }

    const competencia = fromCompetenciaSlug(req.params.slug);
    const payload = {
      ...req.body,
      competencia: req.body.competencia || competencia,
    };

    const normalizedRecord = normalizeFiscalRecordInput(payload);
    const errors = validateFiscalRecord(normalizedRecord);

    if (errors.length > 0) {
      return res.status(400).json({ error: errors.join(' ') });
    }

    const savedRecord = await saveFiscalRecord(normalizedRecord, req.session.user.username);
    const fill = computeFiscalFillMetrics(savedRecord);
    const revisions = await listFiscalRevisions(savedRecord.competencia);
    const latestRevision = revisions[revisions.length - 1] || null;

    return res.json({
      ok: true,
      competencia: savedRecord.competencia,
      updatedAt: savedRecord.updatedAt,
      updatedBy: savedRecord.updatedBy,
      fillStatus: fill.status,
      fillPercent: fill.percent,
      revisionId: latestRevision?.revision || 1,
    });
  });

  app.get('/api/fiscal/competencias/:slug/status', ensureAuthenticated, async (req, res) => {
    const competencia = fromCompetenciaSlug(req.params.slug);
    const record = await getFiscalRecordByCompetencia(competencia);

    if (!record) {
      return res.status(404).json({ error: 'Competencia fiscal nao encontrada.' });
    }

    const fill = computeFiscalFillMetrics(record);
    const revisions = await listFiscalRevisions(competencia);
    const latestRevision = revisions[revisions.length - 1] || null;

    return res.json({
      competencia: record.competencia,
      fillStatus: fill.status,
      fillStatusLabel: fill.statusLabel,
      fillPercent: fill.percent,
      filledFields: fill.filledFields,
      totalFields: fill.totalFields,
      updatedAt: record.updatedAt,
      updatedBy: record.updatedBy,
      revisionId: latestRevision?.revision || 0,
    });
  });

  app.get('/api/fiscal/competencias/:slug/history', ensureAuthenticated, async (req, res) => {
    if (req.session.user.role !== 'admin') {
      return res.status(403).json({ error: 'Somente administradores podem consultar o historico.' });
    }

    const competencia = fromCompetenciaSlug(req.params.slug);
    const revisions = await listFiscalRevisions(competencia);

    return res.json({
      competencia,
      revisions,
    });
  });

  app.get('/logout', ensureAuthenticated, (req, res) => {
    req.session.destroy(() => {
      res.redirect('/login');
    });
  });

  return app;
}

function getApp() {
  if (!appInstance) {
    appInstance = createApp();
  }

  return appInstance;
}

async function startServer() {
  if (!useJsonStorage()) {
    await initDatabase();
  }

  const app = getApp();

  return new Promise((resolve, reject) => {
    const server = app.listen(port, () => {
      console.log(`Servidor iniciado em http://localhost:${port}`);
      console.log(`Storage: ${useJsonStorage() ? 'json' : 'postgres'}`);
      resolve(server);
    });

    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`Erro: a porta ${port} ja esta em uso.`);
        console.error('Encerre o processo anterior ou inicie com outra porta, por exemplo:');
        console.error('  PowerShell: $env:PORT=3001; npm start');
      } else {
        console.error('Erro ao iniciar o servidor:', error.message);
      }

      reject(error);
    });
  });
}

module.exports = {
  getApp,
  startServer,
};

if (require.main === module) {
  startServer().catch((error) => {
    console.error('Falha ao iniciar banco/servidor:', error.message);
    process.exit(1);
  });
}
