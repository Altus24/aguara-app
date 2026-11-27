"use client";

import { forwardRef } from "react";
import { toJpeg } from "html-to-image";

import { formatHcMedicacionLines } from "@/lib/chapitas/hcMedicacion";
import { recetaConfigDeClinica } from "@/lib/chapitas/recetaConfig";
import { formatDate, parseAppDate } from "@/lib/dateFormat";

function dash(value) {
  const s = String(value || "").trim();
  return s || "—";
}

function formatGenero(sexo) {
  const s = String(sexo || "").trim().toLowerCase();
  if (s === "hembra") return "Hembra";
  if (s === "macho") return "Macho";
  const raw = String(sexo || "").trim();
  if (/^hembra$/i.test(raw)) return "Hembra";
  if (/^macho$/i.test(raw)) return "Macho";
  return dash(sexo);
}

/** Edad legible a partir de fecha de nacimiento. */
function formatEdad(fechaNacimiento) {
  const birth = parseAppDate(fechaNacimiento);
  if (!birth) return "—";
  const now = new Date();
  let years = now.getFullYear() - birth.getFullYear();
  let months = now.getMonth() - birth.getMonth();
  if (now.getDate() < birth.getDate()) months -= 1;
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  if (years < 0) return "—";
  if (years === 0) {
    if (months <= 0) return "menos de 1 mes";
    return months === 1 ? "1 mes" : `${months} meses`;
  }
  if (years === 1 && months === 0) return "1 año";
  if (months === 0) return `${years} años`;
  const yLabel = years === 1 ? "1 año" : `${years} años`;
  const mLabel = months === 1 ? "1 mes" : `${months} meses`;
  return `${yLabel} y ${mLabel}`;
}

function parseFirmadoPor(firmadoPor) {
  const raw = String(firmadoPor || "").trim();
  if (!raw) return { nombre: "—", matricula: "" };
  const parts = raw.split(/\s·\s|\s·\sMat\.?\s*|Mat\.?\s*/i).filter(Boolean);
  if (parts.length >= 2) {
    return { nombre: parts[0].trim(), matricula: parts[parts.length - 1].trim() };
  }
  const matMatch = /Mat\.?\s*(.+)$/i.exec(raw);
  if (matMatch) {
    return {
      nombre: raw.replace(/\s*·?\s*Mat\.?\s*.+$/i, "").trim() || "—",
      matricula: matMatch[1].trim(),
    };
  }
  return { nombre: raw, matricula: "" };
}

function direccionClinica(clinica) {
  return [clinica?.direccion, clinica?.ciudad, clinica?.provincia]
    .map((v) => String(v || "").trim())
    .filter(Boolean)
    .join(", ");
}

/**
 * Plantilla visual de receta (A4-ish) para vista previa y export JPEG.
 */
