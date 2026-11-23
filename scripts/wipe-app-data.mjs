/**
 * Vaciado de datos vía API. Requiere SUPABASE_SERVICE_ROLE_KEY en .env.local
 * (la anon key no puede borrar por RLS).
 *
 * Alternativa recomendada: ejecutar supabase/chapitas/41_wipe_datos_app.sql
 * en el SQL Editor de Supabase.
 *
 * Uso: node scripts/wipe-app-data.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvLocal() {
  const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
  const env = {};
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const i = trimmed.indexOf("=");
    if (i <= 0) continue;
    let value = trimmed.slice(i + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[trimmed.slice(0, i).trim()] = value;
  }
  return env;
}

const env = loadEnvLocal();
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error(
    "Falta SUPABASE_SERVICE_ROLE_KEY en .env.local.\n" +
      "Sin service role la anon key no puede borrar (RLS).\n" +
      "Ejecutá supabase/chapitas/41_wipe_datos_app.sql en el SQL Editor de Supabase.",
  );
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function wipe(table) {
  const { error } = await supabase.from(table).delete().not("id", "is", null);
  if (!error) {
    console.log(`  ok   ${table}`);
    return;
  }
  const msg = error.message || "";
  if (/schema cache|does not exist|Could not find the table/i.test(msg)) {
    console.log(`  skip ${table} (no existe)`);
    return;
  }
  console.log(`  fail ${table}: ${msg}`);
}

const ORDER = [
  "chapita_escaneos",
  "tutor_notificaciones",
  "tutor_perfil_solicitudes",
  "tutor_vacunas",
  "tutor_tratamientos",
  "tutor_recordatorios",
  "tutor_compartir_clinica",
  "clinica_notificaciones",
  "clinica_archivos",
  "clinica_pagos",
  "clinica_vacunas",
  "clinica_desparasitaciones",
  "clinica_tratamientos",
  "clinica_consultas",
  "clinica_citas",
  "clinica_recordatorios",
  "clinica_veterinario_servicios",
  "clinica_pacientes",
  "clinica_clientes",
  "clinica_veterinarios",
  "clinica_servicios",
  "clinica_horarios",
  "clinica_productos",
  "mascotas",
  "chapitas",
  "clinicas",
  "tutores",
  "patients",
  "owners",
];

console.log("Limpiando FKs…");
await supabase
  .from("mascotas")
  .update({ tutor_id: null, clinica_cabecera_id: null })
  .not("id", "is", null);
await supabase.from("tutores").update({ clinica_preferida_id: null }).not("id", "is", null);

console.log("Borrando tablas…");
for (const table of ORDER) await wipe(table);

console.log("Reset inventario…");
{
  const { error } = await supabase.from("chapita_inventario").upsert({
    id: 1,
    max_id_numerico: 100,
    tirada_actual: 1,
  });
  if (error) console.log(`  fail chapita_inventario: ${error.message}`);
  else console.log("  ok   chapita_inventario → tirada 1");
}

console.log("Storage…");
{
  const { data: files, error } = await supabase.storage.from("mascotas-fotos").list("", {
    limit: 1000,
  });
  if (error) console.log(`  skip storage: ${error.message}`);
  else if (!files?.length) console.log("  ok   storage vacío");
  else {
    const paths = [];
    for (const f of files) {
      if (f.id) paths.push(f.name);
      else {
        const { data: nested } = await supabase.storage.from("mascotas-fotos").list(f.name, {
          limit: 1000,
        });
        for (const n of nested || []) paths.push(`${f.name}/${n.name}`);
      }
    }
    if (paths.length) {
      const { error: delErr } = await supabase.storage.from("mascotas-fotos").remove(paths);
      if (delErr) console.log(`  fail storage: ${delErr.message}`);
      else console.log(`  ok   storage (${paths.length})`);
    }
  }
}

console.log("\nListo.");
