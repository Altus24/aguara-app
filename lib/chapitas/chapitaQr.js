import QRCode from 'qrcode';
import JSZip from 'jszip';
import {
  CHAPITAS_PER_TIRADA,
  formatTiradaChapitaId,
  getChapitaPublicUrl,
} from './chapitaId';

const QR_OPTIONS = {
  type: 'svg',
  errorCorrectionLevel: 'H',
  margin: 1,
  width: 440,
};

let logoDataUrlPromise;

function loadLogoDataUrl() {
  if (!logoDataUrlPromise) {
    logoDataUrlPromise = fetch('/aguara-qr.png')
      .then((response) => {
        if (!response.ok) throw new Error('No se pudo cargar /aguara-qr.png');
        return response.blob();
      })
      .then(
        (blob) =>
          new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(blob);
          })
      );
  }
  return logoDataUrlPromise;
}

export function composeBrandedQrSvg(qrSvg, logoDataUrl) {
  const size = 560;
  const titleFont = 40;
  const topPad = 10;
  const titleY = topPad + titleFont * 0.78;
  const qrY = titleY + titleFont * 0.32;
  const qrSize = size - 2 * qrY;
  const qrX = (size - qrSize) / 2;

  const logoSize = qrSize * 0.2;
  const logoPad = Math.max(2, Math.round(qrSize * 0.006));
  const boxSize = logoSize + logoPad * 2;
  const boxX = qrX + (qrSize - boxSize) / 2;
  const boxY = qrY + (qrSize - boxSize) / 2;
  const clipId = 'logo-clip';

  const nestedQr = qrSvg
    .replace(/<\?xml[^>]*>/, '')
    .replace(/<!DOCTYPE[^>]*>/, '')
    .replace(/<svg\b[^>]*>/, (tag) => {
      const cleaned = tag.replace(/\s(x|y|width|height)="[^"]*"/g, '');
      return cleaned.replace(
        /^<svg/,
        `<svg x="${qrX}" y="${qrY}" width="${qrSize}" height="${qrSize}"`
      );
    });

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" overflow="visible">
  <defs>
    <clipPath id="${clipId}">
      <rect x="${boxX}" y="${boxY}" width="${boxSize}" height="${boxSize}"/>
    </clipPath>
  </defs>
  <rect width="${size}" height="${size}" fill="#ffffff"/>
  <text x="${size / 2}" y="${titleY}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${titleFont}" font-weight="700" fill="#000000">Aguará App</text>
  ${nestedQr}
  <rect x="${boxX}" y="${boxY}" width="${boxSize}" height="${boxSize}" fill="#ffffff" stroke="none"/>
  <image href="${logoDataUrl}" xlink:href="${logoDataUrl}" x="${boxX + logoPad}" y="${boxY + logoPad}" width="${logoSize}" height="${logoSize}" preserveAspectRatio="xMidYMid meet" clip-path="url(#${clipId})"/>
</svg>`;
}

export async function generateChapitaQrSvg(chapitaId) {
  const [svg, logoDataUrl] = await Promise.all([
    QRCode.toString(getChapitaPublicUrl(chapitaId), QR_OPTIONS),
    loadLogoDataUrl(),
  ]);
  return composeBrandedQrSvg(svg, logoDataUrl);
}

export function downloadChapitaQrSvg(chapitaId, svgContent) {
  const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = `chapita_${String(chapitaId).replace(/-/g, '_')}.svg`;
  link.click();
  URL.revokeObjectURL(objectUrl);
}

function downloadBlob(blob, filename) {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(objectUrl);
}

export async function downloadTiradaQrZip(tirada, onProgress) {
  const logoDataUrl = await loadLogoDataUrl();
  const zip = new JSZip();
  const total = CHAPITAS_PER_TIRADA;

  for (let seq = 1; seq <= total; seq += 1) {
    const id = formatTiradaChapitaId(tirada, seq);
    const svg = await QRCode.toString(getChapitaPublicUrl(id), QR_OPTIONS);
    const branded = composeBrandedQrSvg(svg, logoDataUrl);
    zip.file(`chapita_${id.replace(/-/g, '_')}.svg`, branded);
    if (onProgress) onProgress(seq, total);
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  const first = formatTiradaChapitaId(tirada, 1);
  const last = formatTiradaChapitaId(tirada, CHAPITAS_PER_TIRADA);
  downloadBlob(blob, `chapitas_${first}-${last}.zip`);
  return blob;
}
