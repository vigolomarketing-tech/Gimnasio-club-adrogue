# Fase 2 · Conectar la app de turnos a Supabase

La app (`/app/`) y el panel (`/app/admin/`) hablan siempre con la misma interfaz, `window.GIMAPI`:

- **Fase 1 (`backend: "local"`)**: `app/js/api.js` guarda todo en el navegador y trae datos de ejemplo. Sirve para la demo.
- **Fase 2 (`backend: "supabase"`)**: `app/js/api-supabase.js` reemplaza esos métodos por llamadas a Supabase. Las pantallas no cambian.

Las reglas de negocio quedan dentro de Postgres, en funciones `SECURITY DEFINER`, así que no se pueden saltear desde el navegador:
- cupo, horario del gimnasio, superposición de turnos, membresía vencida, límite semanal del plan y política de cancelación;
- `reservar_turno()` bloquea la fila del turno (`FOR UPDATE`), así que dos personas que piden el último lugar al mismo tiempo quedan en fila y el cupo nunca se pasa. Además hay un índice único contra la doble reserva.

## Pasos

1. **Crear el proyecto** en [supabase.com](https://supabase.com) (región São Paulo).
2. **SQL Editor → pegar y ejecutar `schema.sql` completo.** Crea las tablas, las políticas RLS, las funciones, la plantilla de franjas, los planes y la configuración. Se puede volver a correr sin romper nada.
3. **Crear el usuario del gimnasio**: en Authentication → Users → *Add user* (email y contraseña). Después, en el SQL Editor:
   ```sql
   insert into admins (user_id, nombre)
   select id, 'Recepción' from auth.users where email = 'recepcion@tudominio.com';
   ```
4. **Cargar los socios** desde el panel (Socios → Nuevo socio) o importando un CSV en la tabla `socios`. El PIN se guarda hasheado: se fija con `select fijar_pin('<id>', '1234')` o desde el panel.
5. **Ingreso con DNI + PIN** con un Cloudflare Worker (`worker.js`):
   ```bash
   npm create cloudflare@latest gim-turnos -- --type hello-world   # pegar worker.js en src/index.js
   npx wrangler secret put SUPABASE_URL
   npx wrangler secret put SUPABASE_SERVICE_KEY      # service_role: SOLO en el Worker, nunca en el front
   npx wrangler secret put ALLOWED_ORIGIN            # ej. https://gimadrogue.com.ar
   npx wrangler deploy
   ```
6. **En `data.js`**:
   ```js
   reservas: {
     backend: "supabase",
     supabase: { url: "https://xxxx.supabase.co", anonKey: "eyJ...", workerUrl: "https://gim-turnos.xxx.workers.dev" },
   ```
   La `anonKey` es pública y puede ir en el front; la seguridad la dan las políticas RLS.
7. **Realtime**: el esquema ya agrega `turnos` y `reservas` a la publicación. Los cupos se actualizan en vivo en todas las pantallas abiertas.

## Ingreso por código de WhatsApp o link por mail (opcional)

- **Link mágico por mail**: Authentication → Providers → Email. La app llama a `GIMAPI.solicitarCodigo({ email })`.
- **Código por WhatsApp**: Authentication → Providers → Phone, con Twilio (canal WhatsApp). La app llama a `solicitarCodigo({ whatsapp })` y después a `verificarCodigo({ whatsapp, codigo })`.
- En los dos casos, `vincular_socio()` une el usuario de Auth con su ficha por email o por WhatsApp.

## Recordatorio automático 2 h antes

1. En Meta for Developers, crear la app de **WhatsApp Cloud API** y aprobar la plantilla `recordatorio_turno` (es_AR) con 4 variables: nombre, actividad, hora y dirección.
2. `npx wrangler secret put WA_TOKEN` y `npx wrangler secret put WA_PHONE_ID`.
3. En `wrangler.toml`: `[triggers] crons = ["*/10 * * * *"]`.

El Worker toma los turnos que empiezan en unas 2 h, de socios que pidieron aviso, manda el mensaje y lo marca como enviado.

## Mercado Pago (siguiente paso)

El botón **Renovar** hoy abre WhatsApp. Para cobrar online:
1. Sumar al Worker un endpoint que cree una *preferencia* de Checkout Pro con el plan y el `socio_id` como `external_reference`.
2. Sumar el webhook de Mercado Pago, que al aprobarse el pago llama a `registrar_pago()` con la service key y guarda `mp_pago_id`. Esa columna es única, así que si el webhook llega dos veces no se registra un pago duplicado.

## Qué se probó

`schema.sql` se ejecutó en un Postgres 16 local, con `auth.uid()` y `auth.jwt()` simulados como en Supabase. Funcionó todo esto:
- se corre dos veces seguidas sin errores;
- un socio solo ve sus propios datos (RLS) y no puede insertar reservas directo;
- doble reserva, profe obligatorio, cupo completo, lista de espera con promoción automática al cancelar;
- dos reservas simultáneas al último lugar: una entra y la otra recibe "completo";
- cambio de turno atómico (si el nuevo no tiene lugar, el original queda intacto);
- pagos y QR solo para el gimnasio, y reportes.

Falta probar `api-supabase.js` y `worker.js` contra un proyecto real de Supabase y Cloudflare.
