-- =============================================================
-- Chinese Word Order — server setup (Supabase)
--
-- Run ONCE: Supabase dashboard → SQL Editor → New query →
-- paste this whole file → Run. Running it again is safe (it won't
-- reset the PIN or the word list).
-- =============================================================

create extension if not exists pgcrypto with schema extensions;
create schema if not exists private;

-- 1) The word list every player downloads ---------------------------
create table if not exists public.game_data (
  id          text primary key,
  questions   jsonb not null,
  updated_at  timestamptz not null default now()
);

alter table public.game_data enable row level security;

drop policy if exists "Anyone can read the word list" on public.game_data;
create policy "Anyone can read the word list"
  on public.game_data for select
  to anon, authenticated
  using (true);
-- No insert/update/delete policies: the website can only change the list
-- through admin_save_questions() below, which checks the PIN first.

-- 2) Admin PIN — stored hashed, in a schema the website can't read ----
create table if not exists private.admin_settings (
  id               int primary key default 1 check (id = 1),
  pin_hash         text not null,
  failed_attempts  int not null default 0,
  locked_until     timestamptz
);

insert into private.admin_settings (id, pin_hash)
values (1, extensions.crypt('1234', extensions.gen_salt('bf')))
on conflict (id) do nothing;

-- Returns 'ok', 'wrong' or 'locked'.
-- 5 wrong PINs in a row lock the admin page for 10 minutes.
create or replace function private.verify_pin(p_pin text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  s     private.admin_settings%rowtype;
  fails int;
begin
  select * into s from private.admin_settings where id = 1 for update;
  if not found then
    return 'wrong';
  end if;

  if s.locked_until is not null and s.locked_until > now() then
    return 'locked';
  end if;

  -- a lock that has run out starts the count again
  fails := case when s.locked_until is not null then 0 else s.failed_attempts end;

  if p_pin is null or extensions.crypt(p_pin, s.pin_hash) <> s.pin_hash then
    fails := fails + 1;
    update private.admin_settings
       set failed_attempts = fails,
           locked_until = case when fails >= 5 then now() + interval '10 minutes' else null end
     where id = 1;
    if fails >= 5 then
      return 'locked';
    end if;
    return 'wrong';
  end if;

  update private.admin_settings
     set failed_attempts = 0, locked_until = null
   where id = 1;
  return 'ok';
end;
$$;

-- 3) Functions the admin page calls ---------------------------------
create or replace function public.admin_check_pin(p_pin text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  return private.verify_pin(p_pin);
end;
$$;

-- Replaces the whole word list. Returns 'ok', 'wrong', 'locked' or 'invalid'.
create or replace function public.admin_save_questions(p_pin text, p_questions jsonb)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  result text := private.verify_pin(p_pin);
begin
  if result <> 'ok' then
    return result;
  end if;
  if jsonb_typeof(p_questions) is distinct from 'array' then
    return 'invalid';
  end if;
  if jsonb_array_length(p_questions) not between 1 and 1000 then
    return 'invalid';
  end if;

  insert into public.game_data (id, questions, updated_at)
  values ('main', p_questions, now())
  on conflict (id) do update
    set questions  = excluded.questions,
        updated_at = excluded.updated_at;
  return 'ok';
end;
$$;

-- New PIN must be 4–12 digits. Returns 'ok', 'wrong', 'locked' or 'invalid'.
create or replace function public.admin_change_pin(p_pin text, p_new_pin text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  result text := private.verify_pin(p_pin);
begin
  if result <> 'ok' then
    return result;
  end if;
  if p_new_pin is null or p_new_pin !~ '^[0-9]{4,12}$' then
    return 'invalid';
  end if;

  update private.admin_settings
     set pin_hash = extensions.crypt(p_new_pin, extensions.gen_salt('bf'))
   where id = 1;
  return 'ok';
end;
$$;

-- 4) Permissions -----------------------------------------------------
revoke all on table private.admin_settings from public, anon, authenticated;
revoke all on function private.verify_pin(text) from public, anon, authenticated;

revoke all on function public.admin_check_pin(text) from public;
revoke all on function public.admin_save_questions(text, jsonb) from public;
revoke all on function public.admin_change_pin(text, text) from public;
grant execute on function public.admin_check_pin(text) to anon, authenticated;
grant execute on function public.admin_save_questions(text, jsonb) to anon, authenticated;
grant execute on function public.admin_change_pin(text, text) to anon, authenticated;

-- make the new functions visible to the website straight away
notify pgrst, 'reload schema';

-- -------------------------------------------------------------------
-- Forgot the PIN? Run this line on its own to set it back to 1234:
--   update private.admin_settings set pin_hash = extensions.crypt('1234', extensions.gen_salt('bf')), failed_attempts = 0, locked_until = null where id = 1;
-- -------------------------------------------------------------------
