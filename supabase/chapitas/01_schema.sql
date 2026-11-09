-- Ejecutar en Supabase > SQL Editor
-- Tabla de chapitas / mascotas

CREATE TABLE IF NOT EXISTS mascotas (
  id TEXT PRIMARY KEY CHECK (id ~ '^(0[0-9]{2}|100)$'),
  nombre_mascota TEXT NOT NULL,
  especie TEXT NOT NULL,
  raza TEXT,
  nombre_dueno TEXT NOT NULL,
  telefono_contacto TEXT NOT NULL,
  observaciones_medicas TEXT,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE mascotas ENABLE ROW LEVEL SECURITY;

-- Lectura pública (quien escanea el QR puede ver la ficha)
CREATE POLICY "mascotas_select_public"
  ON mascotas
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Activación: solo ids válidos 001-100 (PK impide duplicados)
CREATE POLICY "mascotas_insert_activation"
  ON mascotas
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (id ~ '^(0[0-9]{2}|100)$');

-- Sin UPDATE/DELETE desde el frontend (admin usa dashboard Supabase con service role)
