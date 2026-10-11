create type public.app_role as enum ('citizen','authority');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Neighbour',
  country text, state text, district text,
  points integer not null default 0,
  created_at timestamptz not null default now()
);
grant select, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "profiles readable" on public.profiles for select to authenticated using (true);
create policy "update own profile" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create policy "read roles" on public.user_roles for select to authenticated using (true);

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create or replace function public.protect_points() returns trigger language plpgsql set search_path = public as $$
begin
  if current_user = 'authenticated' then new.points := old.points; end if;
  return new;
end $$;
create trigger profiles_protect_points before update on public.profiles for each row execute function public.protect_points();

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
declare r app_role;
begin
  r := case when new.raw_user_meta_data->>'role' = 'authority' then 'authority'::app_role else 'citizen'::app_role end;
  insert into public.profiles (id, display_name, country, state, district)
  values (new.id, coalesce(nullif(new.raw_user_meta_data->>'display_name',''), split_part(new.email,'@',1)),
          new.raw_user_meta_data->>'country', new.raw_user_meta_data->>'state', new.raw_user_meta_data->>'district');
  insert into public.user_roles (user_id, role) values (new.id, r);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create table public.issues (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null,
  title text not null,
  description text,
  category text not null,
  department text not null,
  severity integer not null default 2,
  status text not null default 'Pending',
  lat double precision not null,
  lng double precision not null,
  country text, state text, district text,
  photo_url text not null,
  resolution_photo_url text,
  resolver_id uuid,
  ai_verdict text,
  merged_count integer not null default 1,
  citizen_confirmed boolean not null default false,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
grant select, update on public.issues to authenticated;
grant all on public.issues to service_role;
alter table public.issues enable row level security;
create policy "issues readable" on public.issues for select to authenticated using (true);
create policy "authority updates" on public.issues for update to authenticated using (public.has_role(auth.uid(),'authority')) with check (public.has_role(auth.uid(),'authority') and status in ('Pending','In Progress'));
create policy "reporter confirms" on public.issues for update to authenticated using (auth.uid() = reporter_id) with check (auth.uid() = reporter_id);

alter publication supabase_realtime add table public.issues;

create policy "upload own photos" on storage.objects for insert to authenticated with check (bucket_id = 'issue-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "read photos" on storage.objects for select using (bucket_id = 'issue-photos');