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

function escapeXml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function inFinderZone(x, y, matrixSize) {
  const inTL = x < 7 && y < 7;
  const inTR = x >= matrixSize - 7 && y < 7;
  const inBL = x < 7 && y >= matrixSize - 7;
  return inTL || inTR || inBL;
}

function finderCenters(matrixSize) {
  return [
    { x: 3, y: 3 },
    { x: matrixSize - 4, y: 3 },
    { x: 3, y: matrixSize - 4 },
  ];
}

/** Escuadras en L (estilo foto) en las 4 esquinas del bloque nombre+QR. */
function cornerLPaths(frame, arm, stroke, color) {
  const { left, top, right, bottom } = frame;
  const sw = stroke.toFixed(2);
  const common = `fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"`;
  return [
    `<path d="M ${left.toFixed(2)} ${(top + arm).toFixed(2)} L ${left.toFixed(2)} ${top.toFixed(2)} L ${(left + arm).toFixed(2)} ${top.toFixed(2)}" ${common}/>`,
    `<path d="M ${(right - arm).toFixed(2)} ${top.toFixed(2)} L ${right.toFixed(2)} ${top.toFixed(2)} L ${right.toFixed(2)} ${(top + arm).toFixed(2)}" ${common}/>`,
    `<path d="M ${left.toFixed(2)} ${(bottom - arm).toFixed(2)} L ${left.toFixed(2)} ${bottom.toFixed(2)} L ${(left + arm).toFixed(2)} ${bottom.toFixed(2)}" ${common}/>`,
    `<path d="M ${(right - arm).toFixed(2)} ${bottom.toFixed(2)} L ${right.toFixed(2)} ${bottom.toFixed(2)} L ${right.toFixed(2)} ${(bottom - arm).toFixed(2)}" ${common}/>`,
  ].join('\n  ');
}

/**
 * QR Aguará: módulos rounded, ojos naranja, logo circular, ECC H.
 * Opción B de la ficha técnica.
 */
