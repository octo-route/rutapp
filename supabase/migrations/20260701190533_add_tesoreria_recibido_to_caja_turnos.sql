alter table public.caja_turnos
add column if not exists recibido_tesoreria boolean not null default false,
add column if not exists recibido_por uuid null,
add column if not exists recibido_at timestamptz null;