# Informe de producto — Aguará App

**Destino:** agente de copy / diseño de landing page (captación de usuarios)  
**Fuente:** funcionalidades reales de la app  
**Idioma de copy sugerido:** español (Argentina / Latinoamérica neutro)

---

## 1. Qué es Aguará

**Aguará** es una plataforma de **identificación inteligente para mascotas** mediante chapita con QR, más un **portal para tutores** y un **panel para clínicas veterinarias**.

Si la mascota se pierde, quien escanea el QR puede contactar al tutor al instante. Además, el tutor y las clínicas gestionan historial clínico, turnos y recordatorios en un mismo ecosistema.

**Mensaje comercial actual:** identificación con QR; el tag se paga una vez (messaging de landing: sin cuotas mensuales).

**Tagline de producto (actual):**  
*“Identificación inteligente para tu mascota — QR en el collar, perfil del tutor y ficha médica digital.”*

---

## 2. Públicos objetivo

| Público | Qué necesita | Qué le da Aguará |
|--------|--------------|------------------|
| **Tutor / dueño** | Recuperar la mascota si se pierde; orden médico y turnos | Chapita QR, ficha pública, portal, recordatorios, HC, turnos, PWA |
| **Clínica veterinaria** | Operar pacientes, agenda e historias | Panel completo: pacientes, agenda, HC, clientes, stock, red de tutores |
| **Admin Aguará** | Fabricar y administrar chapitas y clínicas | Inventario de tiradas, estilo QR, altas de clínicas |

**Prioridad de landing:**  
1) Tutores (volumen / emoción de reencuentro)  
2) Clínicas (B2B / red)

---

## 3. Propuestas de valor (pilares)

### A) Reencuentro
Al escanear el QR del collar, cualquiera ve foto, nombre, datos clave y puede:
- Contactar por **WhatsApp**
- **Llamar** al tutor
- **Compartir su ubicación GPS**
- Ver enfermedades / medicación (si están cargadas)
- Ver clínica de cabecera

### B) Identidad permanente
- Chapita física con QR de marca Aguará
- Código tipo `T1-001` / `T3-005`
- Se puede crear la mascota **sin chapita** y vincular el QR después

### C) Salud y organización (tutor)
- Vacunas, desparasitaciones, tratamientos, medicación
- Recordatorios
- Historial clínico
- Pedir turnos en clínicas de la red

### D) Operación clínica
- Agenda, pacientes, historias clínicas, clientes
- Alertas (vacunas, desparasitaciones, stock)
- Finalizar cita → crear historia clínica
- Solicitar permiso al tutor para ver HC completa

---

## 4. Funcionalidades por módulo

### 4.1 Chapita / QR
- Activación de chapita (datos del tutor + mascota)
- Lectura pública al escanear (`/mascota/...` o ruta corta `/q/...`)
- Acciones de reencuentro: WhatsApp, llamada, GPS
- QR con branding Aguará (logo, colores, nombre, escuadras)
- Administración de tiradas (impresión ZIP / PDF A4)

### 4.2 Portal del tutor (`/tutor`)
Secciones: **Recordatorios · Mis mascotas · Mis citas · Historial clínico · Permisos · Perfil**

- Alta de mascotas (con o sin chapita)
- Vincular chapita después
- Solicitar / cancelar / reprogramar turnos
- Vacunas y tratamientos cargados por el tutor
- Recordatorios y medicación
- Descargar historial clínico
- Autorizar o revocar clínicas que ven la HC
- Perfil con dirección detallada, Google Maps y preferencias de notificación
- App instalable (**PWA**)

### 4.3 Portal de clínica (`/clinica`)
Secciones: **Dashboard · Tutores · Pacientes · Agenda · Historias · Clientes · Configuración**

- Citas del día, lista de espera, estados de turno
- Historias clínicas completas (con firma)
- Vacunas, desparasitaciones, archivos
- Recordatorios al tutor
- Veterinarios, horarios, servicios y stock
- Vínculo con tutores Aguará y solicitud de compartir perfil/HC

