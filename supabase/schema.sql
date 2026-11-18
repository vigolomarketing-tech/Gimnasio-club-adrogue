-- =====================================================================
-- GIM Adrogué · Sistema de turnos · Esquema Supabase (fase 2)
-- Ejecutar completo en: Supabase > SQL Editor > New query.
-- Postgres 15+. Zona horaria de negocio: America/Argentina/Buenos_Aires.
--
-- Principios:
--  * Los socios NUNCA escriben tablas directo: reservan/cancelan con
--    funciones SECURITY DEFINER que validan todas las reglas.
--  * Anti condiciones de carrera: reservar_turno() bloquea la fila del
--    turno (SELECT ... FOR UPDATE), así dos reservas simultáneas al mismo
--    turno se ejecutan en fila y el cupo nunca se pasa. Además hay un
--    índice único que impide la doble reserva del mismo socio.
--  * RLS en todas las tablas.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Catálogos
-- ---------------------------------------------------------------------
create table if not exists planes (
  id text primary key,
  nombre text not null,
  precio integer not null check (precio >= 0),
  dias integer not null default 30,
  reservas_semana integer,            -- null = sin límite
  detalle text,
  activo boolean not null default true
);

create table if not exists profes (
  id text primary key,
  nombre text not null,
  rol text,
  activo boolean not null default true
);

create table if not exists actividades (
  id text primary key,
  nombre text not null,
  corto text,
  icono text,
  descripcion text,
  duracion integer not null check (duracion between 15 and 240),
  cupo integer not null check (cupo > 0),
  elige_profe boolean not null default false,
  profes text[] not null default '{}',
  activo boolean not null default true
);

-- Configuración clave/valor (horarios del gym, políticas, textos de WhatsApp)
create table if not exists config (
  clave text primary key,
  valor jsonb not null
);

-- ---------------------------------------------------------------------
-- Personas
-- ---------------------------------------------------------------------
create table if not exists socios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete set null,
  nombre text not null,
  apellido text not null,
  dni text not null unique,
  whatsapp text not null,
  email text,
  pin_hash text,                       -- crypt(pin, gen_salt('bf'))
  plan_id text references planes(id),
  vence date,
  alta date not null default (now() at time zone 'America/Argentina/Buenos_Aires')::date,
  baja date,
  estado text not null default 'activo' check (estado in ('activo', 'baja')),
  objetivo text,
  notif_whatsapp boolean not null default true,
  notif_vencimiento boolean not null default true,
  creado timestamptz not null default now()
);
create index if not exists socios_whatsapp_idx on socios (whatsapp);

create table if not exists admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nombre text
);

-- ---------------------------------------------------------------------
-- Agenda
-- ---------------------------------------------------------------------
-- Franjas: semana = null -> plantilla semanal; semana = lunes -> solo esa semana
create table if not exists franjas (
  id uuid primary key default gen_random_uuid(),
  actividad_id text not null references actividades(id),
  dia smallint not null check (dia between 0 and 6),
  hora time not null,
  duracion integer not null,
  cupo integer not null check (cupo > 0),
  profe_id text references profes(id),
  semana date,
  unique nulls not distinct (actividad_id, dia, hora, semana)
);

create table if not exists bloqueos (
  fecha date primary key,
  motivo text not null default 'Cerrado'
);

-- Turnos concretos (se generan desde las franjas). ocupados/en_espera se
-- mantienen con un trigger para poder mostrarlos en tiempo real (Realtime).
create table if not exists turnos (
  id uuid primary key default gen_random_uuid(),
  actividad_id text not null references actividades(id),
  fecha date not null,
  hora time not null,
  fin time not null,
  cupo integer not null check (cupo > 0),
  profe_id text references profes(id),
  ocupados integer not null default 0,
  en_espera integer not null default 0,
  unique (actividad_id, fecha, hora)
);
create index if not exists turnos_fecha_idx on turnos (fecha);

create table if not exists reservas (
  id uuid primary key default gen_random_uuid(),
  turno_id uuid not null references turnos(id) on delete cascade,
  socio_id uuid not null references socios(id) on delete cascade,
  profe_id text references profes(id),
  estado text not null check (estado in ('confirmada', 'espera', 'asistio', 'ausente', 'cancelada')),
  codigo text not null unique default upper(substr(md5(gen_random_uuid()::text), 1, 6)),
  creada timestamptz not null default now(),
  cancelada timestamptz,
  motivo text,
  promovida timestamptz,
  marcada timestamptz,
  aviso_whatsapp boolean not null default false,
  aviso_enviado boolean not null default false,
  reprogramada_de uuid references reservas(id)
);
-- Un socio no puede tener dos reservas vivas en el mismo turno
create unique index if not exists reservas_unica_viva on reservas (socio_id, turno_id)
  where estado in ('confirmada', 'espera', 'asistio', 'ausente');
