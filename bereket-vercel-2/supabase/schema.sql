-- Bereket veritabanı. Supabase → SQL Editor → New query → bu dosyanın tamamını yapıştır → Run.

create table if not exists public.accounts (
  username     text primary key,
  role         text not null check (role in ('restoran', 'belediye')),
  district_key text not null,
  salt         text not null,
  hash         text not null,
  demo_v       text,
  created_at   timestamptz not null default now()
);
create index if not exists accounts_district_idx on public.accounts (district_key);

create table if not exists public.app_data (
  username   text primary key references public.accounts (username) on delete cascade,
  data       jsonb not null,
  version    integer not null default 1,
  updated_at timestamptz not null default now()
);

-- Güvenlik: tablolara tarayıcıdan doğrudan erişim kapalı.
-- Hiç kural (policy) tanımlanmadığı için yalnızca Vercel'deki sunucu fonksiyonları (gizli anahtarla) okuyup yazabilir.
alter table public.accounts enable row level security;
alter table public.app_data enable row level security;
revoke all on public.accounts from anon, authenticated;
revoke all on public.app_data from anon, authenticated;

-- v2: Fotoğraflar (telefondan yüklenen atık fotoğrafının küçültülmüş kopyası)
create table if not exists public.photos (
  id         text primary key,
  username   text not null references public.accounts (username) on delete cascade,
  entry_id   text not null,
  type       text not null default 'image/jpeg',
  data       text not null,
  created_at timestamptz not null default now()
);
create index if not exists photos_user_idx on public.photos (username);
alter table public.photos enable row level security;
revoke all on public.photos from anon, authenticated;
