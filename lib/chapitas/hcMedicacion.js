/** Ítems estructurados de medicación en historia clínica. */

export function emptyHcMedItem() {
  return {
    medicamento: "",
    dosis: "",
    tiempo: "",
    indicaciones: "",
  };
}

function normalizeItem(raw) {
  if (!raw || typeof raw !== "object") return emptyHcMedItem();
  return {
    medicamento: String(raw.medicamento || "").trim(),
    dosis: String(raw.dosis || "").trim(),
    tiempo: String(raw.tiempo || "").trim(),
    indicaciones: String(raw.indicaciones || "").trim(),
  };
}

export function itemHcMedTieneDatos(item) {
  const n = normalizeItem(item);
  return Boolean(n.medicamento || n.dosis || n.tiempo || n.indicaciones);
}

/** Parsea el texto guardado en clinica_consultas.medicacion (JSON o legado libre). */
export function parseHcMedicacion(raw) {
  const s = String(raw || "").trim();
  if (!s) return [emptyHcMedItem()];
  if (s.startsWith("[")) {
    try {
      const arr = JSON.parse(s);
      if (Array.isArray(arr) && arr.length) {
        const items = arr.map(normalizeItem);
        return items.length ? items : [emptyHcMedItem()];
      }
    } catch {
      // legado
    }
  }
  return [{ ...emptyHcMedItem(), medicamento: s }];
}

/** Serializa ítems a JSON para persistir en medicacion. */
export function serializeHcMedicacion(items) {
  const clean = (Array.isArray(items) ? items : [])
    .map(normalizeItem)
    .filter((i) => i.medicamento);
  if (!clean.length) return "";
  return JSON.stringify(clean);
}

/** Texto corrido por medicamento (sin etiquetas “Dosis” / “Tiempo”). */
export function formatHcMedItemLine(item) {
  const n = normalizeItem(item);
  if (!n.medicamento) return "";
  const regimen = [n.dosis, n.tiempo].filter(Boolean).join(", ");
  let line = regimen ? `${n.medicamento}: ${regimen}` : n.medicamento;
  if (n.indicaciones) {
    const needsDot = !/[.!?…]$/.test(line);
    line += `${needsDot ? "." : ""} ${n.indicaciones}`;
  }
  return line;
}

/** Lista de líneas para receta o vista. */
export function formatHcMedicacionLines(raw) {
  return parseHcMedicacion(raw)
    .map(formatHcMedItemLine)
    .filter(Boolean);
}

/** Texto multilinea para mostrar en ficha (no JSON crudo). */
export function formatHcMedicacionDisplay(raw) {
  const lines = formatHcMedicacionLines(raw);
  return lines.length ? lines.join("\n") : "";
}