create index if not exists reservas_socio_idx on reservas (socio_id);
create index if not exists reservas_turno_idx on reservas (turno_id, estado);

create table if not exists pagos (
  id uuid primary key default gen_random_uuid(),
  socio_id uuid not null references socios(id) on delete cascade,
  fecha date not null,
  monto integer not null check (monto >= 0),
  plan_id text not null references planes(id),
  medio text not null,
  desde date not null,
  hasta date not null,
  registrado_por uuid references auth.users(id),
  mp_pago_id text unique,              -- fase 2: id de pago de Mercado Pago
  creado timestamptz not null default now()
);
create index if not exists pagos_fecha_idx on pagos (fecha);

create table if not exists checkins (
  id bigint generated always as identity primary key,
  socio_id uuid not null references socios(id) on delete cascade,
  reserva_id uuid references reservas(id) on delete set null,
  ts timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------
create or replace function hoy_ar() returns date language sql stable as
$$ select (now() at time zone 'America/Argentina/Buenos_Aires')::date $$;

create or replace function inicio_ar(p_fecha date, p_hora time) returns timestamptz language sql immutable as
$$ select (p_fecha + p_hora) at time zone 'America/Argentina/Buenos_Aires' $$;

create or replace function es_admin() returns boolean language sql stable security definer set search_path = public as
$$ select exists (select 1 from admins where user_id = auth.uid()) $$;

create or replace function mi_socio_id() returns uuid language sql stable security definer set search_path = public as
$$ select id from socios where user_id = auth.uid() and estado = 'activo' $$;

create or replace function cfg(p_clave text) returns jsonb language sql stable security definer set search_path = public as
$$ select valor from config where clave = p_clave $$;

-- ¿El rango [hora, hora+duración) cae dentro del horario del gym ese día?
create or replace function dentro_horario(p_fecha date, p_hora time, p_duracion integer) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from jsonb_array_elements(coalesce(cfg('horarios') -> extract(dow from p_fecha)::int::text, '[]'::jsonb)) h
    where p_hora >= (h ->> 0)::time and p_hora + make_interval(mins => p_duracion) <= (h ->> 1)::time
  )
$$;

-- Genera (idempotente) los turnos concretos de un rango de fechas
create or replace function asegurar_turnos(p_desde date, p_hasta date) returns void
language plpgsql security definer set search_path = public as $$
declare d date;
begin
  for d in select generate_series(p_desde, p_hasta, interval '1 day')::date loop
    continue when exists (select 1 from bloqueos where fecha = d);
    insert into turnos (actividad_id, fecha, hora, fin, cupo, profe_id)
    select f.actividad_id, d, f.hora, f.hora + make_interval(mins => f.duracion), f.cupo, f.profe_id
    from franjas f
    where f.dia = extract(dow from d)
      and f.semana is not distinct from (
        case when exists (select 1 from franjas x where x.semana = date_trunc('week', d)::date) then date_trunc('week', d)::date end)
      and dentro_horario(d, f.hora, f.duracion)
    on conflict (actividad_id, fecha, hora) do nothing;
  end loop;
end $$;

-- Mantiene ocupados / en_espera del turno
create or replace function recontar_turno() returns trigger language plpgsql security definer set search_path = public as $$
declare t uuid := coalesce(new.turno_id, old.turno_id);
begin
  update turnos set
    ocupados = (select count(*) from reservas where turno_id = t and estado in ('confirmada', 'asistio', 'ausente')),
    en_espera = (select count(*) from reservas where turno_id = t and estado = 'espera')
  where id = t;
  return null;
end $$;
drop trigger if exists reservas_recontar on reservas;
create trigger reservas_recontar after insert or update of estado or delete on reservas
  for each row execute function recontar_turno();

-- ---------------------------------------------------------------------
-- Reglas de negocio (RPC)
-- ---------------------------------------------------------------------
create or replace function reservar_turno(p_turno uuid, p_profe text default null, p_espera boolean default false, p_ignorar uuid default null)
returns reservas language plpgsql security definer set search_path = public as $$
declare
  v_socio socios; t turnos; a actividades; p planes; r reservas;
  v_ocupados integer; v_usadas integer; v_estado text := 'confirmada'; v_profe text;
  v_hoy date := hoy_ar();
  v_ant integer := coalesce((cfg('anticipacionDias'))::int, 14);
