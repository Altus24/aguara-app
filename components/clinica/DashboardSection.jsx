"use client";

import { useEffect, useState } from "react";

import { cardClass, EstadoBadge, formatTime, primaryBtnClass } from "@/components/clinica/ui";
import {
  alertasProximas,
  etiquetaEstado,
  ingresosHoy,
  listarCitasHoy,
  listarCitasPendientes,
  listarEspera,
  money,
} from "@/lib/chapitas/clinicaOps";
import { listarHorarios as listarHorariosClinica, listarProductos as listarStock } from "@/lib/chapitas/clinicas";

export default function DashboardSection({ clinicaId, onNavigate }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [citas, setCitas] = useState([]);
  const [espera, setEspera] = useState([]);
  const [pendientes, setPendientes] = useState([]);
  const [ingresos, setIngresos] = useState(0);
  const [alertas, setAlertas] = useState({ vacunas: [], desparasitaciones: [] });
  const [stockBajo, setStockBajo] = useState([]);
  const [slotsHoy, setSlotsHoy] = useState(0);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [citasHoy, esperaRows, pend, ingreso, alerts, productos, horarios] = await Promise.all([
        listarCitasHoy(clinicaId),
        listarEspera(clinicaId),
        listarCitasPendientes(clinicaId),
        ingresosHoy(clinicaId),
        alertasProximas(clinicaId),
        listarStock(clinicaId),
        listarHorariosClinica(clinicaId),
      ]);
      setCitas(citasHoy);
      setEspera(esperaRows.filter((c) => c.estado === "en_espera" || c.estado === "lista_espera"));
      setPendientes(pend);
      setIngresos(ingreso);
      setAlertas(alerts);
      setStockBajo(productos.filter((p) => Number(p.stock) <= 3));
      const dia = new Date().getDay();
      setSlotsHoy(horarios.filter((h) => Number(h.dia_semana) === dia && h.activo !== false).length);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar el dashboard.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clinicaId]);

  const activas = citas.filter((c) =>
    ["confirmada", "en_espera", "en_atencion"].includes(c.estado),
  );
  const finalizadas = citas.filter((c) => c.estado === "finalizada").length;
  const ocupacion =
    citas.length === 0 ? 0 : Math.round((finalizadas / Math.max(citas.length, 1)) * 100);

  if (loading) {
    return <p className="text-sm text-stone-500">Cargando dashboard…</p>;
  }

  return (
    <div className="space-y-6">
      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      {pendientes.length > 0 ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-amber-950">
                {pendientes.length} turno{pendientes.length === 1 ? "" : "s"} pendiente
                {pendientes.length === 1 ? "" : "s"} de tutores
              </p>
              <p className="text-sm text-amber-900/80">Confirmalos desde la agenda.</p>
            </div>
            <button type="button" className={primaryBtnClass} onClick={() => onNavigate("agenda")}>
              Revisar
            </button>
          </div>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat title="Citas del día" value={String(citas.length)} hint={`${activas.length} activas`} />
        <Stat title="Pendientes" value={String(pendientes.length)} hint="Por confirmar" />
        <Stat title="En espera" value={String(espera.length)} hint="Sala / lista" />
        <Stat title="Ingresos hoy" value={money(ingresos)} hint={`${slotsHoy} franjas hoy`} />
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" className={primaryBtnClass} onClick={() => onNavigate("agenda")}>
          Nueva cita
        </button>
        <button type="button" className={primaryBtnClass} onClick={() => onNavigate("historias")}>
          Nueva consulta
        </button>
        <button type="button" className={primaryBtnClass} onClick={() => onNavigate("pacientes")}>
          Nuevo paciente
        </button>
        <button type="button" className={primaryBtnClass} onClick={() => onNavigate("clientes")}>
          Registrar pago
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className={cardClass}>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-aguara-ink">Citas de hoy</h2>
            <button
              type="button"
              className="text-sm font-medium text-aguara-orange"
              onClick={() => onNavigate("agenda")}
            >
              Ver agenda
            </button>
          </div>
          {citas.length === 0 ? (
            <p className="mt-4 text-sm text-stone-500">No hay citas para hoy.</p>
          ) : (
            <ul className="mt-4 divide-y divide-stone-100">
              {citas.slice(0, 8).map((cita) => (
                <li key={cita.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-aguara-ink">
                      {cita.clinica_pacientes?.nombre || "Sin paciente"}
                    </p>
                    <p className="text-sm text-stone-500">
                      {formatTime(cita.inicio)} · {cita.clinica_veterinarios?.nombre || "Sin vet"}
                    </p>
                  </div>
                  <EstadoBadge estado={cita.estado} label={etiquetaEstado(cita.estado)} />
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className={cardClass}>
          <h2 className="text-lg font-semibold text-aguara-ink">Pacientes en espera</h2>
          {espera.length === 0 ? (
            <p className="mt-4 text-sm text-stone-500">Nadie en espera ahora.</p>
          ) : (
            <ul className="mt-4 divide-y divide-stone-100">
              {espera.map((cita) => (
                <li key={cita.id} className="flex items-center justify-between gap-3 py-3">
                  <div>
                    <p className="font-medium text-aguara-ink">
                      {cita.clinica_pacientes?.nombre || "Sin paciente"}
                    </p>
                    <p className="text-sm text-stone-500">
                      {cita.clinica_clientes?.nombre_completo || "—"} ·{" "}
                      {etiquetaEstado(cita.estado)}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="text-sm text-aguara-orange underline"
                    onClick={() => onNavigate("agenda")}
                  >
                    Gestionar
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className={cardClass}>
          <h2 className="text-lg font-semibold text-aguara-ink">Alertas</h2>
          <div className="mt-4 space-y-3">
            {alertas.vacunas.length === 0 &&
            alertas.desparasitaciones.length === 0 &&
            stockBajo.length === 0 ? (
              <p className="text-sm text-stone-500">Sin alertas próximas.</p>
            ) : null}
            {alertas.vacunas.map((v) => (
              <p key={v.id} className="text-sm text-stone-700">
                Vacuna <strong>{v.nombre}</strong> de {v.clinica_pacientes?.nombre} · próximo{" "}
                {v.proxima_fecha}
              </p>
            ))}
            {alertas.desparasitaciones.map((d) => (
              <p key={d.id} className="text-sm text-stone-700">
                Desparasitación <strong>{d.producto}</strong> de {d.clinica_pacientes?.nombre} ·
                próximo {d.proxima_fecha}
              </p>
            ))}
            {stockBajo.map((p) => (
              <p key={p.id} className="text-sm text-amber-800">
                Stock bajo: <strong>{p.nombre}</strong> ({p.stock} {p.unidad})
              </p>
            ))}
          </div>
        </div>

        <div className={cardClass}>
          <h2 className="text-lg font-semibold text-aguara-ink">Ingresos rápidos</h2>
          <p className="mt-3 text-3xl font-semibold text-aguara-ink">{money(ingresos)}</p>
          <p className="mt-1 text-sm text-stone-500">Total cobrado hoy</p>
          <button
            type="button"
            className={`${primaryBtnClass} mt-5`}
            onClick={() => onNavigate("clientes")}
          >
            Cargar cobro
          </button>
        </div>
      </div>
    </div>
  );
}

function Stat({ title, value, hint }) {
  return (
    <div className={cardClass}>
      <p className="text-sm text-stone-500">{title}</p>
      <p className="mt-2 text-2xl font-semibold text-aguara-ink">{value}</p>
      <p className="mt-1 text-xs text-stone-400">{hint}</p>
    </div>
  );
}
