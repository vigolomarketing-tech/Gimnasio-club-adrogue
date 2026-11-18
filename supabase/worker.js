/* GIM Adrogué · Cloudflare Worker (fase 2)
 *
 *  POST /auth/pin   { usuario, pin }  -> { token_hash }
 *      Valida DNI/WhatsApp + PIN contra Postgres (verificar_pin) con la
 *      service key, y genera un link mágico de un solo uso. La app lo
 *      canjea con supabase.auth.verifyOtp({ token_hash, type: "magiclink" }).
 *
 *  Cron (cada 10 min): recordatorios por WhatsApp 2 h antes del turno
 *      con la API de WhatsApp Cloud (Meta). Usa la plantilla aprobada
 *      "recordatorio_turno" con 4 variables: nombre, actividad, hora, dirección.
 *
 * Variables (wrangler secret put ...):
 *   SUPABASE_URL, SUPABASE_SERVICE_KEY, ALLOWED_ORIGIN (ej. https://gimadrogue.com.ar)
 *   WA_TOKEN, WA_PHONE_ID (WhatsApp Cloud API)   · opcionales hasta activar recordatorios
 * wrangler.toml:  [triggers] crons = ["*\/10 * * * *"]
 */
const json = (obj, status, origin) => new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json", ...cors(origin) } });
const cors = (origin) => ({ "access-control-allow-origin": origin || "*", "access-control-allow-methods": "POST, OPTIONS", "access-control-allow-headers": "content-type" });

async function sb(env, path, body, method = "POST") {
  const r = await fetch(`${env.SUPABASE_URL}${path}`, {
    method, headers: { apikey: env.SUPABASE_SERVICE_KEY, authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`, "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json().catch(() => null);
  if (!r.ok) throw Object.assign(new Error("supabase"), { status: r.status, data });
  return data;
}

// Límite simple de intentos por IP (en memoria del isolate; para algo más firme usar KV o Durable Objects)
const intentos = new Map();
function limitar(ip) {
  const ahora = Date.now(), e = intentos.get(ip) || { n: 0, t: ahora };
  if (ahora - e.t > 10 * 60e3) { e.n = 0; e.t = ahora; }
  e.n++; intentos.set(ip, e);
  return e.n > 8;
}

async function loginPin(req, env) {
  const origin = env.ALLOWED_ORIGIN;
  const ip = req.headers.get("cf-connecting-ip") || "x";
  if (limitar(ip)) return json({ code: "bloqueo", message: "Demasiados intentos. Probá de nuevo en unos minutos." }, 429, origin);
  const { usuario, pin } = await req.json().catch(() => ({}));
  if (!usuario || !/^\d{4}$/.test(String(pin || ""))) return json({ code: "credenciales", message: "Completá tu DNI o WhatsApp y el PIN de 4 números." }, 400, origin);

  const socio = await sb(env, "/rest/v1/rpc/verificar_pin", { p_usuario: String(usuario), p_pin: String(pin) });
  if (!socio || !socio.id) return json({ code: "credenciales", message: "El DNI/WhatsApp o el PIN no coinciden." }, 401, origin);

  // Cada socio tiene un usuario de Auth. Si no tiene mail, se usa uno interno.
  const email = socio.email || `${socio.dni}@socios.gim.invalid`;
  let userId = socio.user_id;
  if (!userId) {
    const u = await sb(env, "/auth/v1/admin/users", { email, email_confirm: true, user_metadata: { socio_id: socio.id } }).catch(async (e) => {
      if (e.status !== 422) throw e; // ya existe
      const lista = await sb(env, `/auth/v1/admin/users?email=${encodeURIComponent(email)}`, null, "GET");
      return (lista.users || [])[0];
    });
    userId = u.id;
    await sb(env, `/rest/v1/socios?id=eq.${socio.id}`, { user_id: userId }, "PATCH");
  }
  const link = await sb(env, "/auth/v1/admin/generate_link", { type: "magiclink", email });
  const token_hash = link.hashed_token || (link.properties && link.properties.hashed_token);
  return json({ token_hash }, 200, origin);
}

async function recordatorios(env) {
  if (!env.WA_TOKEN || !env.WA_PHONE_ID) return;
  const lista = await sb(env, "/rest/v1/rpc/recordatorios_a_enviar", { p_horas: 2, p_margen_min: 6 });
  for (const r of lista || []) {
    const res = await fetch(`https://graph.facebook.com/v20.0/${env.WA_PHONE_ID}/messages`, {
      method: "POST", headers: { authorization: `Bearer ${env.WA_TOKEN}`, "content-type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp", to: r.whatsapp, type: "template",
        template: { name: "recordatorio_turno", language: { code: "es_AR" }, components: [{ type: "body", parameters: [
          { type: "text", text: r.nombre }, { type: "text", text: r.actividad }, { type: "text", text: String(r.hora).slice(0, 5) }, { type: "text", text: "Seguí 886, Adrogué" },
        ] }] },
      }),
    });
    if (res.ok) await sb(env, `/rest/v1/reservas?id=eq.${r.reserva_id}`, { aviso_enviado: true }, "PATCH");
  }
}

export default {
  async fetch(req, env) {
    if (req.method === "OPTIONS") return new Response(null, { headers: cors(env.ALLOWED_ORIGIN) });
    const url = new URL(req.url);
    try {
      if (req.method === "POST" && url.pathname === "/auth/pin") return await loginPin(req, env);
      return json({ message: "No encontrado" }, 404, env.ALLOWED_ORIGIN);
    } catch (e) {
      return json({ code: "servidor", message: "No pudimos ingresar. Probá de nuevo." }, 500, env.ALLOWED_ORIGIN);
    }
  },
  async scheduled(_evt, env, ctx) { ctx.waitUntil(recordatorios(env)); },
};
