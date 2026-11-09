-- Guardar SVG del QR al activar la chapita (descarga desde superadmin)

ALTER TABLE mascotas
  ADD COLUMN IF NOT EXISTS qr_svg TEXT;
