const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');

function readMultiByteInt(buffer, offset) {
  let value = 0;
  let index = offset;

  while (index < buffer.length) {
    const byte = buffer[index];
    value = (value << 7) | (byte & 0x7f);
    index += 1;
    if ((byte & 0x80) === 0) {
      break;
    }
  }

  return { value, index };
}

function decodeWbmp(buffer) {
  let offset = 0;
  const typeField = readMultiByteInt(buffer, offset);
  offset = typeField.index;
  const headerField = readMultiByteInt(buffer, offset);
  offset = headerField.index;
  const widthField = readMultiByteInt(buffer, offset);
  offset = widthField.index;
  const heightField = readMultiByteInt(buffer, offset);
  offset = heightField.index;

  const width = widthField.value;
  const height = heightField.value;
  const rowBytes = Math.ceil(width / 8);
  const rgba = Buffer.alloc(width * height * 4, 255);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const byteIndex = offset + (y * rowBytes) + Math.floor(x / 8);
      const bitIndex = 7 - (x % 8);
      const isBlack = (buffer[byteIndex] >> bitIndex) & 1;
      const pixelIndex = ((y * width) + x) * 4;

      if (isBlack) {
        rgba[pixelIndex] = 0;
        rgba[pixelIndex + 1] = 0;
        rgba[pixelIndex + 2] = 0;
      }

      rgba[pixelIndex + 3] = 255;
    }
  }

  return { width, height, rgba };
}

async function main() {
  const inputPath = path.join(process.cwd(), 'WhatsApp-Image-2026-06-29-at-10.23.20.wbmp');
  const outputPath = path.join(process.cwd(), 'public', 'images', 'grupo-dauto-logo.png');

  const buffer = fs.readFileSync(inputPath);
  const { width, height, rgba } = decodeWbmp(buffer);

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  await sharp(rgba, {
    raw: {
      width,
      height,
      channels: 4,
    },
  })
    .png()
    .toFile(outputPath);

  console.log(`Converted ${width}x${height} -> ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