export function renderBrandedQrMatrixSvg(modules, logoDataUrl, estiloInput) {
  const estilo = normalizeQrEstilo(estiloInput || loadQrEstilo());
  const size = estilo.tamano_final;
  const titleFont = estilo.nombre_tamano;
  const nombreGap = Number.isFinite(estilo.nombre_espacio) ? estilo.nombre_espacio : 8;
  const topPad = Math.max(8, Math.round(size * 0.02));
  const bottomPad = Math.max(8, Math.round(size * 0.02));
  const titleBand = titleFont + nombreGap + Math.round(titleFont * 0.2);

  let titleY;
  let qrY;
  let qrSize;

  if (estilo.nombre_posicion === 'bottom') {
    qrY = topPad;
    qrSize = size - titleBand - topPad - bottomPad;
    titleY = qrY + qrSize + nombreGap + titleFont * 0.75;
  } else {
    titleY = topPad + titleFont * 0.85;
    qrY = titleY + nombreGap;
    qrSize = size - qrY - bottomPad;
  }

  qrSize = Math.max(80, qrSize);
  const qrX = (size - qrSize) / 2;

  const matrixSize = modules.size;
  const quiet = Math.max(0, Number(estilo.margen_qr) || 1);
  const cells = matrixSize + quiet * 2;
  const cell = qrSize / cells;
  const rounded = estilo.modulos_estilo !== 'square';
  // Esquinas suaves pero casi cuadradas (antes 0.38 rompía la lectura).
  // Solapá un poco los módulos para masa continua sin huecos.
  const radius = rounded ? cell * 0.23 : 0;
  const overlap = rounded ? cell * 0.22 : 0;

  const parts = [];
  for (let y = 0; y < matrixSize; y += 1) {
    for (let x = 0; x < matrixSize; x += 1) {
      if (!modules.get(x, y)) continue;
      if (inFinderZone(x, y, matrixSize)) continue;
      const px = qrX + (x + quiet) * cell - overlap / 2;
      const py = qrY + (y + quiet) * cell - overlap / 2;
      const w = cell + overlap;
      const h = cell + overlap;
      if (rounded && radius > 0) {
        parts.push(
          `<rect x="${px.toFixed(2)}" y="${py.toFixed(2)}" width="${w.toFixed(2)}" height="${h.toFixed(2)}" rx="${radius.toFixed(2)}" ry="${radius.toFixed(2)}" fill="${estilo.color_modulos}"/>`,
        );
      } else {
        parts.push(
          `<rect x="${px.toFixed(2)}" y="${py.toFixed(2)}" width="${w.toFixed(2)}" height="${h.toFixed(2)}" fill="${estilo.color_modulos}"/>`,
        );
      }
    }
  }

  // Ancho del marco de los ojos = 1 módulo (mismo trazo para el anillo del logo).
  const eyeRingWidth = cell;

  for (const center of finderCenters(matrixSize)) {
    const ox = qrX + (center.x - 3 + quiet) * cell;
    const oy = qrY + (center.y - 3 + quiet) * cell;
    const outer = cell * 7;
    // Esquinas del ojo más cuadradas (antes demasiado redondas).
    const outerR = rounded ? cell * 0.32 : cell * 0.15;
    const ring = eyeRingWidth;
    const innerBox = outer - ring * 2;
    const innerR = rounded ? Math.max(0, cell * 0.18) : cell * 0.1;
    const cx = ox + outer / 2;
    const cy = oy + outer / 2;
    // Punto naranja: círculo que cubre el centro 3×3 (legible + marca).
    const dotR = cell * 1.5;

    parts.push(
      `<rect x="${ox.toFixed(2)}" y="${oy.toFixed(2)}" width="${outer.toFixed(2)}" height="${outer.toFixed(2)}" rx="${outerR.toFixed(2)}" ry="${outerR.toFixed(2)}" fill="${estilo.color_modulos}"/>`,
    );
    parts.push(
      `<rect x="${(ox + ring).toFixed(2)}" y="${(oy + ring).toFixed(2)}" width="${innerBox.toFixed(2)}" height="${innerBox.toFixed(2)}" rx="${innerR.toFixed(2)}" ry="${innerR.toFixed(2)}" fill="${estilo.color_fondo}"/>`,
    );
    parts.push(
      `<circle cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="${dotR.toFixed(2)}" fill="${estilo.color_ojos}"/>`,
    );
  }

  const logoPct = estilo.logo_porcentaje / 100;
  const logoDiameter = qrSize * logoPct;
  const logoPad = Math.max(2, Math.min(3, Math.round(qrSize * 0.008)));
  const ringWidth = eyeRingWidth;
  const maskDiameter = logoDiameter + logoPad * 2;
  const ringOuterDiameter = maskDiameter + ringWidth * 2;
  const logoCx = qrX + qrSize / 2;
  const logoCy = qrY + qrSize / 2;
  const logoX = logoCx - logoDiameter / 2;
  const logoY = logoCy - logoDiameter / 2;
  const clipId = `logo-clip-${Math.random().toString(36).slice(2, 9)}`;

  const brandText = escapeXml(estilo.texto_marca || 'AGUARÁ APP');
  // letter-spacing ≈ +10% del tamaño de fuente (tracking-wider)
  const tracking = Math.round(titleFont * 0.1 * 10) / 10;

  // Escuadras L: enmarcan nombre + QR (como en la plantilla impresa).
  const lPad = Math.max(cell * 0.6, size * 0.012);
  const lStroke = Math.max(cell * 0.55, size * 0.012);
  const lArm = Math.max(cell * 2.2, size * 0.055);
  let frameTop;
  let frameBottom;
  if (estilo.nombre_posicion === 'bottom') {
    frameTop = qrY - lPad;
    frameBottom = Math.min(size - lPad * 0.5, titleY + titleFont * 0.25 + lPad);
  } else {
    frameTop = Math.max(lPad * 0.4, titleY - titleFont * 0.85 - lPad * 0.3);
    frameBottom = qrY + qrSize + lPad;
  }
  const frame = {
    left: qrX - lPad,
    right: qrX + qrSize + lPad,
    top: frameTop,
    bottom: frameBottom,
  };
  const cornerLs = cornerLPaths(frame, lArm, lStroke, estilo.color_modulos);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" overflow="visible">
  <defs>
    <clipPath id="${clipId}">
      <circle cx="${logoCx.toFixed(2)}" cy="${logoCy.toFixed(2)}" r="${(logoDiameter / 2).toFixed(2)}"/>
    </clipPath>
  </defs>
  <rect width="${size}" height="${size}" fill="${estilo.color_fondo}"/>
  ${cornerLs}
  <text x="${size / 2}" y="${titleY.toFixed(2)}" text-anchor="middle" font-family="Inter, ui-sans-serif, system-ui, Arial, Helvetica, sans-serif" font-size="${titleFont}" font-weight="700" letter-spacing="${tracking}" fill="${estilo.color_texto}">${brandText}</text>
  ${parts.join('\n  ')}
  <circle cx="${logoCx.toFixed(2)}" cy="${logoCy.toFixed(2)}" r="${(ringOuterDiameter / 2).toFixed(2)}" fill="${estilo.color_modulos}"/>
  <circle cx="${logoCx.toFixed(2)}" cy="${logoCy.toFixed(2)}" r="${(maskDiameter / 2).toFixed(2)}" fill="${estilo.color_fondo}"/>
  <image href="${logoDataUrl}" xlink:href="${logoDataUrl}" x="${logoX.toFixed(2)}" y="${logoY.toFixed(2)}" width="${logoDiameter.toFixed(2)}" height="${logoDiameter.toFixed(2)}" preserveAspectRatio="xMidYMid meet" clip-path="url(#${clipId})"/>
</svg>`;
}

/** @deprecated Usar renderBrandedQrMatrixSvg; se mantiene por compatibilidad. */
export function composeBrandedQrSvg(qrSvg, logoDataUrl, estiloInput) {
  const estilo = normalizeQrEstilo(estiloInput || loadQrEstilo());
  const size = estilo.tamano_final;
  const titleFont = estilo.nombre_tamano;
  const nombreGap = Number.isFinite(estilo.nombre_espacio) ? estilo.nombre_espacio : 8;
  const topPad = Math.max(8, Math.round(size * 0.02));
  const bottomPad = Math.max(8, Math.round(size * 0.02));
  const titleBand = titleFont + nombreGap + Math.round(titleFont * 0.2);

  let titleY;
  let qrY;
  let qrSize;

  if (estilo.nombre_posicion === 'bottom') {
    qrY = topPad;
    qrSize = size - titleBand - topPad - bottomPad;
    titleY = qrY + qrSize + nombreGap + titleFont * 0.75;
  } else {
    titleY = topPad + titleFont * 0.78;
    qrY = titleY + nombreGap;
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
        `<svg x="${qrX}" y="${qrY}" width="${qrSize}" height="${qrSize}"`,
      );
    });
  const brandText = escapeXml(estilo.texto_marca || 'AGUARÁ APP');
  const tracking = Math.round(titleFont * 0.1 * 10) / 10;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" overflow="visible">
  <defs>
    <clipPath id="${clipId}">
      <circle cx="${boxX + boxSize / 2}" cy="${boxY + boxSize / 2}" r="${boxSize / 2}"/>
    </clipPath>
  </defs>
  <rect width="${size}" height="${size}" fill="${estilo.color_fondo}"/>
  <text x="${size / 2}" y="${titleY}" text-anchor="middle" font-family="Inter, ui-sans-serif, system-ui, Arial, Helvetica, sans-serif" font-size="${titleFont}" font-weight="700" letter-spacing="${tracking}" fill="${estilo.color_texto}">${brandText}</text>
  ${nestedQr}
  <circle cx="${boxX + boxSize / 2}" cy="${boxY + boxSize / 2}" r="${boxSize / 2}" fill="${estilo.color_fondo}"/>
  <image href="${logoDataUrl}" xlink:href="${logoDataUrl}" x="${boxX + logoPad}" y="${boxY + logoPad}" width="${logoSize}" height="${logoSize}" preserveAspectRatio="xMidYMid meet" clip-path="url(#${clipId})"/>
</svg>`;
}

export async function generateChapitaQrSvg(chapitaId, estiloInput) {
  const estilo = normalizeQrEstilo(estiloInput || loadQrEstilo());
  const url = getChapitaPublicUrl(chapitaId);
  const [qr, logoDataUrl] = await Promise.all([
    Promise.resolve(
      QRCode.create(url, {
        errorCorrectionLevel: estilo.complejidad,
      }),
    ),
    loadLogoDataUrl(),
  ]);
  return renderBrandedQrMatrixSvg(qr.modules, logoDataUrl, estilo);
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
  const items = [];

  for (let seq = 1; seq <= total; seq += 1) {
    const id = formatTiradaChapitaId(tirada, seq);
    const qr = QRCode.create(getChapitaPublicUrl(id), {
      errorCorrectionLevel: estilo.complejidad,
    });
    const branded = renderBrandedQrMatrixSvg(qr.modules, logoDataUrl, estilo);
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
