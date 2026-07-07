const fs = require('node:fs/promises');
const path = require('node:path');
const ejs = require('ejs');
const puppeteer = require('puppeteer');
const { toCompetenciaSlug, calculateRecord } = require('./calculationService');
const { getLogoDataUri, getExitoLogoDataUri } = require('./brandAssetService');
const { normalizeTheme } = require('./themeService');

function formatPdfDate(value) {
  if (!value) {
    return '—';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('pt-BR').format(date);
}

function formatEmitidoEm(date = new Date()) {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

async function renderPdfHtml(record, helpers, options = {}) {
  const theme = normalizeTheme(options.theme);
  const templatePath = path.join(process.cwd(), 'views', 'pdf-template.ejs');
  const cssPath = path.join(process.cwd(), 'public', 'css', 'dauto-layout.css');
  const css = await fs.readFile(cssPath, 'utf-8');
  const calculatedRecord = calculateRecord(record);
  const logoDataUri = getLogoDataUri();
  const exitoLogoDataUri = getExitoLogoDataUri();
  const now = new Date();

  return ejs.renderFile(templatePath, {
    record: calculatedRecord,
    helpers,
    printMode: true,
    embeddedStyles: css,
    competenciaSlug: toCompetenciaSlug(record.competencia),
    logoPath: logoDataUri,
    exitoLogoPath: exitoLogoDataUri,
    emitidoEm: formatEmitidoEm(now),
    dataPreenchimentoLabel: formatPdfDate(calculatedRecord.dataPreenchimento),
    theme,
  });
}

function createMockPdfBuffer() {
  return Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF', 'utf-8');
}

async function generateRecordPdf(record, helpers, options = {}) {
  if (process.env.DISABLE_PDF_BROWSER === '1') {
    return createMockPdfBuffer();
  }

  const html = await renderPdfHtml(record, helpers, options);
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    return await page.pdf({
      format: 'A4',
      landscape: true,
      printBackground: true,
      margin: {
        top: '8mm',
        right: '8mm',
        bottom: '8mm',
        left: '8mm',
      },
    });
  } finally {
    await browser.close();
  }
}

module.exports = {
  generateRecordPdf,
  renderPdfHtml,
};
