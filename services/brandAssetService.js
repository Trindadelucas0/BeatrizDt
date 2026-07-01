const fs = require('node:fs');
const path = require('node:path');

const LOGO_RELATIVE_PATH = path.join('images', 'grupo-dauto-logo.png');

function getLogoAbsolutePath() {
  return path.join(process.cwd(), 'public', LOGO_RELATIVE_PATH);
}

function getLogoPublicPath() {
  return `/${LOGO_RELATIVE_PATH.replace(/\\/g, '/')}`;
}

function getLogoDataUri() {
  const logoPath = getLogoAbsolutePath();

  if (!fs.existsSync(logoPath)) {
    return '';
  }

  const buffer = fs.readFileSync(logoPath);
  return `data:image/png;base64,${buffer.toString('base64')}`;
}

module.exports = {
  getLogoAbsolutePath,
  getLogoPublicPath,
  getLogoDataUri,
};