begin
  select * into v_socio from socios where id = mi_socio_id();
  if v_socio.id is null then raise exception 'socio' using hint = 'No encontramos tu ficha de socio.'; end if;
  if v_socio.vence is null or v_socio.vence < v_hoy then raise exception 'membresia-vencida' using hint = 'Tu plan está vencido. Renovalo para volver a reservar.'; end if;

  -- Bloquea el turno: las reservas concurrentes al mismo turno esperan acá.
  select * into t from turnos where id = p_turno for update;
  if t.id is null then raise exception 'horario' using hint = 'Ese horario no está disponible.'; end if;
  select * into a from actividades where id = t.actividad_id;

  if t.fecha < v_hoy or t.fecha >= v_hoy + v_ant then raise exception 'fecha' using hint = format('Podés reservar hasta %s días para adelante.', v_ant); end if;
  if exists (select 1 from bloqueos where fecha = t.fecha) then raise exception 'bloqueado' using hint = 'Ese día el gimnasio está cerrado.'; end if;
  if inicio_ar(t.fecha, t.hora) <= now() then raise exception 'pasado' using hint = 'Ese turno ya empezó.'; end if;
  if not dentro_horario(t.fecha, t.hora, a.duracion) then raise exception 'horario' using hint = 'Ese turno queda fuera del horario del gimnasio.'; end if;

  -- Superposición con otro turno del mismo socio
  if exists (
    select 1 from reservas x join turnos y on y.id = x.turno_id
    where x.socio_id = v_socio.id and x.id is distinct from p_ignorar
      and x.estado in ('confirmada', 'espera', 'asistio', 'ausente')
      and y.fecha = t.fecha and y.hora < t.fin and t.hora < y.fin
  ) then raise exception 'superpuesto' using hint = 'Ya tenés un turno en ese horario.'; end if;

  -- Límite semanal del plan
  select * into p from planes where id = v_socio.plan_id;
  if p.reservas_semana is not null then
    select count(*) into v_usadas from reservas x join turnos y on y.id = x.turno_id
    where x.socio_id = v_socio.id and x.id is distinct from p_ignorar
      and x.estado in ('confirmada', 'espera', 'asistio', 'ausente')
      and date_trunc('week', y.fecha) = date_trunc('week', t.fecha);
    if v_usadas >= p.reservas_semana then raise exception 'limite-plan' using hint = format('Tu plan permite %s turnos por semana.', p.reservas_semana); end if;
  end if;

  v_profe := t.profe_id;
  if a.elige_profe then
    if p_profe is null or not (p_profe = any (a.profes)) then raise exception 'profe' using hint = 'Elegí con qué profe querés entrenar.'; end if;
    v_profe := p_profe;
  end if;

  -- Cupo (conteo real bajo el lock, no el contador cacheado)
  select count(*) into v_ocupados from reservas where turno_id = t.id and estado in ('confirmada', 'asistio', 'ausente') and id is distinct from p_ignorar;
  if v_ocupados >= t.cupo then
    if not p_espera or not coalesce((cfg('listaEspera'))::boolean, true) then
      raise exception 'completo' using hint = 'Ese turno se completó recién. Elegí otro horario o anotate en la lista de espera.';
    end if;
    v_estado := 'espera';
  end if;

  insert into reservas (turno_id, socio_id, profe_id, estado, aviso_whatsapp)
  values (t.id, v_socio.id, v_profe, v_estado, v_socio.notif_whatsapp)
  returning * into r;
  return r;
end $$;

create or replace function cancelar_reserva(p_reserva uuid, p_motivo text default null)
returns reservas language plpgsql security definer set search_path = public as $$
declare r reservas; t turnos; sig reservas; v_admin boolean := es_admin();
  v_lim integer := coalesce((cfg('cancelacionHoras'))::int, 3);
begin
  select * into r from reservas where id = p_reserva;
  if r.id is null or (not v_admin and r.socio_id is distinct from mi_socio_id()) then raise exception 'reserva' using hint = 'No encontramos ese turno.'; end if;
  select * into t from turnos where id = r.turno_id for update;
  select * into r from reservas where id = p_reserva for update;
  if r.estado not in ('confirmada', 'espera') then raise exception 'estado' using hint = 'Ese turno ya no se puede cancelar.'; end if;
  if not v_admin and r.estado = 'confirmada' and inicio_ar(t.fecha, t.hora) - now() < make_interval(hours => v_lim) then
    raise exception 'tarde' using hint = format('Solo podés cancelar hasta %s h antes del turno.', v_lim);
  end if;
  update reservas set estado = 'cancelada', cancelada = now(), motivo = coalesce(p_motivo, motivo) where id = r.id returning * into r;
  -- Libera el cupo: pasa el primero de la lista de espera
  if (select count(*) from reservas where turno_id = t.id and estado in ('confirmada', 'asistio', 'ausente')) < t.cupo then
    select * into sig from reservas where turno_id = t.id and estado = 'espera' order by creada limit 1 for update skip locked;
    if sig.id is not null then update reservas set estado = 'confirmada', promovida = now() where id = sig.id; end if;
  end if;
  return r;
