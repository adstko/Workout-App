-- =====================================================================
-- Workout App: friends, sharing and leaderboard setup for Supabase
--
-- HOW TO USE: Supabase dashboard > SQL Editor > New query > paste this whole
-- file > press Run. It is safe to run again (it only creates what is missing
-- and refreshes the rules).
--
-- THE IDEA: every table has a lock (Row Level Security). The rules below say who
-- may read each row. Writing happens only through the small functions at the
-- bottom, which check everything first. Nobody can read another person's data
-- unless they are accepted friends AND that person turned sharing on.
-- =====================================================================

-- ---------- Tables ----------

-- One row per person. The nickname is public to friends; the friend code is how people find you.
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nickname text not null check (nickname ~ '^[A-Za-z0-9_]{3,20}$'),
  friend_code text not null unique default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  share_workouts boolean not null default false,   -- friends may see my finished workouts
  share_stats boolean not null default false,      -- friends may see my weekly totals
  created_at timestamptz not null default now()
);
create unique index if not exists profiles_nickname_lower on public.profiles (lower(nickname));

-- Who is friends with whom. "pending" until the other person accepts.
create table if not exists public.friendships (
  id bigint generated always as identity primary key,
  requester uuid not null references public.profiles (id) on delete cascade,
  addressee uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  check (requester <> addressee)
);
create unique index if not exists friendships_pair
  on public.friendships (least(requester, addressee), greatest(requester, addressee));

-- Workouts a person chose to share (a summary: exercises with sets, reps and weight).
create table if not exists public.shared_workouts (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references public.profiles (id) on delete cascade,
  local_id text not null,                           -- the workout's id on the phone, so re-sending updates instead of duplicating
  name text not null check (char_length(name) between 1 and 40),
  workout_date date not null,
  minutes integer check (minutes between 0 and 600),
  exercises jsonb not null check (jsonb_typeof(exercises) = 'array' and jsonb_array_length(exercises) <= 30 and pg_column_size(exercises) <= 60000),
  created_at timestamptz not null default now(),
  unique (owner, local_id)
);
create index if not exists shared_workouts_owner_date on public.shared_workouts (owner, workout_date desc);

-- One row per person per week (weeks start on Monday). The leaderboard adds these up.
-- The limits are sanity checks so a silly number can't wreck the board.
create table if not exists public.weekly_stats (
  owner uuid not null references public.profiles (id) on delete cascade,
  week_start date not null check (extract(isodow from week_start) = 1),
  lbs_lifted bigint not null default 0 check (lbs_lifted between 0 and 1000000),
  workouts integer not null default 0 check (workouts between 0 and 100),
  sets integer not null default 0 check (sets between 0 and 2000),
  miles_ran numeric(7, 1) not null default 0 check (miles_ran between 0 and 500),
  miles_biked numeric(7, 1) not null default 0 check (miles_biked between 0 and 1000),
  miles_walked numeric(7, 1) not null default 0 check (miles_walked between 0 and 500),
  feet_climbed integer not null default 0 check (feet_climbed between 0 and 100000),
  cardio_minutes integer not null default 0 check (cardio_minutes between 0 and 10080),
  updated_at timestamptz not null default now(),
  primary key (owner, week_start)
);

-- Used only to slow down anyone guessing friend codes. Nobody can read it directly.
create table if not exists public.friend_lookups (
  user_id uuid not null,
  at timestamptz not null default now()
);

-- ---------- Turn the locks on ----------
alter table public.profiles enable row level security;
alter table public.friendships enable row level security;
alter table public.shared_workouts enable row level security;
alter table public.weekly_stats enable row level security;
alter table public.friend_lookups enable row level security;

-- ---------- Small helper questions the rules ask ----------
-- (security definer = they look at the friendships table on the rules' behalf, so the rules can't loop)

create or replace function public.is_friend(other uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and ((f.requester = auth.uid() and f.addressee = other) or (f.addressee = auth.uid() and f.requester = other)));
$$;

-- connected in any way, including a request that has not been accepted yet
create or replace function public.is_linked(other uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.friendships f
    where (f.requester = auth.uid() and f.addressee = other) or (f.addressee = auth.uid() and f.requester = other));
