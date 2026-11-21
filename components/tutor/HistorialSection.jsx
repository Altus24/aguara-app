"use client";

import { useEffect, useMemo, useState } from "react";

import {
  cardClass,
  fieldClass,
  formatDate,
  formatDateTime,
  primaryBtnClass,
  secondaryBtnClass,
} from "@/components/tutor/ui";
import {
  buildConsultaText,
  buildHistorialText,
  downloadTextFile,
  historialClinicoTutor,
} from "@/lib/chapitas/tutorPortal";
import { esVacunaVencida } from "@/lib/chapitas/vacunas";

function mascotaKeyOf(row) {
  return row.mascota_key || row.clinica_pacientes?.nombre || "mascota";
}

function groupByMascota(rows) {
  const map = new Map();
  for (const row of rows || []) {
    const key = mascotaKeyOf(row);
    const nombre = row.mascota_nombre || row.clinica_pacientes?.nombre || "Mascota";
    if (!map.has(key)) map.set(key, { key, nombre, items: [] });
    map.get(key).items.push(row);
  }
  return [...map.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}

function filterByMascota(rows, mascotaKey) {
  if (!mascotaKey) return rows || [];
  return (rows || []).filter((r) => mascotaKeyOf(r) === mascotaKey);
}

function CollapsibleItems({ items, groupKey, expanded, onToggle, renderItem }) {
  const visible = expanded ? items : items.slice(0, 1);
  const ocultos = Math.max(0, items.length - 1);
  return (
    <div>
      <ul className="space-y-2 text-sm">{visible.map(renderItem)}</ul>
      {ocultos > 0 ? (
        <button
          type="button"
          className="mt-2 text-sm font-medium text-aguara-orange hover:underline"
          onClick={() => onToggle(groupKey)}
        >
          {expanded ? "Ver menos" : `Ver más (${ocultos} anterior${ocultos === 1 ? "" : "es"})`}
        </button>
      ) : null}
    </div>
  );
}

function MascotaGroupedList({ rows, emptyText, renderItem, showGroups, resetKey }) {
  const [expanded, setExpanded] = useState(() => new Set());

  useEffect(() => {
    setExpanded(new Set());
  }, [resetKey, showGroups]);

  function toggle(groupKey) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(groupKey)) next.delete(groupKey);
      else next.add(groupKey);
      return next;
    });
  }

  if (!rows.length) {
    return <p className="mt-3 text-sm text-stone-500">{emptyText}</p>;
  }

  if (!showGroups) {
    return (
      <div className="mt-3">
        <CollapsibleItems
          items={rows}
          groupKey="all"
          expanded={expanded.has("all")}
          onToggle={toggle}
          renderItem={renderItem}
        />
      </div>
    );
  }

  const groups = groupByMascota(rows);
  return (
    <div className="mt-3 space-y-4">
      {groups.map((g) => (
        <div key={g.key}>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-aguara-orange">
            {g.nombre}
          </p>
          <CollapsibleItems
            items={g.items}
            groupKey={g.key}
            expanded={expanded.has(g.key)}
            onToggle={toggle}
            renderItem={renderItem}
          />
        </div>
      ))}
    </div>
  );
}

