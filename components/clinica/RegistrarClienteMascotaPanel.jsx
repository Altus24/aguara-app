"use client";

import { useMemo, useState } from "react";

import {
  Field,
  fieldClass,
  secondaryBtnClass,
} from "@/components/clinica/ui";
import MascotaRegistroFields, {
  emptyPetFormConCabecera,
  validateMascotaRegistroForm,
} from "@/components/mascotas/MascotaRegistroFields";
import { crearCliente, crearPaciente } from "@/lib/chapitas/clinicaOps";
import { readClinicSession } from "@/lib/chapitas/clinicSession";
import { confirmGuardar } from "@/lib/confirmAction";

const emptyOwner = {
  nombre_completo: "",
  email: "",
  telefono: "",
  telefono_secundario: "",
  direccion: "",
};

/**
 * Alta rápida de cliente (tutor Aguará) + mascota desde agenda / historias.
 * La contraseña del portal tutor es el email (regla actual de TutorAuth).
 */
export default function RegistrarClienteMascotaPanel({
  clinicaId,
  fotoInputId = "reg-cliente-mascota",
  onCancel,
  onCreated,
}) {
  const [owner, setOwner] = useState(emptyOwner);
  const [petForm, setPetForm] = useState(() => emptyPetFormConCabecera(clinicaId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const clinicasCabecera = useMemo(() => {
    const session = readClinicSession();
    if (session?.id === clinicaId) {
      return [{ id: session.id, nombre: session.nombre, ciudad: session.ciudad }];
    }
    return clinicaId ? [{ id: clinicaId, nombre: "Esta clínica" }] : [];
  }, [clinicaId]);

  function updateOwner(key) {
    return (event) => setOwner((prev) => ({ ...prev, [key]: event.target.value }));
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
    const invalidPet = validateMascotaRegistroForm(petForm);
    if (invalidPet) {
      setError(invalidPet);
      return;
    }

    if (
      !(await confirmGuardar(
        `el cliente “${nombre}” y la mascota “${petForm.nombre_mascota.trim()}”`,
      ))
    ) {
      return;
    }

    setSaving(true);
    try {
      const cliente = await crearCliente(clinicaId, {
        nombre_completo: nombre,
        email,
        telefono,
        telefono_secundario: owner.telefono_secundario.trim() || null,
        direccion: owner.direccion.trim() || null,
      });
      const paciente = await crearPaciente(clinicaId, {
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
        <Field label="Dirección" id={`${fotoInputId}-dir`} className="sm:col-span-2">
          <input
            id={`${fotoInputId}-dir`}
            className={fieldClass}
            value={owner.direccion}
            onChange={updateOwner("direccion")}
          />
        </Field>
      </div>

      <div className="border-t border-aguara-orange/15 pt-3">
        <p className="mb-2 text-sm font-medium text-aguara-ink">Mascota</p>
        <MascotaRegistroFields
          form={petForm}
          onChange={(name, value) => setPetForm((f) => ({ ...f, [name]: value }))}
          fieldClass={fieldClass}
          fotoInputId={fotoInputId}
          showTitle={false}
          clinicas={clinicasCabecera}
        />
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