### 4.4 Admin
- Inventario de chapitas / tiradas
- Personalización del estilo de QR
- Alta y gestión de clínicas
- Listado de tutores

---

## 5. Diferenciadores (para copy)

1. **QR de reencuentro** con WhatsApp + llamada + GPS  
2. **Clínica de cabecera** aunque no esté registrada en Aguará (nombre, dirección, teléfono)  
3. **Mascota digital primero**, chapita después  
4. **Historial clínico** controlado por el tutor (permisos)  
5. **Tutor + clínica** en la misma plataforma  
6. **PWA** instalable en el celular  
7. Messaging: **sin abono mensual** (pago del tag)  

---

## 6. Brief para textos de landing

### Objetivo
Captar:
1. Tutores que activen / usen chapita  
2. Clínicas que se registren en la red  

### Tono
- Cercano, claro, confiable
- Emoción en reencuentro + utilidad concreta
- Español natural (Argentina / LATAM)
- Evitar jerga técnica en el hero (`DIG-`, tiradas, ECC, etc.)
- Sí usar: “QR en el collar”, “contacto al instante”, “historial médico”, “turnos”, “recordatorios”

### Estructura sugerida
1. **Hero:** marca + promesa de reencuentro + CTA  
2. **Cómo funciona** (3 pasos)  
3. **Para tutores**  
4. **Para clínicas**  
5. **Confianza / control de datos** (el tutor decide qué compartir)  
6. **CTA final** + accesos Tutor / Clínica  

### CTAs sugeridos
- “Activá tu chapita”
- “Soy tutor”
- “Registrá tu clínica”
- “Si encontrás una mascota, escaneá el QR”

### Beneficios a enfatizar
- Contacto inmediato por WhatsApp o llamada
- Ubicación GPS de quien la encontró
- Enfermedades y medicación a la vista
- Recordatorios de vacunas y desparasitación
- Historial clínico en un solo lugar
- Turnos online en clínicas Aguará
- Sin cuotas mensuales (según messaging actual)

### Restricciones (no inventar)
- No prometer GPS en tiempo real 24/7 (es compartir ubicación al encontrar la mascota)
- No prometer collar IoT / tracking continuo
- No decir que “todas las veterinarias del país” ya están
- No mencionar detalles de login técnico / demos

### Mensajes por segmento

| Segmento | Dolor | Promesa |
|---------|-------|---------|
| Tutor ansioso | “Si se pierde…” | “Escanean el QR y te escriben al toque” |
| Tutor organizado | Olvidos de vacunas/turnos | “Recordatorios y HC en el celu” |
| Clínica | Agenda y fichas desordenadas | “Agenda, pacientes e HC en un panel” |

---

## 7. One-liners para iterar

- “El QR del collar que vuelve a casa a tu mascota.”
- “Escanean, te escriben, la recuperás.”
- “Identificación + historial médico + turnos, en una sola app.”
- “Para tutores que cuidan. Para clínicas que atienden.”
- “Chapita una vez. Tranquilidad siempre.”

---

## 8. Rutas útiles (referencia)

| Ruta | Uso |
|------|-----|
| `/` | Landing |
| `/mascota/...` o `/q/...` | Activación / ficha pública al escanear |
| `/tutor` | Portal del tutor |
| `/clinica` | Panel de clínica |
| `/clinica/registro` | Alta de clínica |
| `/admin` | Superadmin |

---

## 9. Entregable esperado del agente de copy

Textos listos para implementar en:
- Hero (headline + subtítulo + CTAs)
- Cómo funciona (3 pasos)
- Beneficios tutores
- Beneficios clínicas
- Bloque de confianza / permisos
- CTA final
- Microcopy de botones y nav (Tutor / Clínica / Activar)

Mantener coherencia con la marca **Aguará** y el eje emocional de **reencuentro + cuidado**.
