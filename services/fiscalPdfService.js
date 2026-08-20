const fs = require('node:fs/promises');
const path = require('node:path');
const ejs = require('ejs');
const puppeteer = require('puppeteer');
const { toCompetenciaSlug } = require('./calculationService');
const { calculateFiscalRecord } = require('./fiscalCalculationService');
const { TAX_FIELD_LABELS, TAX_FIELDS } = require('./fiscalSheetSchemaService');
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

function createMockPdfBuffer() {
  return Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF', 'utf-8');
}

function isProductionRuntime() {
  return process.env.NODE_ENV === 'production';
}

async function renderFiscalPdfHtml(record, helpers, options = {}) {
  const theme = normalizeTheme(options.theme);
  const templatePath = path.join(process.cwd(), 'views', 'fiscal-pdf-template.ejs');
  const cssPath = path.join(process.cwd(), 'public', 'css', 'dauto-layout.css');
  const css = await fs.readFile(cssPath, 'utf-8');
  const calculatedRecord = calculateFiscalRecord(record);
  const logoDataUri = getLogoDataUri();
  const exitoLogoDataUri = getExitoLogoDataUri();
  const now = new Date();

  return ejs.renderFile(templatePath, {
    record: calculatedRecord,
    helpers,
    taxFields: TAX_FIELDS,
    taxFieldLabels: TAX_FIELD_LABELS,
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

async function generateFiscalRecordPdf(record, helpers, options = {}) {
  const disableBrowser = process.env.DISABLE_PDF_BROWSER === '1';

  if (disableBrowser && isProductionRuntime()) {
    throw new Error(
      'DISABLE_PDF_BROWSER=1 so e permitido em teste. Remova a flag para gerar PDF real com o Chrome.',
    );
  }

  if (disableBrowser) {
    return createMockPdfBuffer();
  }

  const html = await renderFiscalPdfHtml(record, helpers, options);
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
    ],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({
      width: 1400,
      height: 900,
      deviceScaleFactor: 1,
    });
    await page.setContent(html, { waitUntil: 'load' });
    return await page.pdf({
      format: 'A4',
      landscape: true,
      printBackground: true,
      preferCSSPageSize: true,
      margin: {
        top: '5mm',
        right: '5mm',
        bottom: '5mm',
        left: '5mm',
      },
    });
  } finally {
    await browser.close();
  }
}

module.exports = {
  generateFiscalRecordPdf,
  renderFiscalPdfHtml,
};
