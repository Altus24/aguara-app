/** Medicación estructurada de historia clínica (medicamento / dosis / tiempo / indicaciones). */

export function emptyMedicacionRow() {
  return {
    medicamento: "",
    dosis: "",
    tiempo: "",
    indicaciones: "",
  };
}

export function parseMedicacionConsulta(value) {
  if (Array.isArray(value)) {
    return value.map(normalizeRow).filter(rowTieneAlgo);
  }
  const raw = String(value || "").trim();
  if (!raw) return [emptyMedicacionRow()];

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const rows = parsed.map(normalizeRow).filter(rowTieneAlgo);
      return rows.length ? rows : [emptyMedicacionRow()];
    }
    if (parsed && typeof parsed === "object") {
      const row = normalizeRow(parsed);
      return rowTieneAlgo(row) ? [row] : [emptyMedicacionRow()];
    }
  } catch {
    // texto libre legacy
  }

  return [
    {
      medicamento: raw.split("\n")[0].trim(),
      dosis: "",
      tiempo: "",
      indicaciones: raw.includes("\n") ? raw.split("\n").slice(1).join("\n").trim() : "",
    },
  ];
}

export function serializeMedicacionConsulta(rows) {
  const clean = (Array.isArray(rows) ? rows : [])
    .map(normalizeRow)
    .filter(rowTieneAlgo);
  if (!clean.length) return "";
  return JSON.stringify(clean);
}

export function formatMedicacionConsultaDisplay(value) {
  const rows = parseMedicacionConsulta(value).filter(rowTieneAlgo);
  if (!rows.length) return "";
  return rows
    .map((row, i) => {
      const head = [row.medicamento, row.dosis, row.tiempo].filter(Boolean).join(" · ");
      const ind = row.indicaciones ? `\nIndicaciones: ${row.indicaciones}` : "";
      return `${i + 1}. ${head || "Medicamento"}${ind}`;
    })
    .join("\n\n");
}

export function formatMedicacionConsultaRecetaLines(value) {
  const rows = parseMedicacionConsulta(value).filter(rowTieneAlgo);
  return rows.map((row) => {
    const parts = [];
    if (row.medicamento) parts.push(row.medicamento);
    if (row.dosis) parts.push(`Dosis: ${row.dosis}`);
    if (row.tiempo) parts.push(`Tiempo: ${row.tiempo}`);
    if (row.indicaciones) parts.push(`Indicaciones: ${row.indicaciones}`);
    return parts.join(" — ");
  });
}

function normalizeRow(row = {}) {
  return {
    medicamento: String(row.medicamento || "").trim(),
    dosis: String(row.dosis || "").trim(),
    tiempo: String(row.tiempo || "").trim(),
    indicaciones: String(row.indicaciones || "").trim(),
  };
}

function rowTieneAlgo(row) {
  return Boolean(row.medicamento || row.dosis || row.tiempo || row.indicaciones);
}
