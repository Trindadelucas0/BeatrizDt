const fs = require('node:fs');
const path = require('node:path');

const LOGO_RELATIVE_PATH = path.join('images', 'dauto-login-logo.png');
const LOGIN_PAGE_LOGO_RELATIVE_PATH = path.join('images', 'dauto-login-page-logo.png');
const EXITO_LOGO_RELATIVE_PATH = path.join('images', 'logo.png');

function getAssetDataUri(relativePath) {
  const assetPath = path.join(process.cwd(), 'public', relativePath);

  if (!fs.existsSync(assetPath)) {
    return '';
  }

  const buffer = fs.readFileSync(assetPath);
  return `data:image/png;base64,${buffer.toString('base64')}`;
}

function getLogoAbsolutePath() {
  return path.join(process.cwd(), 'public', LOGO_RELATIVE_PATH);
}

function getExitoLogoAbsolutePath() {
  return path.join(process.cwd(), 'public', EXITO_LOGO_RELATIVE_PATH);
}

function getLogoPublicPath() {
  return `/${LOGO_RELATIVE_PATH.replace(/\\/g, '/')}`;
}

function getLoginPageLogoPublicPath() {
  return `/${LOGIN_PAGE_LOGO_RELATIVE_PATH.replace(/\\/g, '/')}`;
}

function getExitoLogoPublicPath() {
  return `/${EXITO_LOGO_RELATIVE_PATH.replace(/\\/g, '/')}`;
}

function getLogoDataUri() {
  return getAssetDataUri(LOGO_RELATIVE_PATH);
}

function getExitoLogoDataUri() {
  return getAssetDataUri(EXITO_LOGO_RELATIVE_PATH);
}

module.exports = {
  getLogoAbsolutePath,
  getExitoLogoAbsolutePath,
  getLogoPublicPath,
  getLoginPageLogoPublicPath,
  getExitoLogoPublicPath,
  getLogoDataUri,
  getExitoLogoDataUri,
};
