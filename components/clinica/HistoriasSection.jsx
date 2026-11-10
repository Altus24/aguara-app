"use client";

import { useEffect, useState } from "react";

import {
  cardClass,
  Field,
  fieldClass,
  formatDate,
  formatDateTime,
  primaryBtnClass,
  secondaryBtnClass,
} from "@/components/clinica/ui";
import {
  actualizarConsulta,
  cerrarConsulta,
  crearArchivo,
  crearConsulta,
  crearDesparasitacion,
  crearRecordatorio,
  crearVacuna,
  listarArchivos,
  listarConsultas,
  listarDesparasitaciones,
  listarPacientes,
  listarVacunasPacienteCompletas,
  listarVeterinarios,
  obtenerConsulta,
  obtenerPaciente,
} from "@/lib/chapitas/clinicaOps";
import { crearTratamiento } from "@/lib/chapitas/mascotaPerfil";

export default function HistoriasSection({ clinicaId }) {
  const [consultas, setConsultas] = useState([]);
  const [pacientes, setPacientes] = useState([]);
  const [vets, setVets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [showForm, setShowForm] = useState(false);

  async function reload() {
    setLoading(true);
    setError("");
    try {
      const [c, p, v] = await Promise.all([
        listarConsultas(clinicaId),
        listarPacientes(clinicaId),
        listarVeterinarios(clinicaId),
      ]);
      setConsultas(c);
      setPacientes(p);
      setVets(v);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar las historias.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clinicaId]);

  if (selectedId) {
    return (
      <DetalleConsulta
        clinicaId={clinicaId}
        consultaId={selectedId}
        vets={vets}
        onBack={() => setSelectedId(null)}
        onChanged={async () => {
          await reload();
        }}
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-aguara-ink">Historias clínicas</h2>
          <p className="text-sm text-stone-500">
            Consultas, diagnósticos, vacunas, desparasitaciones y archivos
          </p>
        </div>
        <button type="button" className={primaryBtnClass} onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Cerrar" : "Nueva consulta"}
        </button>
      </div>

      {showForm ? (
        <ConsultaForm
          clinicaId={clinicaId}
          pacientes={pacientes}
          vets={vets}
          onSaved={async () => {
            setShowForm(false);
            await reload();
          }}
          onCancel={() => setShowForm(false)}
        />
      ) : null}

      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      <div className={cardClass}>
        {loading ? (
          <p className="text-sm text-stone-500">Cargando…</p>
        ) : consultas.length === 0 ? (
          <p className="text-sm text-stone-500">Todavía no hay consultas.</p>
        ) : (
          <ul className="divide-y divide-stone-100">
            {consultas.map((c) => (
              <li key={c.id}>
                <div className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-aguara-ink">
                      {c.clinica_pacientes?.nombre || "Paciente"} · {formatDateTime(c.fecha)}
                    </p>
                    <p className="text-sm text-stone-500">
                      {c.motivo || "Consulta"} · {c.clinica_veterinarios?.nombre || "Sin vet"} ·{" "}
                      {c.cerrada ? "Cerrada" : "Abierta"}
                    </p>
                    <p className="mt-0.5 text-xs text-stone-400">
                      Última modificación:{" "}
                      {formatDateTime(c.actualizado_en || c.cerrado_en || c.creado_en || c.fecha)}
                    </p>
                  </div>
                  <button
                    type="button"
                    className={secondaryBtnClass}
                    onClick={() => setSelectedId(c.id)}
                  >
                    Ver
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function ConsultaForm({ clinicaId, pacientes, vets, onSaved, onCancel, initial }) {
  const [form, setForm] = useState({
    paciente_id: initial?.paciente_id || "",
    veterinario_id: initial?.veterinario_id || "",
    motivo: initial?.motivo || "",
    anamnesis: initial?.anamnesis || "",
    examen_fisico: initial?.examen_fisico || "",
    diagnostico: initial?.diagnostico || "",
    tratamiento: initial?.tratamiento || "",
    medicacion: initial?.medicacion || "",
    peso: initial?.peso ?? "",
    temperatura: initial?.temperatura ?? "",
    observaciones: initial?.observaciones || "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const paciente = pacientes.find((p) => p.id === form.paciente_id);
      const payload = {
        ...form,
        cliente_id: paciente?.cliente_id || null,
      };
      if (initial?.id) {
        await actualizarConsulta(
          initial.id,
          {
            motivo: payload.motivo?.trim() || null,
            anamnesis: payload.anamnesis?.trim() || null,
            examen_fisico: payload.examen_fisico?.trim() || null,
            diagnostico: payload.diagnostico?.trim() || null,
            tratamiento: payload.tratamiento?.trim() || null,
            medicacion: payload.medicacion?.trim() || null,
            peso: payload.peso === "" || payload.peso == null ? null : Number(payload.peso),
            temperatura:
              payload.temperatura === "" || payload.temperatura == null
                ? null
                : Number(payload.temperatura),
            observaciones: payload.observaciones?.trim() || null,
            veterinario_id: payload.veterinario_id || null,
          },
          { clinicaId },
        );
      } else {
        await crearConsulta(clinicaId, payload);
      }
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className={`${cardClass} space-y-3`}>
      <h3 className="font-semibold text-aguara-ink">
        {initial?.id ? "Editar historia clínica" : "Nueva consulta / evolución"}
      </h3>
      {initial?.id ? (
        <p className="text-sm text-stone-500">
          Última modificación:{" "}
          {formatDateTime(
            initial.actualizado_en || initial.cerrado_en || initial.creado_en || initial.fecha,
          )}
        </p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Paciente" id="hc-pac">
          <select
            id="hc-pac"
            required
            disabled={Boolean(initial?.id)}
            className={fieldClass}
            value={form.paciente_id}
            onChange={(e) => setForm((f) => ({ ...f, paciente_id: e.target.value }))}
          >
            <option value="">Seleccionar…</option>
            {pacientes.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Veterinario" id="hc-vet">
          <select
            id="hc-vet"
            className={fieldClass}
            value={form.veterinario_id}
            onChange={(e) => setForm((f) => ({ ...f, veterinario_id: e.target.value }))}
          >
            <option value="">Sin asignar</option>
            {vets.map((v) => (
              <option key={v.id} value={v.id}>
                {v.nombre}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Motivo" id="hc-mot" className="sm:col-span-2">
          <input
            id="hc-mot"
            className={fieldClass}
            value={form.motivo}
            onChange={(e) => setForm((f) => ({ ...f, motivo: e.target.value }))}
          />
        </Field>
        <Field label="Anamnesis" id="hc-ana" className="sm:col-span-2">
          <textarea
            id="hc-ana"
            rows={2}
            className={fieldClass}
            value={form.anamnesis}
            onChange={(e) => setForm((f) => ({ ...f, anamnesis: e.target.value }))}
          />
        </Field>
        <Field label="Examen físico" id="hc-ex" className="sm:col-span-2">
          <textarea
            id="hc-ex"
            rows={2}
            className={fieldClass}
            value={form.examen_fisico}
            onChange={(e) => setForm((f) => ({ ...f, examen_fisico: e.target.value }))}
          />
        </Field>
        <Field label="Diagnóstico" id="hc-dx" className="sm:col-span-2">
          <textarea
            id="hc-dx"
            rows={2}
            className={fieldClass}
            value={form.diagnostico}
            onChange={(e) => setForm((f) => ({ ...f, diagnostico: e.target.value }))}
          />
        </Field>
        <Field label="Tratamiento" id="hc-tx">
          <textarea
            id="hc-tx"
            rows={2}
            className={fieldClass}
            value={form.tratamiento}
            onChange={(e) => setForm((f) => ({ ...f, tratamiento: e.target.value }))}
          />
        </Field>
        <Field label="Medicación" id="hc-med">
          <textarea
            id="hc-med"
            rows={2}
            className={fieldClass}
            value={form.medicacion}
            onChange={(e) => setForm((f) => ({ ...f, medicacion: e.target.value }))}
          />
        </Field>
        <Field label="Peso (kg)" id="hc-peso">
          <input
            id="hc-peso"
            type="number"
            step="0.1"
            className={fieldClass}
            value={form.peso}
            onChange={(e) => setForm((f) => ({ ...f, peso: e.target.value }))}
          />
        </Field>
        <Field label="Temperatura (°C)" id="hc-temp">
          <input
            id="hc-temp"
            type="number"
            step="0.1"
            className={fieldClass}
            value={form.temperatura}
            onChange={(e) => setForm((f) => ({ ...f, temperatura: e.target.value }))}
          />
        </Field>
        <Field label="Observaciones" id="hc-obs" className="sm:col-span-2">
          <textarea
            id="hc-obs"
            rows={2}
            className={fieldClass}
            value={form.observaciones}
            onChange={(e) => setForm((f) => ({ ...f, observaciones: e.target.value }))}
          />
        </Field>
      </div>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <div className="flex gap-2">
        <button type="submit" disabled={saving} className={primaryBtnClass}>
          {saving ? "Guardando…" : "Guardar"}
        </button>
        <button type="button" className={secondaryBtnClass} onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

function DetalleConsulta({ clinicaId, consultaId, vets, onBack, onChanged }) {
  const [consulta, setConsulta] = useState(null);
  const [paciente, setPaciente] = useState(null);
  const [editing, setEditing] = useState(false);
  const [pacientes, setPacientes] = useState([]);
  const [vacunas, setVacunas] = useState([]);
  const [desparas, setDesparas] = useState([]);
  const [archivos, setArchivos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [firmaVetId, setFirmaVetId] = useState("");
  const [vacuna, setVacuna] = useState({ nombre: "", fecha: "", proxima_fecha: "", lote: "" });
  const [desp, setDesp] = useState({ producto: "", fecha: "", proxima_fecha: "" });
  const [archivo, setArchivo] = useState({ nombre: "", tipo: "estudio", url: "" });
  const [recordatorio, setRecordatorio] = useState({
    tipo: "medicacion",
    titulo: "",
    detalle: "",
    fecha_proxima: "",
  });
  const [tratamiento, setTratamiento] = useState({
    titulo: "",
    detalle: "",
    fecha_inicio: "",
    fecha_fin: "",
    de_por_vida: false,
  });
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [c, pList] = await Promise.all([
        obtenerConsulta(consultaId),
        listarPacientes(clinicaId),
      ]);
      setConsulta(c);
      setPacientes(pList);
      setFirmaVetId(c.veterinario_id || "");

      if (c.paciente_id) {
        const pac = await obtenerPaciente(c.paciente_id);
        const [vacunasFull, despRows, arch] = await Promise.all([
          listarVacunasPacienteCompletas(pac),
          listarDesparasitaciones(c.paciente_id),
          listarArchivos(c.paciente_id),
        ]);
        setPaciente(pac);
        setVacunas(vacunasFull);
        setDesparas(despRows);
        setArchivos(arch);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar la consulta.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consultaId, clinicaId]);

  if (loading) return <p className="text-sm text-stone-500">Cargando consulta…</p>;
  if (error) return <p className="text-sm text-red-700">{error}</p>;
  if (!consulta) return null;

  if (editing) {
    return (
      <ConsultaForm
        clinicaId={clinicaId}
        pacientes={pacientes}
        vets={vets}
        initial={consulta}
        onCancel={() => setEditing(false)}
        onSaved={async () => {
          setEditing(false);
          await load();
          await onChanged();
        }}
      />
    );
  }

  return (
    <div className="space-y-5">
      <button type="button" className={secondaryBtnClass} onClick={onBack}>
        ← Volver al listado
      </button>

      <div className={cardClass}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-aguara-orange">Vista completa · Historia clínica</p>
            <h2 className="mt-1 text-xl font-semibold text-aguara-ink">
              {consulta.clinica_pacientes?.nombre || paciente?.nombre || "Paciente"}
            </h2>
            <p className="text-sm text-stone-500">
              Fecha de consulta: {formatDateTime(consulta.fecha)}
            </p>
            <p className="text-xs text-stone-400">
              Última modificación:{" "}
              {formatDateTime(
                consulta.actualizado_en || consulta.cerrado_en || consulta.creado_en || consulta.fecha,
              )}
            </p>
          </div>
          <div className="flex gap-2">
            {consulta.clinica_id === clinicaId ? (
              <button type="button" className={secondaryBtnClass} onClick={() => setEditing(true)}>
                Editar historia
              </button>
            ) : (
              <p className="text-xs text-amber-800">
                Historia de otra clínica ({consulta.clinicas?.nombre || "—"}). Solo lectura.
              </p>
            )}
          </div>
        </div>
        {consulta.clinica_id === clinicaId && consulta.cerrada ? (
          <p className="mt-3 text-xs text-amber-800">
            Esta consulta está cerrada/firmada. Podés editar el contenido; la firma original se
            conserva.
          </p>
        ) : null}

        {paciente ? (
          <div className="mt-4 rounded-xl bg-stone-50 px-3 py-3 text-sm">
            <p className="font-medium text-aguara-ink">Datos del paciente</p>
            <p className="mt-1 text-stone-600">
              {paciente.especie}
              {paciente.raza ? ` · ${paciente.raza}` : ""}
              {paciente.sexo ? ` · ${paciente.sexo}` : ""}
              {paciente.peso != null ? ` · ${paciente.peso} kg` : ""}
            </p>
            <p className="text-stone-600">
              Tutor: {paciente.clinica_clientes?.nombre_completo || "—"}
              {paciente.clinica_clientes?.telefono
                ? ` · ${paciente.clinica_clientes.telefono}`
                : ""}
            </p>
            {paciente.alergias ? (
              <p className="mt-1 text-amber-800">Alergias: {paciente.alergias}</p>
            ) : null}
            {paciente.chip || paciente.chapita_codigo || paciente.mascota_chapita_id ? (
              <p className="mt-1 text-stone-500">
                {paciente.chip ? `Chip: ${paciente.chip}` : ""}
                {paciente.mascota_chapita_id || paciente.chapita_codigo
                  ? `${paciente.chip ? " · " : ""}Chapita: ${
                      paciente.mascota_chapita_id || paciente.chapita_codigo
                    }`
                  : ""}
              </p>
            ) : null}
          </div>
        ) : null}

        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <Item label="Estado" value={consulta.cerrada ? "Cerrada" : "Abierta"} />
          <Item label="Motivo" value={consulta.motivo} />
          <Item
            label="Veterinario"
            value={
              consulta.clinica_veterinarios?.nombre
                ? `${consulta.clinica_veterinarios.nombre}${
                    consulta.clinica_veterinarios.matricula
                      ? ` · Mat. ${consulta.clinica_veterinarios.matricula}`
                      : ""
                  }`
                : null
            }
          />
          <Item label="Anamnesis" value={consulta.anamnesis} wide />
          <Item label="Examen físico" value={consulta.examen_fisico} wide />
          <Item label="Diagnóstico" value={consulta.diagnostico} wide />
          <Item label="Tratamiento" value={consulta.tratamiento} />
          <Item label="Medicación" value={consulta.medicacion} />
          <Item label="Peso" value={consulta.peso != null ? `${consulta.peso} kg` : null} />
          <Item
            label="Temperatura"
            value={consulta.temperatura != null ? `${consulta.temperatura} °C` : null}
          />
          <Item label="Observaciones" value={consulta.observaciones} wide />
          <Item label="Creada" value={formatDateTime(consulta.creado_en)} />
          <Item
            label="Última modificación"
            value={formatDateTime(
              consulta.actualizado_en || consulta.cerrado_en || consulta.creado_en || consulta.fecha,
            )}
          />
        </dl>

        <div className="mt-5 grid gap-4 border-t border-stone-100 pt-4 lg:grid-cols-3">
          <div>
            <h3 className="text-sm font-semibold text-aguara-ink">Vacunas del paciente</h3>
            {vacunas.length === 0 ? (
              <p className="mt-2 text-sm text-stone-500">Sin vacunas.</p>
            ) : (
              <ul className="mt-2 space-y-1 text-sm text-stone-700">
                {vacunas.map((v) => (
                  <li key={`${v.origen || "clinica"}-${v.id}`}>
                    <strong>{v.nombre}</strong> · {formatDate(v.fecha)}
                    {v.origen === "tutor" ? " · (tutor)" : ""}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-aguara-ink">Desparasitaciones</h3>
            {desparas.length === 0 ? (
              <p className="mt-2 text-sm text-stone-500">Sin registros.</p>
            ) : (
              <ul className="mt-2 space-y-1 text-sm text-stone-700">
                {desparas.map((d) => (
                  <li key={d.id}>
                    <strong>{d.producto}</strong> · {formatDate(d.fecha)}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-aguara-ink">Archivos</h3>
            {archivos.length === 0 ? (
              <p className="mt-2 text-sm text-stone-500">Sin archivos.</p>
            ) : (
              <ul className="mt-2 space-y-1 text-sm">
                {archivos.map((a) => (
                  <li key={a.id}>
                    <a
                      href={a.url}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-aguara-orange underline"
                    >
                      {a.nombre}
                    </a>{" "}
                    <span className="text-stone-500">({a.tipo})</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        {consulta.cerrada ? (
          <div className="mt-4 rounded-xl bg-emerald-50 px-3 py-3 text-sm text-emerald-900">
            <p>
              Consulta cerrada · Firmado por {consulta.firmado_por || "—"} ·{" "}
              {formatDateTime(consulta.cerrado_en)}
            </p>
            {consulta.firma_imagen ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={consulta.firma_imagen}
                alt="Firma digital"
                className="mt-3 h-16 w-40 rounded border border-emerald-200 bg-white object-contain"
              />
            ) : null}
          </div>
        ) : consulta.clinica_id === clinicaId ? (
          <div className="mt-5 space-y-3 border-t border-stone-100 pt-4">
            <Field label="Veterinario que firma" id="hc-firma-vet">
              <select
                id="hc-firma-vet"
                className={fieldClass}
                value={firmaVetId}
                onChange={(e) => setFirmaVetId(e.target.value)}
              >
                <option value="">Seleccionar veterinario…</option>
                {vets.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.nombre}
                    {v.matricula ? ` · Mat. ${v.matricula}` : ""}
                  </option>
                ))}
              </select>
            </Field>
            {firmaVetId ? (
              (() => {
                const vet = vets.find((v) => v.id === firmaVetId);
                if (!vet?.firma_digital) {
                  return (
                    <p className="text-sm text-amber-800">
                      Ese veterinario no tiene firma digital. Registrate en Configuración →
                      Veterinarios.
                    </p>
                  );
                }
                return (
                  <div className="flex flex-wrap items-end gap-4">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={vet.firma_digital}
                      alt={`Firma de ${vet.nombre}`}
                      className="h-16 w-40 rounded border border-stone-200 bg-white object-contain"
                    />
                    <button
                      type="button"
                      disabled={busy}
                      className={primaryBtnClass}
                      onClick={async () => {
                        setBusy(true);
                        try {
                          const firmadoPor = `${vet.nombre}${
                            vet.matricula ? ` · Mat. ${vet.matricula}` : ""
                          }`;
                          await cerrarConsulta(consulta.id, {
                            firmadoPor,
                            firmaImagen: vet.firma_digital,
                            clinicaId,
                          });
                          await load();
                          await onChanged();
                        } catch (err) {
                          setError(err instanceof Error ? err.message : "No se pudo cerrar.");
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      Cerrar / firmar consulta
                    </button>
                  </div>
                );
              })()
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
        <form
          className={`${cardClass} space-y-2`}
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              await crearVacuna(clinicaId, {
                paciente_id: consulta.paciente_id,
                ...vacuna,
              });
              setVacuna({ nombre: "", fecha: "", proxima_fecha: "", lote: "" });
              await onChanged();
            } catch (err) {
              setError(err instanceof Error ? err.message : "Error vacuna.");
            } finally {
              setBusy(false);
            }
          }}
        >
          <h3 className="font-semibold text-aguara-ink">Vacuna</h3>
          <input
            required
            placeholder="Nombre"
            className={fieldClass}
            value={vacuna.nombre}
            onChange={(e) => setVacuna((v) => ({ ...v, nombre: e.target.value }))}
          />
          <input
            type="date"
            className={fieldClass}
            value={vacuna.fecha}
            onChange={(e) => setVacuna((v) => ({ ...v, fecha: e.target.value }))}
          />
          <input
            type="date"
            className={fieldClass}
            value={vacuna.proxima_fecha}
            onChange={(e) => setVacuna((v) => ({ ...v, proxima_fecha: e.target.value }))}
            title="Próxima"
          />
          <input
            placeholder="Lote"
            className={fieldClass}
            value={vacuna.lote}
            onChange={(e) => setVacuna((v) => ({ ...v, lote: e.target.value }))}
          />
          <button type="submit" className={primaryBtnClass} disabled={busy}>
            Agregar vacuna
          </button>
        </form>

        <form
          className={`${cardClass} space-y-2`}
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              await crearDesparasitacion(clinicaId, {
                paciente_id: consulta.paciente_id,
                ...desp,
              });
              setDesp({ producto: "", fecha: "", proxima_fecha: "" });
              await onChanged();
            } catch (err) {
              setError(err instanceof Error ? err.message : "Error desparasitación.");
            } finally {
              setBusy(false);
            }
          }}
        >
          <h3 className="font-semibold text-aguara-ink">Desparasitación</h3>
          <input
            required
            placeholder="Producto"
            className={fieldClass}
            value={desp.producto}
            onChange={(e) => setDesp((v) => ({ ...v, producto: e.target.value }))}
          />
          <input
            type="date"
            className={fieldClass}
            value={desp.fecha}
            onChange={(e) => setDesp((v) => ({ ...v, fecha: e.target.value }))}
          />
          <input
            type="date"
            className={fieldClass}
            value={desp.proxima_fecha}
            onChange={(e) => setDesp((v) => ({ ...v, proxima_fecha: e.target.value }))}
          />
          <button type="submit" className={primaryBtnClass} disabled={busy}>
            Agregar
          </button>
        </form>

        <form
          className={`${cardClass} space-y-2`}
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              await crearArchivo(clinicaId, {
                paciente_id: consulta.paciente_id,
                consulta_id: consulta.id,
                ...archivo,
              });
              setArchivo({ nombre: "", tipo: "estudio", url: "" });
              await onChanged();
            } catch (err) {
              setError(err instanceof Error ? err.message : "Error archivo.");
            } finally {
              setBusy(false);
            }
          }}
        >
          <h3 className="font-semibold text-aguara-ink">Archivo</h3>
          <input
            required
            placeholder="Nombre"
            className={fieldClass}
            value={archivo.nombre}
            onChange={(e) => setArchivo((v) => ({ ...v, nombre: e.target.value }))}
          />
          <select
            className={fieldClass}
            value={archivo.tipo}
            onChange={(e) => setArchivo((v) => ({ ...v, tipo: e.target.value }))}
          >
            <option value="estudio">Estudio</option>
            <option value="foto">Foto</option>
            <option value="lab">Laboratorio</option>
            <option value="otro">Otro</option>
          </select>
          <input
            required
            type="url"
            placeholder="URL del archivo"
            className={fieldClass}
            value={archivo.url}
            onChange={(e) => setArchivo((v) => ({ ...v, url: e.target.value }))}
          />
          <button type="submit" className={primaryBtnClass} disabled={busy}>
            Adjuntar
          </button>
          <p className="text-xs text-stone-400">Pegá un link (Drive, Dropbox, Storage, etc.).</p>
        </form>

        <form
          className={`${cardClass} space-y-2`}
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              await crearRecordatorio(clinicaId, {
                paciente_id: consulta.paciente_id,
                cliente_id: consulta.cliente_id,
                ...recordatorio,
              });
              setRecordatorio({
                tipo: "medicacion",
                titulo: "",
                detalle: "",
                fecha_proxima: "",
              });
              await onChanged();
            } catch (err) {
              setError(err instanceof Error ? err.message : "Error recordatorio.");
            } finally {
              setBusy(false);
            }
          }}
        >
          <h3 className="font-semibold text-aguara-ink">Recordatorio tutor</h3>
          <select
            className={fieldClass}
            value={recordatorio.tipo}
            onChange={(e) => setRecordatorio((v) => ({ ...v, tipo: e.target.value }))}
          >
            <option value="medicacion">Medicación</option>
            <option value="control">Control</option>
            <option value="vacuna">Vacuna</option>
            <option value="otro">Otro</option>
          </select>
          <input
            required
            placeholder="Título"
            className={fieldClass}
            value={recordatorio.titulo}
            onChange={(e) => setRecordatorio((v) => ({ ...v, titulo: e.target.value }))}
          />
          <input
            placeholder="Detalle / dosis"
            className={fieldClass}
            value={recordatorio.detalle}
            onChange={(e) => setRecordatorio((v) => ({ ...v, detalle: e.target.value }))}
          />
          <input
            type="date"
            className={fieldClass}
            value={recordatorio.fecha_proxima}
            onChange={(e) => setRecordatorio((v) => ({ ...v, fecha_proxima: e.target.value }))}
          />
          <button type="submit" className={primaryBtnClass} disabled={busy}>
            Cargar para el tutor
          </button>
        </form>

        <form
          className={`${cardClass} space-y-2`}
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              await crearTratamiento(clinicaId, {
                paciente_id: consulta.paciente_id,
                ...tratamiento,
              });
              setTratamiento({
                titulo: "",
                detalle: "",
                fecha_inicio: "",
                fecha_fin: "",
                de_por_vida: false,
              });
              await onChanged();
            } catch (err) {
              setError(err instanceof Error ? err.message : "Error tratamiento.");
            } finally {
              setBusy(false);
            }
          }}
        >
          <h3 className="font-semibold text-aguara-ink">Tratamiento activo</h3>
          <input
            required
            placeholder="Nombre del tratamiento"
            className={fieldClass}
            value={tratamiento.titulo}
            onChange={(e) => setTratamiento((v) => ({ ...v, titulo: e.target.value }))}
          />
          <input
            placeholder="Detalle / indicaciones"
            className={fieldClass}
            value={tratamiento.detalle}
            onChange={(e) => setTratamiento((v) => ({ ...v, detalle: e.target.value }))}
          />
          <input
            type="date"
            className={fieldClass}
            value={tratamiento.fecha_inicio}
            onChange={(e) => setTratamiento((v) => ({ ...v, fecha_inicio: e.target.value }))}
            title="Inicio"
          />
          <label className="flex items-center gap-2 text-sm text-stone-700">
            <input
              type="checkbox"
              checked={tratamiento.de_por_vida}
              onChange={(e) =>
                setTratamiento((v) => ({
                  ...v,
                  de_por_vida: e.target.checked,
                  fecha_fin: e.target.checked ? "" : v.fecha_fin,
                }))
              }
            />
            De por vida
          </label>
          {!tratamiento.de_por_vida ? (
            <input
              type="date"
              className={fieldClass}
              value={tratamiento.fecha_fin}
              onChange={(e) => setTratamiento((v) => ({ ...v, fecha_fin: e.target.value }))}
              title="Fecha de finalización"
            />
          ) : null}
          <button type="submit" className={primaryBtnClass} disabled={busy}>
            Guardar tratamiento
          </button>
        </form>
      </div>
    </div>
  );
}

function Item({ label, value, wide }) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <dt className="text-stone-500">{label}</dt>
      <dd className="mt-0.5 text-aguara-ink">{value || "—"}</dd>
    </div>
  );
}
