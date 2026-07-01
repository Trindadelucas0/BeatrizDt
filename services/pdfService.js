const fs = require('node:fs/promises');
const path = require('node:path');
const ejs = require('ejs');
const puppeteer = require('puppeteer');
const { toCompetenciaSlug, calculateRecord } = require('./calculationService');
const { buildLayoutViewModel } = require('./layoutViewModelService');
const { getLogoDataUri } = require('./brandAssetService');
const { normalizeTheme } = require('./themeService');

const DAUTO_BRAND_TITLE = 'DEMONSTRATIVO IMPOSTOS FOLHA MENSAL - GRUPO DAUTO';

const THEME_HEADER_COLORS = {
  dauto: { bg: '#C41E3A', text: '#FFFFFF' },
  claro: { bg: '#FFFFFF', text: '#1C1C24' },
  escuro: { bg: '#1C1C24', text: '#F4F4F5' },
};

async function renderPdfHtml(record, helpers, options = {}) {
  const theme = normalizeTheme(options.theme);
  const templatePath = path.join(process.cwd(), 'views', 'pdf-template.ejs');
  const cssPath = path.join(process.cwd(), 'public', 'css', 'app.css');
  const css = await fs.readFile(cssPath, 'utf-8');
  const calculatedRecord = calculateRecord(record);
  const layout = buildLayoutViewModel(calculatedRecord);
  const logoDataUri = getLogoDataUri();

  return ejs.renderFile(templatePath, {
    record: calculatedRecord,
    helpers,
    layout,
    printMode: true,
    embeddedStyles: css,
    competenciaSlug: toCompetenciaSlug(record.competencia),
    logoPath: logoDataUri,
    logoDataUri,
    theme,
  });
}

function createMockPdfBuffer() {
  return Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF', 'utf-8');
}

function buildHeaderTemplate(record, theme = 'dauto') {
  const colors = THEME_HEADER_COLORS[normalizeTheme(theme)] || THEME_HEADER_COLORS.dauto;
  const logoDataUri = getLogoDataUri();
  const logoMarkup = logoDataUri
    ? `<img src="${logoDataUri}" alt="Grupo Dauto" style="height:18px;width:auto;margin-right:8px;" />`
    : '';

  return `
    <div style="width:100%;font-size:8px;color:${colors.text};background:${colors.bg};padding:5px 10mm;display:flex;justify-content:space-between;align-items:center;">
      <div style="display:flex;align-items:center;min-width:0;">
        ${logoMarkup}
        <span style="font-weight:700;">${DAUTO_BRAND_TITLE}</span>
      </div>
      <span>${record.competencia}</span>
    </div>
  `;
}

function buildFooterTemplate(record) {
  return `
    <div style="width:100%;font-size:8px;color:#64748b;padding:0 10mm;display:flex;justify-content:space-between;">
      <span>GRUPO DAUTO — ${record.competencia}</span>
      <span>Pagina <span class="pageNumber"></span> de <span class="totalPages"></span></span>
    </div>
  `;
}

async function generateRecordPdf(record, helpers, options = {}) {
  const theme = normalizeTheme(options.theme);

  if (process.env.DISABLE_PDF_BROWSER === '1') {
    return createMockPdfBuffer();
  }

  const html = await renderPdfHtml(record, helpers, { theme });
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
      displayHeaderFooter: true,
      headerTemplate: buildHeaderTemplate(record, theme),
      footerTemplate: buildFooterTemplate(record),
      margin: {
        top: '18mm',
        right: '10mm',
        bottom: '16mm',
        left: '10mm',
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
