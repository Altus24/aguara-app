"use client";

import { useEffect, useState } from "react";

import useClinicaCabeceraOptions from "@/components/clinica/useClinicaCabeceraOptions";
import {
  Field,
  fieldClass,
  secondaryBtnClass,
} from "@/components/clinica/ui";
import MascotaRegistroFields, {
  emptyPetFormConCabecera,
  validateMascotaRegistroForm,
} from "@/components/mascotas/MascotaRegistroFields";
import {
  asociarMascotaExistenteACliente,
  buscarMascotaPorIdentificador,
  crearCliente,
  crearPaciente,
  listarPacientes,
} from "@/lib/chapitas/clinicaOps";
import { confirmGuardar } from "@/lib/confirmAction";

const emptyOwner = {
  nombre_completo: "",
  email: "",
  telefono: "",
  telefono_secundario: "",
  direccion: "",
  dni: "",
};

/**
 * Alta rápida de cliente (tutor Aguará) + mascota (nueva o existente).
 * La contraseña del portal tutor es el email (regla actual de TutorAuth).
 */
export default function RegistrarClienteMascotaPanel({
  clinicaId,
  clinicaNombre,
  fotoInputId = "reg-cliente-mascota",
  onCancel,
  onCreated,
}) {
  const [owner, setOwner] = useState(emptyOwner);
  const [mascotaModo, setMascotaModo] = useState("crear"); // crear | asociar
  const [petForm, setPetForm] = useState(() => emptyPetFormConCabecera(clinicaId));
  const [codigoIdentificador, setCodigoIdentificador] = useState("");
  const [mascotaPreview, setMascotaPreview] = useState(null);
  const [pacienteExistenteId, setPacienteExistenteId] = useState("");
  const [pacientesClinica, setPacientesClinica] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const clinicasCabecera = useClinicaCabeceraOptions(clinicaId);

  useEffect(() => {
    setPetForm((f) =>
      f.clinica_cabecera_id === clinicaId ? f : { ...f, clinica_cabecera_id: clinicaId || "" },
    );
  }, [clinicaId]);

  useEffect(() => {
    if (mascotaModo !== "asociar") return;
    let cancelled = false;
    (async () => {
      try {
        const rows = await listarPacientes(clinicaId);
        if (!cancelled) setPacientesClinica(rows || []);
      } catch {
        if (!cancelled) setPacientesClinica([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mascotaModo, clinicaId]);

  function updateOwner(key) {
    return (event) => setOwner((prev) => ({ ...prev, [key]: event.target.value }));
  }

  async function handleBuscarIdentificador() {
    setError("");
    setMascotaPreview(null);
    setPacienteExistenteId("");
    if (!codigoIdentificador.trim()) {
      setError("Ingresá el código del identificador.");
      return;
    }
    setBuscando(true);
    try {
      const m = await buscarMascotaPorIdentificador(codigoIdentificador);
      if (!m) throw new Error("No se encontró una mascota con ese identificador.");
      setMascotaPreview(m);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo buscar la mascota.");
    } finally {
      setBuscando(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    event.stopPropagation();
    setError("");

    const nombre = owner.nombre_completo.trim();
    const email = owner.email.trim().toLowerCase();
    const telefono = owner.telefono.trim();
    if (nombre.length < 2) {
      setError("Ingresá el nombre del cliente.");
      return;
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Ingresá un email válido. Será el acceso del tutor (contraseña = email).");
      return;
    }
    if (telefono.replace(/\D/g, "").length < 6) {
      setError("Ingresá un teléfono válido.");
      return;
    }

    if (mascotaModo === "crear") {
      const invalidPet = validateMascotaRegistroForm(petForm);
      if (invalidPet) {
        setError(invalidPet);
        return;
      }
    } else if (
      !pacienteExistenteId &&
      !mascotaPreview?.id &&
      !codigoIdentificador.trim()
    ) {
      setError("Buscá un identificador o elegí una mascota ya cargada en la clínica.");
      return;
    }

    const confirmMsg =
      mascotaModo === "crear"
        ? `el cliente “${nombre}” y la mascota “${petForm.nombre_mascota.trim()}”`
        : `el cliente “${nombre}” y la asociación de mascota`;
    if (!(await confirmGuardar(confirmMsg))) return;

    setSaving(true);
    try {
      const cliente = await crearCliente(clinicaId, {
        nombre_completo: nombre,
        email,
        telefono,
        telefono_secundario: owner.telefono_secundario.trim() || null,
        direccion: owner.direccion.trim() || null,
        dni: owner.dni.trim() || null,
      });

      let paciente = null;
      if (mascotaModo === "crear") {
        paciente = await crearPaciente(clinicaId, {
          cliente_id: cliente.id,
          nombre: petForm.nombre_mascota,
          especie: petForm.especie,
          raza: petForm.raza,
          sexo: petForm.sexo,
          castrado: petForm.castrado,
          temperamento: petForm.temperamento,
          fecha_nacimiento: petForm.fecha_nacimiento,
          peso: petForm.peso,
          nro_chip: petForm.nro_chip,
          enfermedad: petForm.enfermedad,
          medicacion: petForm.medicacion,
          datos_adicionales: petForm.datos_adicionales,
          clinica_cabecera_id: petForm.clinica_cabecera_id || clinicaId,
          clinica_ref_nombre: petForm.clinica_ref_nombre,
          clinica_ref_direccion: petForm.clinica_ref_direccion,
          clinica_ref_telefono: petForm.clinica_ref_telefono,
        });
      } else {
        paciente = await asociarMascotaExistenteACliente(clinicaId, cliente.id, {
          pacienteId: pacienteExistenteId || null,
          codigo: pacienteExistenteId ? null : mascotaPreview?.id || codigoIdentificador,
        });
      }
      onCreated?.({ cliente, paciente });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo registrar el cliente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="sm:col-span-2 space-y-3 rounded-xl border border-aguara-orange/25 bg-aguara-cream/30 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-aguara-ink">Registrar cliente y mascota</p>
          <p className="mt-1 text-xs text-stone-600">
            Se crea el cliente de la clínica y el tutor Aguará. Por ahora la contraseña del portal
            tutor es el mismo email.
          </p>
        </div>
        {onCancel ? (
          <button
            type="button"
            className="text-sm font-medium text-aguara-orange hover:underline"
            onClick={onCancel}
          >
            Cancelar
          </button>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nombre completo *" id={`${fotoInputId}-dueno`}>
          <input
            id={`${fotoInputId}-dueno`}
            required
            className={fieldClass}
            value={owner.nombre_completo}
            onChange={updateOwner("nombre_completo")}
          />
        </Field>
        <Field label="Teléfono *" id={`${fotoInputId}-tel`}>
          <input
            id={`${fotoInputId}-tel`}
            type="tel"
            required
            className={fieldClass}
            value={owner.telefono}
            onChange={updateOwner("telefono")}
          />
        </Field>
        <Field label="Email *" id={`${fotoInputId}-email`}>
          <input
            id={`${fotoInputId}-email`}
            type="email"
            required
            className={fieldClass}
            value={owner.email}
            onChange={updateOwner("email")}
          />
        </Field>
        <Field label="Tel. secundario" id={`${fotoInputId}-tel2`}>
          <input
            id={`${fotoInputId}-tel2`}
            type="tel"
            className={fieldClass}
            value={owner.telefono_secundario}
            onChange={updateOwner("telefono_secundario")}
          />
        </Field>
        <Field label="DNI" id={`${fotoInputId}-dni`}>
          <input
            id={`${fotoInputId}-dni`}
            inputMode="numeric"
            autoComplete="off"
            className={fieldClass}
            value={owner.dni}
            onChange={updateOwner("dni")}
          />
        </Field>
        <Field label="Dirección" id={`${fotoInputId}-dir`} className="sm:col-span-2">
          <input
            id={`${fotoInputId}-dir`}
            className={fieldClass}
            value={owner.direccion}
            onChange={updateOwner("direccion")}
          />
        </Field>
      </div>

      <div className="border-t border-aguara-orange/15 pt-3 space-y-3">
        <p className="text-sm font-medium text-aguara-ink">Mascota</p>
        <div className="flex flex-wrap gap-2">
          {[
            { id: "crear", label: "Crear mascota nueva" },
            { id: "asociar", label: "Asociar existente" },
          ].map((opt) => (
            <button
              key={opt.id}
              type="button"
              className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                mascotaModo === opt.id
                  ? "border-aguara-orange bg-white text-aguara-ink"
                  : "border-stone-200 bg-white/70 text-stone-600 hover:border-stone-300"
              }`}
              onClick={() => {
                setMascotaModo(opt.id);
                setError("");
                setMascotaPreview(null);
                setPacienteExistenteId("");
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {mascotaModo === "crear" ? (
          <MascotaRegistroFields
            form={petForm}
            onChange={(name, value) => setPetForm((f) => ({ ...f, [name]: value }))}
            fieldClass={fieldClass}
            fotoInputId={fotoInputId}
            showTitle={false}
            clinicas={clinicasCabecera}
          />
        ) : (
          <div className="space-y-3 rounded-xl border border-stone-200 bg-white/70 p-3">
            <Field label="Código de identificador Aguará" id={`${fotoInputId}-codigo`}>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  id={`${fotoInputId}-codigo`}
                  className={fieldClass}
                  placeholder="Ej. T1-001 o DIG-…"
                  value={codigoIdentificador}
                  onChange={(e) => {
                    setCodigoIdentificador(e.target.value);
                    setMascotaPreview(null);
                  }}
                />
                <button
                  type="button"
                  className={secondaryBtnClass}
                  disabled={buscando}
                  onClick={handleBuscarIdentificador}
                >
                  {buscando ? "Buscando…" : "Buscar"}
                </button>
              </div>
            </Field>
            {mascotaPreview ? (
              <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                Encontrada: <strong>{mascotaPreview.nombre_mascota}</strong>
                {mascotaPreview.especie ? ` · ${mascotaPreview.especie}` : ""}
                <span className="mt-0.5 block text-xs">ID {mascotaPreview.id}</span>
              </p>
            ) : null}
            <Field label="O mascota ya cargada en esta clínica" id={`${fotoInputId}-pac`}>
              <select
                id={`${fotoInputId}-pac`}
                className={fieldClass}
                value={pacienteExistenteId}
                onChange={(e) => {
                  setPacienteExistenteId(e.target.value);
                  if (e.target.value) {
                    setMascotaPreview(null);
                    setCodigoIdentificador("");
                  }
                }}
              >
                <option value="">— Ninguna —</option>
                {pacientesClinica.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                    {p.especie ? ` · ${p.especie}` : ""}
                    {p.clinica_clientes?.nombre_completo
                      ? ` (dueño: ${p.clinica_clientes.nombre_completo})`
                      : ""}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        )}
      </div>

      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        disabled={saving}
        className={secondaryBtnClass}
        onClick={handleSubmit}
      >
        {saving ? "Registrando…" : "Guardar cliente y mascota"}
      </button>
    </div>
  );
}