const RecetaDocumento = forwardRef(function RecetaDocumento(
  {
    clinica,
    paciente,
    cliente,
    medicacion,
    diagnostico,
    firmaImagen,
    firmadoPor,
    fechaHoy,
    config: configOverride,
  },
  ref,
) {
  const vet = parseFirmadoPor(firmadoPor);
  const medLines = formatHcMedicacionLines(medicacion);
  const dx = String(diagnostico || "").trim();
  const cfg = configOverride || recetaConfigDeClinica(clinica);
  const whatsapp = String(clinica?.telefono || "").trim() || "—";
  const logoUrl = clinica?.logo_url || null;
  const fecha = fechaHoy || formatDate(new Date());
  const logoSize = cfg.logo_tamano;
  const direccion = direccionClinica(clinica);
  const accent = cfg.color_acento;

  return (
    <div
      ref={ref}
      className="box-border bg-white text-stone-900"
      style={{
        width: 794,
        minHeight: 1123,
        padding: "48px 56px 40px",
        fontFamily: "Arial, Helvetica, sans-serif",
      }}
    >
      {/* Header: logo / nombre + datos de contacto sobre la línea de acento */}
      <div className="mb-6 pb-3" style={{ borderBottom: `2px solid ${accent}` }}>
        {cfg.mostrar_logo ? (
          <div className="flex justify-center">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt={clinica?.nombre || "Logo"}
                crossOrigin="anonymous"
                style={{ width: logoSize, height: logoSize, objectFit: "contain" }}
              />
            ) : (
              <div
                className="flex items-center justify-center rounded-full border border-stone-200 bg-stone-50 text-center text-sm font-semibold text-stone-700"
                style={{ width: logoSize, height: logoSize, padding: 8 }}
              >
                {dash(clinica?.nombre)}
              </div>
            )}
          </div>
        ) : null}
        {cfg.mostrar_nombre_clinica ? (
          <p
            className={`text-center text-[17px] font-bold text-stone-900 ${
              cfg.mostrar_logo ? "mt-2" : ""
            }`}
          >
            {dash(clinica?.nombre)}
          </p>
        ) : null}
        {cfg.mostrar_telefono ? (
          <p
            className={`text-center text-[15px] font-bold text-stone-900 ${
              cfg.mostrar_logo || cfg.mostrar_nombre_clinica ? "mt-1" : ""
            }`}
          >
            {whatsapp}
          </p>
        ) : null}
        {cfg.mostrar_direccion && direccion ? (
          <p className="mt-1 text-center text-[13px] text-stone-600">{direccion}</p>
        ) : null}
      </div>

      {/* Tutor (valores) + paciente (título + datos en una línea) */}
      <div className="mb-10 space-y-4 text-[15px] leading-relaxed text-stone-900">
        <div className="space-y-1">
          <p>{dash(cliente?.nombre_completo)}</p>
          <p>{dash(cliente?.direccion)}</p>
          <p>{dash(cliente?.dni)}</p>
        </div>
        <div>
          <p className="mb-1 font-bold">Paciente</p>
          <p>
            {[
              String(paciente?.nombre || "").trim(),
              formatEdad(paciente?.fecha_nacimiento),
              formatGenero(paciente?.sexo),
              String(paciente?.raza || "").trim(),
            ]
              .filter((v) => v && v !== "—")
              .join(" - ") || "—"}
          </p>
        </div>
      </div>

      {/* Diagnóstico (solo si se marcó incluir en receta) + medicación */}
      <div className="min-h-[420px] text-[16px] leading-8">
        {dx ? (
          <p className="mb-5">
            <span className="font-semibold">Diagnóstico:</span> {dx}
          </p>
        ) : null}
        {medLines.length ? (
          <ul className="m-0 list-none space-y-5 p-0">
            {medLines.map((line, i) => (
              <li
                key={`${i}-${line.slice(0, 24)}`}
                className="flex items-start gap-3"
              >
                <span
                  aria-hidden
                  className="mt-1 shrink-0 leading-none text-stone-900"
                  style={{ fontSize: 28 }}
                >
                  •
                </span>
                <span className="min-w-0 flex-1">{line}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-stone-500">Sin medicación indicada.</p>
        )}
      </div>

      {/* Pie */}
      <div className="mt-8 flex items-end justify-between gap-8">
        <p className="text-[15px]">
          <span className="font-semibold">Fecha:</span> {fecha}
        </p>
        <div className="w-56 text-center text-[14px] leading-snug">
          {firmaImagen ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={firmaImagen}
              alt="Firma"
              crossOrigin="anonymous"
              className="mx-auto mb-1 object-contain"
              style={{ height: 64, maxWidth: 200 }}
            />
          ) : (
            <div className="mx-auto mb-2 h-16 w-40 border-b border-stone-400" />
          )}
          <p className="font-medium">{vet.nombre}</p>
          <p>{cfg.etiqueta_profesional}</p>
          {vet.matricula ? <p>M.P: {vet.matricula}</p> : null}
        </div>
      </div>

      {cfg.texto_pie ? (
        <p className="mt-8 text-center text-[11px] leading-snug text-stone-500">{cfg.texto_pie}</p>
      ) : null}
    </div>
  );
});

export default RecetaDocumento;

/**
 * Next/Turbopack inyecta hojas CSS cross-origin; html-to-image falla al leer cssRules.
 * Deshabilitamos temporalmente las que no se pueden leer.
 */
function withReadableStylesheets(run) {
  const disabled = [];
  for (const sheet of Array.from(document.styleSheets || [])) {
    try {
      // eslint-disable-next-line no-unused-expressions
      sheet.cssRules;
    } catch {
      if (!sheet.disabled) {
        sheet.disabled = true;
        disabled.push(sheet);
      }
    }
  }
  return Promise.resolve()
    .then(run)
    .finally(() => {
      for (const sheet of disabled) {
        sheet.disabled = false;
      }
    });
}

/**
 * Genera un File JPEG a partir del nodo DOM de la receta.
 * @param {HTMLElement} node
 * @param {string} [fileName]
 */
export async function exportRecetaJpeg(node, fileName = "receta.jpg") {
  if (!node) throw new Error("No hay documento de receta para exportar.");

  const dataUrl = await withReadableStylesheets(() =>
    toJpeg(node, {
      quality: 0.95,
      pixelRatio: 2,
      cacheBust: true,
      skipFonts: true,
      backgroundColor: "#ffffff",
      // Evita embebido de CSS externo que dispara SecurityError
      fontEmbedCSS: "",
    }),
  );

  const res = await fetch(dataUrl);
  const blob = await res.blob();
  return new File([blob], fileName, { type: "image/jpeg" });
}

export { formatGenero, parseFirmadoPor };
