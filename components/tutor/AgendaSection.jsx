"use client";

import { useEffect, useState } from "react";

import {
  EstadoBadge,
  Field,
  cardClass,
  fieldClass,
  formatDateTime,
  primaryBtnClass,
  secondaryBtnClass,
} from "@/components/tutor/ui";
import { etiquetaEstado } from "@/lib/chapitas/clinicaOps";
import {
  listarCitasTutor,
  listarClinicas,
  listarMascotasTutorCompletas,
  reprogramarCitaTutor,
  solicitarCitaTutor,
} from "@/lib/chapitas/tutorPortal";

export default function AgendaSection({ tutor }) {
  const [proximas, setProximas] = useState([]);
  const [pasadas, setPasadas] = useState([]);
  const [mascotas, setMascotas] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [clinicas, setClinicas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  const clinicaPref = clinicas.find((c) => c.id === tutor.clinica_preferida_id);
  const permiteSolicitar =
    clinicaPref?.permite_citas_tutor !== false && clinicas.some((c) => c.permite_citas_tutor !== false);

  async function reload() {
    setLoading(true);
    setError("");
    try {
      const [citas, pets, clinics] = await Promise.all([
        listarCitasTutor(tutor.id, tutor.email),
        listarMascotasTutorCompletas(tutor.id, tutor.email),
        listarClinicas(),
      ]);
      setProximas(citas.proximas);
      setPasadas(citas.pasadas);
      setClientes(citas.clientes);
      setMascotas(pets.mascotas);
      setClinicas(clinics);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar la agenda.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tutor.id, tutor.email, tutor.clinica_preferida_id]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-aguara-ink">Mis citas</h2>
          <p className="text-sm text-stone-500">Próximas, historial y solicitudes</p>
        </div>
        {permiteSolicitar ? (
          <button
            type="button"
            className={primaryBtnClass}
            onClick={() => {
              setEditing(null);
              setShowForm(true);
            }}
          >
            Solicitar cita
          </button>
        ) : null}
      </div>

      {!permiteSolicitar ? (
        <p className="text-sm text-stone-500">
          Tu clínica aún no habilitó solicitudes online. Elegí una sucursal en Perfil o contactala
          directamente.
        </p>
      ) : null}

      {showForm ? (
        <CitaForm
          tutor={tutor}
          mascotas={mascotas}
          clientes={clientes}
          clinicas={clinicas.filter((c) => c.permite_citas_tutor !== false)}
          initial={editing}
          onCancel={() => {
            setShowForm(false);
            setEditing(null);
          }}
          onSaved={async () => {
            setShowForm(false);
            setEditing(null);
            await reload();
          }}
        />
      ) : null}

      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      <div className={cardClass}>
        <h3 className="font-semibold text-aguara-ink">Próximas citas</h3>
        {loading ? (
          <p className="mt-3 text-sm text-stone-500">Cargando…</p>
        ) : proximas.length === 0 ? (
          <p className="mt-3 text-sm text-stone-500">No tenés citas próximas.</p>
        ) : (
          <ul className="mt-3 divide-y divide-stone-100">
            {proximas.map((cita) => (
              <li key={cita.id} className="py-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-aguara-ink">
                      {cita.clinica_pacientes?.nombre || "Mascota"} ·{" "}
                      {cita.inicio ? formatDateTime(cita.inicio) : "A coordinar"}
                    </p>
                    <p className="text-sm text-stone-500">
                      {cita.clinicas?.nombre || "Clínica"}
                      {cita.clinicas?.ciudad ? ` · ${cita.clinicas.ciudad}` : ""}
                      {cita.motivo ? ` · ${cita.motivo}` : ""}
                    </p>
                  </div>
                  <EstadoBadge estado={cita.estado} label={etiquetaEstado(cita.estado)} />
                </div>
                {permiteSolicitar && ["pendiente", "confirmada", "lista_espera"].includes(cita.estado) ? (
                  <button
                    type="button"
                    className="mt-2 text-sm text-aguara-orange underline"
                    onClick={() => {
                      setEditing(cita);
                      setShowForm(true);
                    }}
                  >
                    Reprogramar
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className={cardClass}>
        <h3 className="font-semibold text-aguara-ink">Historial de citas</h3>
        {loading ? (
          <p className="mt-3 text-sm text-stone-500">Cargando…</p>
        ) : pasadas.length === 0 ? (
          <p className="mt-3 text-sm text-stone-500">Sin citas pasadas.</p>
        ) : (
          <ul className="mt-3 divide-y divide-stone-100">
            {pasadas.map((cita) => (
              <li key={cita.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-medium text-aguara-ink">
                    {cita.clinica_pacientes?.nombre || "Mascota"} ·{" "}
                    {cita.inicio ? formatDateTime(cita.inicio) : "—"}
                  </p>
                  <p className="text-sm text-stone-500">
                    {cita.clinicas?.nombre || "Clínica"}
                    {cita.motivo ? ` · ${cita.motivo}` : ""}
                  </p>
                </div>
                <EstadoBadge estado={cita.estado} label={etiquetaEstado(cita.estado)} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function toLocalInputValue(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function CitaForm({ tutor, mascotas, clientes, clinicas, initial, onCancel, onSaved }) {
  const defaultClinica = tutor.clinica_preferida_id || clinicas[0]?.id || "";
  const [form, setForm] = useState({
    clinica_id: initial?.clinica_id || defaultClinica,
    paciente_key: "",
    inicio: toLocalInputValue(initial?.inicio) || "",
    motivo: initial?.motivo || "",
    notas: initial?.notas || "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (initial?.paciente_id) {
      const m = mascotas.find((x) => x.paciente_clinico_id === initial.paciente_id);
      if (m) setForm((f) => ({ ...f, paciente_key: m.key }));
    }
  }, [initial, mascotas]);

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (!form.clinica_id) throw new Error("Elegí una sucursal.");
      if (!form.inicio) throw new Error("Indicá fecha y hora preferida.");
      const mascota = mascotas.find((m) => m.key === form.paciente_key);
      const cliente =
        clientes.find((c) => c.clinica_id === form.clinica_id) ||
        clientes.find((c) => c.id === mascota?.cliente_id) ||
        clientes[0];

      if (!cliente && !mascota?.cliente_id) {
        throw new Error(
          "Todavía no estás vinculado a esa clínica. Pedile que te registre como cliente o cargá tu email en su ficha.",
        );
      }

      const inicioISO = new Date(form.inicio).toISOString();
      if (initial?.id) {
        await reprogramarCitaTutor(initial.id, {
          inicio: inicioISO,
          motivo: form.motivo,
          notas: form.notas,
        });
      } else {
        await solicitarCitaTutor({
          clinica_id: form.clinica_id,
          paciente_id: mascota?.paciente_clinico_id || null,
          cliente_id: mascota?.cliente_id || cliente.id,
          inicio: inicioISO,
          motivo: form.motivo,
          notas: form.notas,
          estado: "pendiente",
        });
      }
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo enviar la solicitud.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className={`${cardClass} space-y-3`}>
      <h3 className="font-semibold text-aguara-ink">
        {initial?.id ? "Reprogramar cita" : "Solicitar cita"}
      </h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Sucursal" id="t-cita-cli">
          <select
            id="t-cita-cli"
            required
            className={fieldClass}
            value={form.clinica_id}
            onChange={(e) => setForm((f) => ({ ...f, clinica_id: e.target.value }))}
            disabled={Boolean(initial?.id)}
          >
            <option value="">Seleccionar…</option>
            {clinicas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
                {c.ciudad ? ` · ${c.ciudad}` : ""}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Mascota" id="t-cita-masc">
          <select
            id="t-cita-masc"
            className={fieldClass}
            value={form.paciente_key}
            onChange={(e) => setForm((f) => ({ ...f, paciente_key: e.target.value }))}
          >
            <option value="">Seleccionar…</option>
            {mascotas.map((m) => (
              <option key={m.key} value={m.key}>
                {m.nombre}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Fecha y hora preferida" id="t-cita-ini">
          <input
            id="t-cita-ini"
            type="datetime-local"
            required
            className={fieldClass}
            value={form.inicio}
            onChange={(e) => setForm((f) => ({ ...f, inicio: e.target.value }))}
          />
        </Field>
        <Field label="Motivo" id="t-cita-mot">
          <input
            id="t-cita-mot"
            className={fieldClass}
            value={form.motivo}
            onChange={(e) => setForm((f) => ({ ...f, motivo: e.target.value }))}
          />
        </Field>
      </div>
      <Field label="Notas" id="t-cita-notas">
        <textarea
          id="t-cita-notas"
          rows={2}
          className={fieldClass}
          value={form.notas}
          onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))}
        />
      </Field>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <div className="flex gap-2">
        <button type="submit" disabled={saving} className={primaryBtnClass}>
          {saving ? "Enviando…" : initial?.id ? "Pedir reprogramación" : "Enviar solicitud"}
        </button>
        <button type="button" className={secondaryBtnClass} onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
