# GIM – Gimnasio Club Atlético Adrogué

Web institucional + sistema de reserva de turnos (PWA). HTML, CSS y JS vanilla, sin build. Se abre con doble clic o se publica en GitHub Pages / Cloudflare Pages.

| Ruta | Qué es |
|---|---|
| `/` | Web institucional del GIM |
| `/app/` | App de socios: reservar, mis turnos, pase QR, membresía, perfil (instalable) |
| `/app/admin/` | Panel del gimnasio: agenda y asistencia (con escáner QR), turnos y cupos, socios, pagos, reportes, configuración |

## Todo se edita en `data.js`

Objeto `CONFIG`: textos de la web, horarios, contacto y, en `CONFIG.reservas`, todo el sistema de turnos (actividades, franjas, cupos, profes, planes y precios, política de cancelación, textos de WhatsApp). Lo marcado `// PENDIENTE CLIENTE` falta confirmar.

## Sistema de turnos: fases

- **Fase 1 (actual, `backend: "local"`)**: funciona sin servidor. Los datos viven en el navegador (localStorage) y se generan datos de ejemplo realistas al abrir. Ideal para mostrar y grabar la demo.
  - Socios de prueba: Martina `35123456` / PIN `1234` (al día) · Lucas `38987654` / `2345` (vence pronto) · Sofía `41222333` / `3456` (plan vencido).
  - Panel: clave `gim2026` (solo demo).
  - Panel → Configuración → *Restablecer datos de ejemplo* vuelve a generar todo con la fecha de hoy.
- **Fase 2 (`backend: "supabase"`)**: misma app contra Supabase (Postgres + Auth + RLS + Realtime) y un Cloudflare Worker para el ingreso con PIN y los recordatorios automáticos. Ver [`supabase/README.md`](supabase/README.md).

## Estructura

```
index.html · styles.css · app.js     web institucional
data.js                               CONFIG (todo el contenido)
app/index.html                        app de socios
app/admin/index.html                  panel
app/js/api.js                         capa de datos (interfaz única) + demo local
app/js/api-supabase.js                misma interfaz contra Supabase (fase 2)
app/js/ui.js · socio.js · admin.js    interfaz
app/sw.js · manifest.webmanifest      PWA (offline + instalable)
app/vendor/                           qrcode-generator (MIT), jsQR (Apache-2.0, se carga solo al escanear)
supabase/schema.sql                   tablas, RLS, funciones transaccionales, datos iniciales
supabase/worker.js                    Cloudflare Worker (login con PIN, recordatorios WhatsApp)
```

Web hecha por [Vigolo Web Studio](https://vigolowebstudio.com).
