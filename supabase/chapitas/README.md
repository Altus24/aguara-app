# SQL Chapitas (mismo proyecto Supabase)

Este es el SQL del módulo de chapitas QR. Como Aguará App usa **el mismo proyecto** que la app Vite (`veterinaria-domicilio-mza`), en la mayoría de los casos **ya está aplicado**.

Solo re-ejecutá algo si falta una migración puntual. Orden original:

1. `01_schema.sql`
2. `02_admin_qr.sql`
3. `03_qr_public.sql`
4. `04_mascotas_qr_svg.sql`
5. `05_chapita_tirada.sql`
6. `06_chapita_numeros.sql`
7. `07_mascotas_ficha_extendida.sql` ← campos de tutor/animal + bucket de fotos

No corras `01` a ciegas si las tablas `mascotas` / `chapitas` / `admin_users` ya existen.
En proyectos ya en uso, ejecutá al menos el `07` para habilitar el formulario ampliado.

## Superadmin

Authentication → Users → Add user, luego:

```sql
INSERT INTO admin_users (user_id)
VALUES ('UUID-DEL-USUARIO-AUTH');
```

Login en `/admin/login`.
