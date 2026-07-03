const fs = require('node:fs');
const path = require('node:path');

const htmlPath = path.join(process.cwd(), 'Resumo de Impostos _ Dauto Tintas.html');
const html = fs.readFileSync(htmlPath, 'utf8');
const imagesDir = path.join(process.cwd(), 'public', 'images');

if (!fs.existsSync(imagesDir)) {
  fs.mkdirSync(imagesDir, { recursive: true });
}

function extractAndSave(className, outputName) {
  const pattern = new RegExp(`logo-card ${className}"><img src="(data:image/png;base64,[^"]+)"`);
  const match = html.match(pattern);
  if (!match) {
    console.error(`Logo not found: ${className}`);
    return false;
  }
  const b64 = match[1].replace(/^data:image\/png;base64,/, '');
  const outPath = path.join(imagesDir, outputName);
  fs.writeFileSync(outPath, Buffer.from(b64, 'base64'));
  console.log(`Wrote ${outputName} (${fs.statSync(outPath).size} bytes)`);
  return true;
}

extractAndSave('exito', 'exito-logo.png');
extractAndSave('dauto', 'grupo-dauto-logo.png');
