const express = require('express');
const path = require('node:path');
const session = require('express-session');
const { ensureAuthenticated } = require('./middlewares/auth');
const { authenticate } = require('./services/authService');
const { formatCnpj, formatCurrency, formatGroupStatus, fromCompetenciaSlug, normalizeGroupStatus, spacedLabel, toCompetenciaSlug } = require('./services/calculationService');
const { buildCompetenciaStatusMap, buildLayoutViewModel, computeFillMetrics } = require('./services/layoutViewModelService');
const { buildCompetenciaList, DEFAULT_SEED_YEAR } = require('./services/competenciaSeedService');
const { generateRecordPdf } = require('./services/pdfService');
const { getLogoPublicPath } = require('./services/brandAssetService');
const { getThemeFromRequest } = require('./services/themeService');
const { getLatestRecord, getRecordByCompetencia, listCompetencias, listRecords, saveRecord } = require('./services/recordService');
const { createInitialRecord } = require('./services/sheetSchemaService');
const { normalizeRecordInput, validateRecord } = require('./services/validationService');
const { listRevisions } = require('./services/versionHistoryService');

const app = express();
const port = process.env.PORT || 3454;

const helpers = {
  formatCnpj,
  formatCurrency,
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

app.set('view engine', 'ejs');
app.set('views', path.join(process.cwd(), 'views'));

app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(process.cwd(), 'public')));
app.use(session({
  secret: process.env.SESSION_SECRET || 'impostos-folha-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 8,
  },
}));

app.locals.helpers = helpers;
app.locals.logoPath = getLogoPublicPath();
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
    title: 'DEMONSTRATIVO IMPOSTOS FOLHA MENSAL - GRUPO DAUTO',
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
    currentYear: parseInt(record.competencia.split('/')[1], 10)
  });
}

app.get('/health', (req, res) => {
  res.json({ ok: true });
});

app.get('/', (req, res) => {
  if (req.session.user) {
    return res.redirect('/dashboard');
  }

  return res.redirect('/login');
});

app.get('/login', (req, res) => {
  if (req.session.user) {
    return res.redirect('/dashboard');
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
  return res.redirect('/dashboard');
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
  } catch (error) {
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

app.get('/dashboard/pdf/:competencia', ensureAuthenticated, async (req, res) => {
  const competencia = fromCompetenciaSlug(req.params.competencia);
  const record = await resolveRecord(competencia);
  const theme = getThemeFromRequest(req);
  const pdfBuffer = await generateRecordPdf(record, helpers, { theme });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="demonstrativo-${toCompetenciaSlug(record.competencia)}.pdf"`);
  return res.send(pdfBuffer);
});

app.get('/logout', ensureAuthenticated, (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
});

if (require.main === module) {
  const server = app.listen(port, () => {
    console.log(`Servidor iniciado em http://localhost:${port}`);
 
  });

  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`Erro: a porta ${port} ja esta em uso.`);
      console.error('Encerre o processo anterior ou inicie com outra porta, por exemplo:');
      console.error('  PowerShell: $env:PORT=3001; npm start');
    } else {
      console.error('Erro ao iniciar o servidor:', error.message);
    }

    process.exit(1);
  });
}

module.exports = app;