export default function HistorialSection({ tutor }) {
  const [data, setData] = useState({
    mascotas: [],
    consultas: [],
    vacunas: [],
    desparasitaciones: [],
    archivos: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mascotaFiltro, setMascotaFiltro] = useState("");

  const opcionesMascota = useMemo(() => {
    const fromPets = (data.mascotas || [])
      .filter((m) => m.chapita_id || m.paciente_clinico_id)
      .map((m) => ({
        key: m.chapita_id || m.paciente_clinico_id,
        nombre: m.nombre,
      }));
    const seen = new Set(fromPets.map((p) => p.key));
    for (const row of [
      ...(data.consultas || []),
      ...(data.vacunas || []),
      ...(data.desparasitaciones || []),
      ...(data.archivos || []),
    ]) {
      const key = row.mascota_key || row.clinica_pacientes?.nombre;
      if (!key || seen.has(key)) continue;
      seen.add(key);
      fromPets.push({
        key,
        nombre: row.mascota_nombre || row.clinica_pacientes?.nombre || "Mascota",
      });
    }
    return fromPets.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  }, [data]);

  const variasMascotas = opcionesMascota.length > 1;
  const showGroups = variasMascotas && !mascotaFiltro;

  const consultas = filterByMascota(data.consultas, mascotaFiltro);
  const vacunas = filterByMascota(data.vacunas, mascotaFiltro);
  const desparasitaciones = filterByMascota(data.desparasitaciones, mascotaFiltro);
  const archivos = filterByMascota(data.archivos, mascotaFiltro);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const hist = await historialClinicoTutor(tutor.id, tutor.email);
        if (!cancelled) setData(hist);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "No se pudo cargar el historial.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [tutor.id, tutor.email]);

  function descargarTodo() {
    const text = buildHistorialText({
      tutor,
      consultas,
      vacunas,
      desparasitaciones,
      archivos,
    });
    const suffix = mascotaFiltro
      ? `-${opcionesMascota.find((m) => m.key === mascotaFiltro)?.nombre || "mascota"}`
      : "";
    downloadTextFile(`historial-clinico${suffix}-${tutor.email}.txt`, text);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-aguara-ink">Historial clínico</h2>
          <p className="text-sm text-stone-500">
            Consultas, tratamientos, vacunas, desparasitaciones y archivos
          </p>
        </div>
        <button type="button" className={primaryBtnClass} onClick={descargarTodo} disabled={loading}>
          Descargar historial completo
        </button>
      </div>

      {variasMascotas ? (
        <div className={cardClass}>
          <label className="block text-sm" htmlFor="hist-filtro-mascota">
            <span className="mb-1 block font-medium text-stone-700">Ver por mascota</span>
            <select
              id="hist-filtro-mascota"
              className={fieldClass}
              value={mascotaFiltro}
              onChange={(e) => setMascotaFiltro(e.target.value)}
            >
              <option value="">Todas las mascotas (agrupadas)</option>
              {opcionesMascota.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.nombre}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}

      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      <div className={cardClass}>
        <h3 className="font-semibold text-aguara-ink">Consultas anteriores</h3>
        {loading ? (
          <p className="mt-3 text-sm text-stone-500">Cargando…</p>
        ) : (
          <MascotaGroupedList
            rows={consultas}
            emptyText="Todavía no hay consultas compartidas por tu clínica."
            showGroups={showGroups}
            resetKey={mascotaFiltro}
            renderItem={(c) => (
              <li key={c.id} className="rounded-xl bg-aguara-cream/30 px-3 py-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-aguara-ink">
                      {!showGroups ? `${c.mascota_nombre || c.clinica_pacientes?.nombre || "Mascota"} · ` : ""}
                      {formatDateTime(c.fecha)}
                      {c.clinicas?.nombre ? ` · ${c.clinicas.nombre}` : ""}
                    </p>
                    <p className="text-sm text-stone-600">Motivo: {c.motivo || "—"}</p>
                    <p className="text-sm text-stone-600">Diagnóstico: {c.diagnostico || "—"}</p>
                    {c.tratamiento ? (
                      <p className="text-sm text-stone-600">Tratamiento: {c.tratamiento}</p>
                    ) : null}
                    {c.medicacion ? (
                      <p className="text-sm text-stone-600">
                        Indicaciones / medicación: {c.medicacion}
                      </p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    className={secondaryBtnClass}
                    onClick={() =>
                      downloadTextFile(
                        `consulta-${c.mascota_nombre || "mascota"}-${String(c.fecha).slice(0, 10)}.txt`,
                        buildConsultaText(c),
                      )
                    }
                  >
                    Descargar
                  </button>
                </div>
              </li>
            )}
          />
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className={cardClass}>
          <h3 className="font-semibold text-aguara-ink">Vacunas</h3>
          <MascotaGroupedList
            rows={vacunas}
            emptyText="Sin vacunas registradas."
            showGroups={showGroups}
            resetKey={mascotaFiltro}
            renderItem={(v) => (
              <li key={`${v.origen || "clinica"}-${v.id}`}>
                {!showGroups ? (
                  <strong>{v.mascota_nombre || v.clinica_pacientes?.nombre || "Mascota"}</strong>
                ) : null}
                {!showGroups ? " · " : null}
                {v.nombre} · {formatDate(v.fecha)}
                {esVacunaVencida(v) ? (
                  <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-800">
                    Vencida
                  </span>
                ) : null}
                {v.proxima_fecha ? ` · próxima ${formatDate(v.proxima_fecha)}` : ""}
                {v.origen === "tutor" ? " · cargada por vos" : ""}
              </li>
            )}
          />
        </div>
        <div className={cardClass}>
          <h3 className="font-semibold text-aguara-ink">Desparasitaciones</h3>
          <MascotaGroupedList
            rows={desparasitaciones}
            emptyText="Sin registros."
            showGroups={showGroups}
            resetKey={mascotaFiltro}
            renderItem={(d) => (
              <li key={d.id}>
                {!showGroups ? (
                  <strong>{d.mascota_nombre || d.clinica_pacientes?.nombre || "Mascota"}</strong>
                ) : null}
                {!showGroups ? " · " : null}
                {d.producto} · {formatDate(d.fecha)}
                {d.proxima_fecha ? ` · próxima ${formatDate(d.proxima_fecha)}` : ""}
              </li>
            )}
          />
        </div>
      </div>

      <div className={cardClass}>
        <h3 className="font-semibold text-aguara-ink">Estudios y archivos</h3>
        <MascotaGroupedList
          rows={archivos}
          emptyText="Sin archivos compartidos."
          showGroups={showGroups}
          resetKey={mascotaFiltro}
          renderItem={(a) => (
            <li key={a.id}>
              <a
                href={a.url}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-aguara-orange hover:underline"
              >
                {a.nombre}
              </a>{" "}
              <span className="text-stone-500">
                ({a.tipo})
                {!showGroups
                  ? ` · ${a.mascota_nombre || a.clinica_pacientes?.nombre || "Mascota"}`
                  : ""}{" "}
                · {formatDateTime(a.creado_en)}
              </span>
            </li>
          )}
        />
      </div>
    </div>
  );
}