end $$;

-- Cambio de turno atómico: si el nuevo no se puede, el viejo queda como estaba.
create or replace function reprogramar_reserva(p_reserva uuid, p_turno uuid, p_profe text default null)
returns reservas language plpgsql security definer set search_path = public as $$
declare nueva reservas;
begin
  if not exists (select 1 from reservas where id = p_reserva and socio_id = mi_socio_id() and estado = 'confirmada') then
    raise exception 'reserva' using hint = 'No encontramos ese turno.';
  end if;
  nueva := reservar_turno(p_turno, p_profe, false, p_reserva);
  perform cancelar_reserva(p_reserva, 'Reprogramado');
  update reservas set reprogramada_de = p_reserva where id = nueva.id returning * into nueva;
  return nueva;
end $$;

create or replace function marcar_asistencia(p_reserva uuid, p_estado text) returns reservas
language plpgsql security definer set search_path = public as $$
declare r reservas;
begin
  if not es_admin() then raise exception 'sesion' using hint = 'Solo el gimnasio puede marcar asistencia.'; end if;
  if p_estado not in ('asistio', 'ausente', 'confirmada') then raise exception 'estado'; end if;
  update reservas set estado = p_estado, marcada = now() where id = p_reserva and estado in ('confirmada', 'asistio', 'ausente') returning * into r;
  if r.id is null then raise exception 'estado' using hint = 'Ese socio no tiene lugar confirmado en este turno.'; end if;
  return r;
end $$;