$$;

create or replace function public.can_see_workouts(owner_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select owner_id = auth.uid()
      or (public.is_friend(owner_id) and exists (select 1 from public.profiles p where p.id = owner_id and p.share_workouts));
$$;

create or replace function public.can_see_stats(owner_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select owner_id = auth.uid()
      or (public.is_friend(owner_id) and exists (select 1 from public.profiles p where p.id = owner_id and p.share_stats));
$$;

-- ---------- Who may READ what ----------
drop policy if exists "read my profile and my friends' profiles" on public.profiles;
create policy "read my profile and my friends' profiles" on public.profiles
  for select to authenticated using (id = auth.uid() or public.is_linked(id));

drop policy if exists "update my own sharing switches" on public.profiles;
create policy "update my own sharing switches" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "read my friendships" on public.friendships;
create policy "read my friendships" on public.friendships
  for select to authenticated using (requester = auth.uid() or addressee = auth.uid());

drop policy if exists "remove my friendships" on public.friendships;
create policy "remove my friendships" on public.friendships
  for delete to authenticated using (requester = auth.uid() or addressee = auth.uid());

drop policy if exists "read shared workouts" on public.shared_workouts;
create policy "read shared workouts" on public.shared_workouts
  for select to authenticated using (public.can_see_workouts(owner));

drop policy if exists "delete my shared workouts" on public.shared_workouts;
create policy "delete my shared workouts" on public.shared_workouts
  for delete to authenticated using (owner = auth.uid());

drop policy if exists "read weekly stats" on public.weekly_stats;
create policy "read weekly stats" on public.weekly_stats
  for select to authenticated using (public.can_see_stats(owner));

drop policy if exists "delete my weekly stats" on public.weekly_stats;
create policy "delete my weekly stats" on public.weekly_stats
  for delete to authenticated using (owner = auth.uid());

-- ---------- What each kind of visitor may touch at all ----------
-- Nothing for people who are not signed in. Signed-in people get exactly this and no more.
revoke all on public.profiles, public.friendships, public.shared_workouts, public.weekly_stats, public.friend_lookups from anon, authenticated;
grant usage on schema public to authenticated;
grant select on public.profiles, public.friendships, public.shared_workouts, public.weekly_stats to authenticated;
grant update (share_workouts, share_stats) on public.profiles to authenticated;   -- only the two switches
grant delete on public.friendships, public.shared_workouts, public.weekly_stats to authenticated;

-- ---------- The only ways to WRITE (each one checks its input) ----------

-- Pick a nickname after signing up. Returns 'ok' or 'taken' or 'invalid'.
create or replace function public.create_profile(nick text) returns text
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if nick is null or nick !~ '^[A-Za-z0-9_]{3,20}$' then return 'invalid'; end if;
  insert into public.profiles (id, nickname) values (auth.uid(), nick);
  return 'ok';
exception when unique_violation then
  if exists (select 1 from public.profiles where id = auth.uid()) then return 'ok'; end if;
  return 'taken';
end $$;

-- Send a friend request using someone's friend code.
-- Returns 'sent', 'not_found', 'self', 'exists', 'no_profile' or 'slow_down'.
create or replace function public.request_friend(code text) returns text
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); target uuid;
begin
  if me is null then raise exception 'not signed in'; end if;
  if not exists (select 1 from public.profiles where id = me) then return 'no_profile'; end if;

  delete from public.friend_lookups where at < now() - interval '1 hour';
  if (select count(*) from public.friend_lookups where user_id = me) >= 30 then return 'slow_down'; end if;
  insert into public.friend_lookups (user_id) values (me);

  select id into target from public.profiles where friend_code = upper(trim(code));
  if target is null then return 'not_found'; end if;
  if target = me then return 'self'; end if;
  if exists (select 1 from public.friendships f
             where (f.requester = me and f.addressee = target) or (f.requester = target and f.addressee = me)) then
    return 'exists';
  end if;
  insert into public.friendships (requester, addressee) values (me, target);
  return 'sent';
end $$;

-- Say yes to a friend request someone sent you.
create or replace function public.accept_friend(request_id bigint) returns boolean
language plpgsql security definer set search_path = '' as $$
declare changed integer;
begin
  update public.friendships set status = 'accepted'
   where id = request_id and addressee = auth.uid() and status = 'pending';
  get diagnostics changed = row_count;
  return changed = 1;
end $$;

-- Share (or re-share) one finished workout. exercises looks like:
-- [{"name":"Bench press","muscle":"Chest","sets":[{"weight":100,"reps":8,"failure":false}]}]
create or replace function public.share_workout(p_local_id text, p_name text, p_date date, p_minutes integer, p_exercises jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if not exists (select 1 from public.profiles where id = auth.uid()) then raise exception 'make a nickname first'; end if;
  if p_date < current_date - 400 or p_date > current_date + 1 then raise exception 'date out of range'; end if;
  insert into public.shared_workouts (owner, local_id, name, workout_date, minutes, exercises)
  values (auth.uid(), left(p_local_id, 60), left(p_name, 40), p_date, least(greatest(coalesce(p_minutes, 0), 0), 600), p_exercises)
  on conflict (owner, local_id) do update
    set name = excluded.name, workout_date = excluded.workout_date, minutes = excluded.minutes, exercises = excluded.exercises;
end $$;

-- Save my totals for one week. Silly numbers are cut down to the sanity limits.
create or replace function public.save_week_stats(p_week date, p_lbs bigint, p_workouts integer, p_sets integer, p_ran numeric,
                                                  p_biked numeric, p_walked numeric, p_feet integer, p_minutes integer) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if not exists (select 1 from public.profiles where id = auth.uid()) then raise exception 'make a nickname first'; end if;
  if extract(isodow from p_week) <> 1 or p_week < current_date - 800 or p_week > current_date + 7 then raise exception 'bad week'; end if;
  insert into public.weekly_stats (owner, week_start, lbs_lifted, workouts, sets, miles_ran, miles_biked, miles_walked, feet_climbed, cardio_minutes, updated_at)
  values (auth.uid(), p_week,
          least(greatest(coalesce(p_lbs, 0), 0), 1000000), least(greatest(coalesce(p_workouts, 0), 0), 100), least(greatest(coalesce(p_sets, 0), 0), 2000),
          least(greatest(coalesce(p_ran, 0), 0), 500), least(greatest(coalesce(p_biked, 0), 0), 1000), least(greatest(coalesce(p_walked, 0), 0), 500),
          least(greatest(coalesce(p_feet, 0), 0), 100000), least(greatest(coalesce(p_minutes, 0), 0), 10080), now())
  on conflict (owner, week_start) do update
    set lbs_lifted = excluded.lbs_lifted, workouts = excluded.workouts, sets = excluded.sets, miles_ran = excluded.miles_ran,
        miles_biked = excluded.miles_biked, miles_walked = excluded.miles_walked, feet_climbed = excluded.feet_climbed,
        cardio_minutes = excluded.cardio_minutes, updated_at = now();
end $$;

-- "Stop sharing and delete my online data": removes the account and everything attached to it.
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  delete from auth.users where id = auth.uid();   -- cascades to profile, friendships, workouts, stats
end $$;

-- Only signed-in people may call these (not the public internet).
revoke execute on function public.is_friend(uuid), public.is_linked(uuid), public.can_see_workouts(uuid), public.can_see_stats(uuid),
  public.create_profile(text), public.request_friend(text), public.accept_friend(bigint),
  public.share_workout(text, text, date, integer, jsonb),
  public.save_week_stats(date, bigint, integer, integer, numeric, numeric, numeric, integer, integer),
  public.delete_my_account() from public, anon;
grant execute on function public.is_friend(uuid), public.is_linked(uuid), public.can_see_workouts(uuid), public.can_see_stats(uuid),
  public.create_profile(text), public.request_friend(text), public.accept_friend(bigint),
  public.share_workout(text, text, date, integer, jsonb),
  public.save_week_stats(date, bigint, integer, integer, numeric, numeric, numeric, integer, integer),
  public.delete_my_account() to authenticated;
