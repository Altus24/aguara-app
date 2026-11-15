import QRCode from 'qrcode';
import JSZip from 'jszip';
import { jsPDF } from 'jspdf';
import {
  CHAPITAS_PER_TIRADA,
  formatTiradaChapitaId,
  getChapitaPublicUrl,
} from './chapitaId';
import { DEFAULT_QR_ESTILO, loadQrEstilo, normalizeQrEstilo } from './qrEstilo';

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

function qrCodeOptions(estilo) {
  const s = normalizeQrEstilo(estilo || loadQrEstilo());
  return {
    type: 'svg',
    errorCorrectionLevel: s.complejidad,
    margin: s.margen_qr,
    width: Math.max(200, s.tamano_final - 80),
  };
}

export function composeBrandedQrSvg(qrSvg, logoDataUrl, estiloInput) {
  const estilo = normalizeQrEstilo(estiloInput || loadQrEstilo());
  const size = estilo.tamano_final;
  const titleFont = estilo.nombre_tamano;
  const topPad = Math.max(8, Math.round(size * 0.02));
  const bottomPad = Math.max(8, Math.round(size * 0.02));
  const titleBand = titleFont + topPad;

  let titleY;
  let qrY;
  let qrSize;

  if (estilo.nombre_posicion === 'bottom') {
    qrY = topPad;
    qrSize = size - titleBand - topPad - bottomPad;
    titleY = qrY + qrSize + titleFont * 0.85;
  } else {
    titleY = topPad + titleFont * 0.78;
    qrY = titleY + titleFont * 0.32;
    qrSize = size - qrY - bottomPad;
  }

  qrSize = Math.max(80, qrSize);
  const qrX = (size - qrSize) / 2;

  const logoSize = qrSize * (estilo.logo_porcentaje / 100);
  const logoPad = Math.max(2, Math.round(qrSize * 0.006));
  const boxSize = logoSize + logoPad * 2;
  const boxX = qrX + (qrSize - boxSize) / 2;
  const boxY = qrY + (qrSize - boxSize) / 2;
  const clipId = `logo-clip-${Math.random().toString(36).slice(2, 9)}`;

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

  const brandText = String(estilo.texto_marca || 'Aguará App')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" overflow="visible">
  <defs>
    <clipPath id="${clipId}">
      <rect x="${boxX}" y="${boxY}" width="${boxSize}" height="${boxSize}"/>
    </clipPath>
  </defs>
  <rect width="${size}" height="${size}" fill="#ffffff"/>
  <text x="${size / 2}" y="${titleY}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${titleFont}" font-weight="700" fill="#000000">${brandText}</text>
  ${nestedQr}
  <rect x="${boxX}" y="${boxY}" width="${boxSize}" height="${boxSize}" fill="#ffffff" stroke="none"/>
  <image href="${logoDataUrl}" xlink:href="${logoDataUrl}" x="${boxX + logoPad}" y="${boxY + logoPad}" width="${logoSize}" height="${logoSize}" preserveAspectRatio="xMidYMid meet" clip-path="url(#${clipId})"/>
</svg>`;
}

export async function generateChapitaQrSvg(chapitaId, estiloInput) {
  const estilo = normalizeQrEstilo(estiloInput || loadQrEstilo());
  const [svg, logoDataUrl] = await Promise.all([
    QRCode.toString(getChapitaPublicUrl(chapitaId), qrCodeOptions(estilo)),
    loadLogoDataUrl(),
  ]);
  return composeBrandedQrSvg(svg, logoDataUrl, estilo);
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

function resolveCantidad(options = {}) {
  const requested = Number(options.cantidad);
  return Math.min(
    CHAPITAS_PER_TIRADA,
    Math.max(1, Number.isFinite(requested) ? Math.round(requested) : CHAPITAS_PER_TIRADA)
  );
}

/** A4 en mm. */
const A4_W_MM = 210;
const A4_H_MM = 297;
const PAGE_MARGIN_MM = 8;
const GAP_MM = 2;

export function getA4QrGrid(tamanoCm) {
  const cellMm = Math.max(10, Number(tamanoCm) * 10);
  const usableW = A4_W_MM - PAGE_MARGIN_MM * 2;
  const usableH = A4_H_MM - PAGE_MARGIN_MM * 2;
  const cols = Math.max(1, Math.floor((usableW + GAP_MM) / (cellMm + GAP_MM)));
  const rows = Math.max(1, Math.floor((usableH + GAP_MM) / (cellMm + GAP_MM)));
  const perPage = cols * rows;
  const gridW = cols * cellMm + (cols - 1) * GAP_MM;
  const gridH = rows * cellMm + (rows - 1) * GAP_MM;
  const offsetX = PAGE_MARGIN_MM + Math.max(0, (usableW - gridW) / 2);
  const offsetY = PAGE_MARGIN_MM + Math.max(0, (usableH - gridH) / 2);
  return { cols, rows, perPage, cellMm, offsetX, offsetY };
}

function svgToPngDataUrl(svgText, sizePx) {
  return new Promise((resolve, reject) => {
    const blob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = sizePx;
        canvas.height = sizePx;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, sizePx, sizePx);
        ctx.drawImage(img, 0, 0, sizePx, sizePx);
        const dataUrl = canvas.toDataURL('image/png');
        URL.revokeObjectURL(url);
        resolve(dataUrl);
      } catch (err) {
        URL.revokeObjectURL(url);
        reject(err);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('No se pudo rasterizar el SVG del QR'));
    };
    img.src = url;
  });
}

export async function generateTiradaQrItems(tirada, estiloInput, options = {}, onProgress) {
  const estilo = normalizeQrEstilo(estiloInput || loadQrEstilo());
  const logoDataUrl = await loadLogoDataUrl();
  const total = resolveCantidad(options);
  const opts = qrCodeOptions(estilo);
  const items = [];

  for (let seq = 1; seq <= total; seq += 1) {
    const id = formatTiradaChapitaId(tirada, seq);
    const svg = await QRCode.toString(getChapitaPublicUrl(id), opts);
    const branded = composeBrandedQrSvg(svg, logoDataUrl, estilo);
    items.push({ id, svg: branded });
    if (onProgress) onProgress(seq, total, 'generar');
  }

  return { items, estilo, total };
}

export async function downloadTiradaQrZip(tirada, onProgress, estiloInput, options = {}) {
  const { items, total } = await generateTiradaQrItems(tirada, estiloInput, options, onProgress);
  const zip = new JSZip();
  for (const item of items) {
    zip.file(`chapita_${item.id.replace(/-/g, '_')}.svg`, item.svg);
  }
  const blob = await zip.generateAsync({ type: 'blob' });
  const first = formatTiradaChapitaId(tirada, 1);
  const last = formatTiradaChapitaId(tirada, total);
  downloadBlob(blob, `chapitas_${first}-${last}.zip`);
  return blob;
}

export async function downloadTiradaQrPdf(tirada, onProgress, estiloInput, options = {}) {
  const { items, estilo, total } = await generateTiradaQrItems(
    tirada,
    estiloInput,
    options,
    (done, all) => onProgress?.(done, all, 'generar')
  );

  const grid = getA4QrGrid(estilo.tamano_cm);
  const rasterPx = Math.max(180, Math.round(estilo.tamano_cm * 118)); // ~300 dpi
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  const pages = Math.max(1, Math.ceil(total / grid.perPage));

  for (let i = 0; i < items.length; i += 1) {
    const pageIndex = Math.floor(i / grid.perPage);
    const indexOnPage = i % grid.perPage;
    if (i > 0 && indexOnPage === 0) {
      doc.addPage();
    }

    const col = indexOnPage % grid.cols;
    const row = Math.floor(indexOnPage / grid.cols);
    const x = grid.offsetX + col * (grid.cellMm + GAP_MM);
    const y = grid.offsetY + row * (grid.cellMm + GAP_MM);

    const png = await svgToPngDataUrl(items[i].svg, rasterPx);
    doc.addImage(png, 'PNG', x, y, grid.cellMm, grid.cellMm, undefined, 'FAST');

    if (onProgress) onProgress(i + 1, total, 'pdf');
  }

  const first = formatTiradaChapitaId(tirada, 1);
  const last = formatTiradaChapitaId(tirada, total);
  doc.save(`chapitas_${first}-${last}_A4_${pages}hojas.pdf`);
  return { pages, perPage: grid.perPage, total };
}

/**
 * Genera una sola vez los QR y descarga ZIP + PDF A4.
 */
export async function downloadTiradaQrPack(tirada, onProgress, estiloInput, options = {}) {
  const { items, estilo, total } = await generateTiradaQrItems(
    tirada,
    estiloInput,
    options,
    (done, all) => onProgress?.(done, all, 'generar')
  );

  const zip = new JSZip();
  for (const item of items) {
    zip.file(`chapita_${item.id.replace(/-/g, '_')}.svg`, item.svg);
  }
  const zipBlob = await zip.generateAsync({ type: 'blob' });
  const first = formatTiradaChapitaId(tirada, 1);
  const last = formatTiradaChapitaId(tirada, total);
  downloadBlob(zipBlob, `chapitas_${first}-${last}.zip`);

  const grid = getA4QrGrid(estilo.tamano_cm);
  const rasterPx = Math.max(180, Math.round(estilo.tamano_cm * 118));
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });
  const pages = Math.max(1, Math.ceil(total / grid.perPage));

  for (let i = 0; i < items.length; i += 1) {
    const indexOnPage = i % grid.perPage;
    if (i > 0 && indexOnPage === 0) doc.addPage();

    const col = indexOnPage % grid.cols;
    const row = Math.floor(indexOnPage / grid.cols);
    const x = grid.offsetX + col * (grid.cellMm + GAP_MM);
    const y = grid.offsetY + row * (grid.cellMm + GAP_MM);

    const png = await svgToPngDataUrl(items[i].svg, rasterPx);
    doc.addImage(png, 'PNG', x, y, grid.cellMm, grid.cellMm, undefined, 'FAST');
    if (onProgress) onProgress(i + 1, total, 'pdf');
  }

  doc.save(`chapitas_${first}-${last}_A4_${pages}hojas.pdf`);
  return { total, pages, perPage: grid.perPage, tamanoCm: estilo.tamano_cm };
}

export { DEFAULT_QR_ESTILO };