-- Lee un QR "GIM:R:<codigo>" (turno) o "GIM:S:<socio_id>" (pase)
create or replace function checkin_qr(p_texto text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v text := upper(trim(p_texto)); r reservas; s socios; v_hoy date := hoy_ar();
begin
  if not es_admin() then raise exception 'sesion'; end if;
  if v ~ '^GIM:R:[A-Z0-9]{6}$' or v ~ '^[A-Z0-9]{6}$' then
    select x.* into r from reservas x join turnos t on t.id = x.turno_id where x.codigo = right(v, 6) and t.fecha = v_hoy;
    if r.id is null then raise exception 'qr' using hint = 'Código no encontrado para hoy.'; end if;
    select * into s from socios where id = r.socio_id;
  elsif v ~ '^GIM:S:' then
    select * into s from socios where id::text = lower(substr(trim(p_texto), 7));
    if s.id is null then raise exception 'qr' using hint = 'Socio no encontrado.'; end if;
    select x.* into r from reservas x join turnos t on t.id = x.turno_id
      where x.socio_id = s.id and t.fecha = v_hoy and x.estado = 'confirmada'
      order by abs(extract(epoch from (inicio_ar(t.fecha, t.hora) - now()))) limit 1;
  else raise exception 'qr' using hint = 'Ese QR no es de GIM.';
  end if;
  if r.id is not null then
    if r.estado = 'espera' then raise exception 'qr' using hint = 'Está en lista de espera, no tiene lugar confirmado.'; end if;
    if r.estado = 'cancelada' then raise exception 'qr' using hint = 'Ese turno está cancelado.'; end if;
    update reservas set estado = 'asistio', marcada = now() where id = r.id;
  end if;
  insert into checkins (socio_id, reserva_id) values (s.id, r.id);
  return jsonb_build_object('socio_id', s.id, 'reserva_id', r.id);
end $$;

create or replace function registrar_pago(p_socio uuid, p_plan text, p_monto integer, p_medio text, p_fecha date default null)
returns pagos language plpgsql security definer set search_path = public as $$
declare s socios; p planes; v_fecha date := coalesce(p_fecha, hoy_ar()); v_desde date; pg pagos;
begin
  if not es_admin() then raise exception 'sesion'; end if;
  select * into s from socios where id = p_socio for update;
  select * into p from planes where id = coalesce(p_plan, s.plan_id);
  v_desde := case when s.vence is not null and s.vence >= v_fecha then s.vence else v_fecha end;
  insert into pagos (socio_id, fecha, monto, plan_id, medio, desde, hasta, registrado_por)
  values (s.id, v_fecha, coalesce(p_monto, p.precio), p.id, p_medio, v_desde, v_desde + p.dias, auth.uid()) returning * into pg;
  update socios set plan_id = p.id, vence = pg.hasta, estado = 'activo', baja = null where id = s.id;
  return pg;
end $$;

create or replace function actualizar_mi_perfil(p_datos jsonb) returns socios
language plpgsql security definer set search_path = public as $$
declare s socios;
begin
  update socios set
    email = coalesce(p_datos ->> 'email', email),
    whatsapp = coalesce(p_datos ->> 'whatsapp', whatsapp),
    objetivo = coalesce(p_datos ->> 'objetivo', objetivo),
    notif_whatsapp = coalesce((p_datos ->> 'notifWhatsapp')::boolean, notif_whatsapp),
    notif_vencimiento = coalesce((p_datos ->> 'notifVencimiento')::boolean, notif_vencimiento)
  where id = mi_socio_id() returning * into s;
  if p_datos ? 'pinNuevo' then
    if s.pin_hash is distinct from crypt(p_datos ->> 'pinActual', s.pin_hash) then raise exception 'pin' using hint = 'El PIN actual no es correcto.'; end if;
    if (p_datos ->> 'pinNuevo') !~ '^\d{4}$' then raise exception 'pin' using hint = 'El PIN tiene que tener 4 números.'; end if;
    update socios set pin_hash = crypt(p_datos ->> 'pinNuevo', gen_salt('bf')) where id = s.id returning * into s;
  end if;
  return s;
end $$;

-- Ingreso con DNI/WhatsApp + PIN. SOLO la llama el Worker con la service key.
create or replace function verificar_pin(p_usuario text, p_pin text) returns socios
language sql security definer set search_path = public as $$
  select * from socios
  where estado = 'activo'
    and (dni = regexp_replace(p_usuario, '\D', '', 'g') or right(whatsapp, 8) = right(regexp_replace(p_usuario, '\D', '', 'g'), 8))
    and pin_hash = crypt(p_pin, pin_hash)
  limit 1
$$;
revoke execute on function verificar_pin(text, text) from public, anon, authenticated;

-- Turnos con cupos para un día (genera los que falten)
create or replace function listar_turnos(p_fecha date, p_actividad text default null) returns setof turnos
language plpgsql security definer set search_path = public as $$
begin
  perform asegurar_turnos(p_fecha, p_fecha);
  return query select * from turnos where fecha = p_fecha and (p_actividad is null or actividad_id = p_actividad)
    and not exists (select 1 from bloqueos where fecha = p_fecha) order by hora, actividad_id;
end $$;

create or replace function bloquear_dia(p_fecha date, p_motivo text) returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if not es_admin() then raise exception 'sesion'; end if;
  insert into bloqueos (fecha, motivo) values (p_fecha, coalesce(p_motivo, 'Cerrado'));
  update reservas x set estado = 'cancelada', cancelada = now(), motivo = coalesce(p_motivo, 'Día bloqueado')
    from turnos t where t.id = x.turno_id and t.fecha = p_fecha and x.estado in ('confirmada', 'espera');
  get diagnostics n = row_count;
  return n;
end $$;

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table planes enable row level security;
alter table profes enable row level security;
alter table actividades enable row level security;
alter table config enable row level security;
alter table socios enable row level security;
alter table admins enable row level security;
alter table franjas enable row level security;
alter table bloqueos enable row level security;
alter table turnos enable row level security;
alter table reservas enable row level security;
alter table pagos enable row level security;
alter table checkins enable row level security;

-- Catálogos y agenda: los lee cualquier usuario logueado; escribe solo el gimnasio
do $$ declare tb text; begin
  foreach tb in array array['planes', 'profes', 'actividades', 'config', 'franjas', 'bloqueos', 'turnos'] loop
    execute format('drop policy if exists "%1$s_leer" on %1$s', tb);
    execute format('create policy "%1$s_leer" on %1$s for select to authenticated using (true)', tb);
    execute format('drop policy if exists "%1$s_admin" on %1$s', tb);
    execute format('create policy "%1$s_admin" on %1$s for all to authenticated using (es_admin()) with check (es_admin())', tb);
  end loop;
end $$;

drop policy if exists socios_ver on socios;
create policy socios_ver on socios for select to authenticated using (user_id = auth.uid() or es_admin());
drop policy if exists socios_admin on socios;
create policy socios_admin on socios for all to authenticated using (es_admin()) with check (es_admin());

drop policy if exists admins_ver on admins;
create policy admins_ver on admins for select to authenticated using (user_id = auth.uid());

drop policy if exists reservas_ver on reservas;
create policy reservas_ver on reservas for select to authenticated using (socio_id = mi_socio_id() or es_admin());
drop policy if exists reservas_admin on reservas;
create policy reservas_admin on reservas for all to authenticated using (es_admin()) with check (es_admin());

drop policy if exists pagos_ver on pagos;
create policy pagos_ver on pagos for select to authenticated using (socio_id = mi_socio_id() or es_admin());
drop policy if exists pagos_admin on pagos;
create policy pagos_admin on pagos for all to authenticated using (es_admin()) with check (es_admin());

drop policy if exists checkins_admin on checkins;
create policy checkins_admin on checkins for all to authenticated using (es_admin()) with check (es_admin());

-- Las funciones de negocio las puede llamar un usuario logueado (validan adentro)
revoke execute on function reservar_turno(uuid, text, boolean, uuid) from public, anon;
revoke execute on function cancelar_reserva(uuid, text) from public, anon;
revoke execute on function reprogramar_reserva(uuid, uuid, text) from public, anon;
grant execute on function reservar_turno(uuid, text, boolean, uuid), cancelar_reserva(uuid, text), reprogramar_reserva(uuid, uuid, text),
  marcar_asistencia(uuid, text), checkin_qr(text), registrar_pago(uuid, text, integer, text, date), actualizar_mi_perfil(jsonb),
  listar_turnos(date, text), bloquear_dia(date, text) to authenticated;

-- Realtime: cupos en vivo (turnos.ocupados) y agenda del panel
do $$ begin
  begin alter publication supabase_realtime add table turnos; exception when others then null; end;
  begin alter publication supabase_realtime add table reservas; exception when others then null; end;
end $$;

-- ---------------------------------------------------------------------
-- Datos iniciales (mismos valores que data.js; ajustar precios reales)
-- ---------------------------------------------------------------------
insert into config (clave, valor) values
  ('horarios', '{"0": [], "1": [["07:30","22:00"]], "2": [["07:30","22:00"]], "3": [["07:30","22:00"]], "4": [["07:30","22:00"]], "5": [["07:30","22:00"]], "6": [["09:00","18:00"]]}'),
  ('cancelacionHoras', '3'), ('anticipacionDias', '14'), ('listaEspera', 'true')
on conflict (clave) do nothing;

insert into planes (id, nombre, precio, dias, reservas_semana, detalle) values
  ('libre', 'Pase libre', 38000, 30, null, 'Todos los días, todas las actividades de sala'),
  ('3x', '3 veces por semana', 32000, 30, 3, 'Hasta 3 turnos por semana'),
  ('2x', '2 veces por semana', 26000, 30, 2, 'Hasta 2 turnos por semana'),
  ('readaptacion', 'Readaptación', 60000, 30, 3, 'Readaptación post kinesiológica con seguimiento')
on conflict (id) do nothing;

insert into profes (id, nombre, rol) values
  ('leandro', 'Lic. Leandro Rey', 'Kinesiólogo · Director'),
  ('camila', 'Camila Ferreyra', 'Profe de sala y preparación física'),
  ('matias', 'Matías Godoy', 'Profe de sala y funcional')
on conflict (id) do nothing;

insert into actividades (id, nombre, corto, icono, descripcion, duracion, cupo, elige_profe, profes) values
  ('musculacion', 'Musculación', 'Musculación', 'fuerza', 'Sala de musculación con tu planificación personalizada.', 60, 12, false, '{camila,matias}'),
  ('personalizado', 'Entrenamiento personalizado', 'Personalizado', 'plan', 'Grupo reducido, con un profe al lado en cada ejercicio.', 60, 4, true, '{camila,matias,leandro}'),
  ('funcional', 'Funcional', 'Funcional', 'preparacion', 'Circuitos de fuerza, potencia y resistencia en grupo.', 50, 10, false, '{matias}'),
  ('kinesiologia', 'Kinesiología / Readaptación', 'Kinesio', 'readaptacion', 'Readaptación post kinesiológica y return to play con el Lic. Rey.', 45, 2, false, '{leandro}'),
  ('preparacion', 'Preparación física', 'Prep. física', 'returnplay', 'Para deportistas: fuerza, velocidad y prevención de lesiones.', 60, 8, false, '{camila}')
on conflict (id) do nothing;

-- Plantilla semanal
insert into franjas (actividad_id, dia, hora, duracion, cupo, profe_id)
select a.id, d, h::time, a.duracion, a.cupo, case when a.elige_profe then null else a.profes[1] end
from actividades a
cross join lateral (values
  ('musculacion', array[1,2,3,4,5], array['07:30','08:30','09:30','10:30','11:30','12:30','13:30','14:30','15:30','16:30','17:30','18:30','19:30','20:30']),
  ('musculacion', array[6], array['09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00']),
  ('personalizado', array[1,2,3,4,5], array['08:00','10:00','17:00','18:00','19:00']),
  ('personalizado', array[6], array['10:00','11:00']),
  ('funcional', array[1,3,5], array['09:00','19:00','20:00']),
  ('funcional', array[6], array['10:00']),
  ('kinesiologia', array[2,4], array['14:00','15:00','16:00','17:00']),
  ('preparacion', array[2,4], array['18:00','19:00']),
  ('preparacion', array[6], array['11:00'])
) as g(act, dias, horas)
cross join unnest(g.dias) as d
cross join unnest(g.horas) as h
where g.act = a.id
on conflict do nothing;

-- ---------------------------------------------------------------------
-- Funciones de apoyo para la app (js/api-supabase.js)
-- ---------------------------------------------------------------------
-- Después de ingresar con link mágico / OTP, vincula el usuario de Auth con su ficha
create or replace function vincular_socio() returns uuid
language plpgsql security definer set search_path = public as $$
declare v uuid; v_email text := auth.jwt() ->> 'email'; v_tel text := regexp_replace(coalesce(auth.jwt() ->> 'phone', ''), '\D', '', 'g');
begin
  select id into v from socios where user_id = auth.uid();
  if v is not null then return v; end if;
  update socios set user_id = auth.uid()
  where user_id is null and estado = 'activo'
    and ((v_email <> '' and lower(email) = lower(v_email)) or (v_tel <> '' and right(whatsapp, 8) = right(v_tel, 8)))
  returning id into v;
  return v;
end $$;

create or replace function marcar_aviso(p_reserva uuid, p_valor boolean) returns void
language sql security definer set search_path = public as $$
  update reservas set aviso_whatsapp = p_valor where id = p_reserva and socio_id = mi_socio_id()
$$;

create or replace function turnos_rango(p_desde date, p_hasta date, p_actividad text default null) returns setof turnos
language plpgsql security definer set search_path = public as $$
begin
  perform asegurar_turnos(p_desde, p_hasta);
  return query select * from turnos t where t.fecha between p_desde and p_hasta
    and (p_actividad is null or t.actividad_id = p_actividad)
    and not exists (select 1 from bloqueos b where b.fecha = t.fecha)
    and dentro_horario(t.fecha, t.hora, (extract(epoch from (t.fin - t.hora)) / 60)::int)
  order by t.fecha, t.hora, t.actividad_id;
end $$;

-- Tras editar franjas: rehace los turnos futuros que no tienen reservas
create or replace function regenerar_turnos(p_desde date default null) returns void
language plpgsql security definer set search_path = public as $$
declare d date := coalesce(p_desde, hoy_ar());
begin
  if not es_admin() then raise exception 'sesion'; end if;
  delete from turnos t where t.fecha >= d and not exists (select 1 from reservas r where r.turno_id = t.id);
  -- los que tienen reservas toman el cupo nuevo (nunca por debajo de los ya anotados)
  update turnos t set cupo = greatest(f.cupo, t.ocupados)
  from franjas f
  where t.fecha >= d and f.actividad_id = t.actividad_id and f.dia = extract(dow from t.fecha) and f.hora = t.hora
    and f.semana is not distinct from (case when exists (select 1 from franjas x where x.semana = date_trunc('week', t.fecha)::date) then date_trunc('week', t.fecha)::date end);
  perform asegurar_turnos(d, d + 30);
end $$;

create or replace function fijar_pin(p_socio uuid, p_pin text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not es_admin() then raise exception 'sesion'; end if;
  if p_pin !~ '^\d{4}$' then raise exception 'pin' using hint = 'El PIN tiene que tener 4 números.'; end if;
  update socios set pin_hash = crypt(p_pin, gen_salt('bf')) where id = p_socio;
end $$;

create or replace function baja_socio(p_socio uuid, p_baja boolean) returns socios
language plpgsql security definer set search_path = public as $$
declare s socios; r record;
begin
  if not es_admin() then raise exception 'sesion'; end if;
  update socios set estado = case when p_baja then 'baja' else 'activo' end, baja = case when p_baja then hoy_ar() end where id = p_socio returning * into s;
  if p_baja then
    for r in select x.id from reservas x join turnos t on t.id = x.turno_id where x.socio_id = p_socio and x.estado in ('confirmada', 'espera') and t.fecha >= hoy_ar() loop
      perform cancelar_reserva(r.id, 'Baja del socio');
    end loop;
  end if;
  return s;
end $$;

-- Reportes del panel, con la misma forma que devuelve la demo local
create or replace function reporte_panel(p_semanas integer default 6) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_hoy date := hoy_ar(); v_desde date := date_trunc('week', hoy_ar())::date - 7 * (p_semanas - 1); res jsonb;
begin
  if not es_admin() then raise exception 'sesion'; end if;
  with pas as (select * from turnos where fecha between v_desde and v_hoy and inicio_ar(fecha, hora) <= now()),
  act as (select a.id, a.nombre, coalesce(sum(p.ocupados), 0) ocu, coalesce(sum(p.cupo), 0) cup from actividades a left join pas p on p.actividad_id = a.id group by a.id, a.nombre),
  pic as (select extract(dow from fecha)::int dia, extract(hour from hora)::int hora, sum(ocupados) ocu, sum(cupo) cup from pas group by 1, 2),
  sem as (select gs::date lunes from generate_series(v_desde, date_trunc('week', v_hoy)::date, interval '7 day') gs),
  mes as (select to_char(gs, 'YYYY-MM') m from generate_series(date_trunc('month', v_hoy) - interval '5 month', date_trunc('month', v_hoy), interval '1 month') gs)
  select jsonb_build_object(
    'desde', v_desde, 'hasta', v_hoy,
    'ocupacionActividad', (select jsonb_agg(jsonb_build_object('id', id, 'nombre', nombre, 'ocupados', ocu, 'cupo', cup, 'ocupacion', case when cup > 0 then ocu::numeric / cup else 0 end)) from act),
    'pico', (select coalesce(jsonb_agg(jsonb_build_object('dia', dia, 'hora', hora, 'ocupados', ocu, 'cupo', cup, 'ocupacion', case when cup > 0 then ocu::numeric / cup else 0 end)), '[]') from pic),
    'semanal', (select jsonb_agg(jsonb_build_object('lunes', s.lunes,
        'asistencias', (select count(*) from reservas r join turnos t on t.id = r.turno_id where t.fecha between s.lunes and s.lunes + 6 and r.estado = 'asistio'),
        'ausencias', (select count(*) from reservas r join turnos t on t.id = r.turno_id where t.fecha between s.lunes and s.lunes + 6 and r.estado = 'ausente'),
        'enCurso', s.lunes + 6 >= v_hoy) order by s.lunes) from sem s),
    'meses', (select jsonb_agg(jsonb_build_object('mes', m,
        'altas', (select count(*) from socios where to_char(alta, 'YYYY-MM') = m),
        'bajas', (select count(*) from socios where to_char(baja, 'YYYY-MM') = m),
        'ingresos', (select coalesce(sum(monto), 0) from pagos where to_char(fecha, 'YYYY-MM') = m)) order by m) from mes),
    'ingresosPorPlan', (select jsonb_agg(jsonb_build_object('plan', p.nombre, 'total', (select coalesce(sum(monto), 0) from pagos x where x.plan_id = p.id and to_char(x.fecha, 'YYYY-MM') = to_char(v_hoy, 'YYYY-MM')))) from planes p),
    'kpis', jsonb_build_object(
      'sociosActivos', (select count(*) from socios where estado = 'activo' and vence >= v_hoy),
      'vencidos', (select count(*) from socios where estado = 'activo' and (vence is null or vence < v_hoy)),
      'ocupacion', (select case when sum(cupo) > 0 then sum(ocupados)::numeric / sum(cupo) else 0 end from pas),
      'asistenciasSemana', (select count(*) from reservas r join turnos t on t.id = r.turno_id where t.fecha between date_trunc('week', v_hoy)::date and v_hoy and r.estado = 'asistio'),
      'ingresosMes', (select coalesce(sum(monto), 0) from pagos where to_char(fecha, 'YYYY-MM') = to_char(v_hoy, 'YYYY-MM')),
      'ingresosMesAnterior', (select coalesce(sum(monto), 0) from pagos where to_char(fecha, 'YYYY-MM') = to_char(v_hoy - interval '1 month', 'YYYY-MM')))
  ) into res;
  return res;
end $$;

grant execute on function vincular_socio(), marcar_aviso(uuid, boolean), turnos_rango(date, date, text), regenerar_turnos(date),
  fijar_pin(uuid, text), baja_socio(uuid, boolean), reporte_panel(integer) to authenticated;

-- Recordatorios automáticos (los usa el Worker con la service key)
create or replace function recordatorios_a_enviar(p_horas integer default 2, p_margen_min integer default 10)
returns table (reserva_id uuid, nombre text, whatsapp text, actividad text, fecha date, hora time)
language sql security definer set search_path = public as $$
  select r.id, s.nombre, s.whatsapp, a.nombre, t.fecha, t.hora
  from reservas r join turnos t on t.id = r.turno_id join socios s on s.id = r.socio_id join actividades a on a.id = t.actividad_id
  where r.estado = 'confirmada' and r.aviso_whatsapp and not r.aviso_enviado
    and inicio_ar(t.fecha, t.hora) between now() + make_interval(hours => p_horas) - make_interval(mins => p_margen_min)
                                       and now() + make_interval(hours => p_horas) + make_interval(mins => p_margen_min)
$$;
revoke execute on function recordatorios_a_enviar(integer, integer) from public, anon, authenticated;
