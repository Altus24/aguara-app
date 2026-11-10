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
8. `08_reset_tiradas.sql` ← solo si querés limpiar inventario
9. `09_tutores.sql` ← tutores reutilizables + `tutor_id` en mascotas
10. `10_clinicas.sql` ← clínicas + servicios + horarios + stock
11. `11_clinica_operativa.sql` ← vets, clientes, pacientes, citas, HC, pagos
12. `12_veterinarios_firma.sql` ← matrícula + firma digital de veterinarios
13. `13_tutor_portal.sql` ← portal tutor (perfil, citas pendientes, recordatorios)
14. `14_mascota_perfil_clinico.sql` ← peso/edad + tratamientos (ficha privada del tutor)

No corras `01` a ciegas si las tablas `mascotas` / `chapitas` / `admin_users` ya existen.
En proyectos ya en uso, ejecutá al menos el `07`, el `09`, el `10`–`14` para el formulario
ampliado, clínicas y portal de tutores.

## Superadmin

Authentication → Users → Add user, luego:

```sql
INSERT INTO admin_users (user_id)
VALUES ('UUID-DEL-USUARIO-AUTH');
```

Login en `/admin/login`.
