create extension if not exists "pgcrypto";

create table if not exists presets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  name text not null,
  pattern_id text not null,
  settings jsonb not null,
  is_public boolean not null default false,
  share_slug text unique,
  created_at timestamptz not null default now()
);

create index if not exists presets_user_created_at_idx on presets (user_id, created_at desc);
create unique index if not exists presets_share_slug_idx on presets (share_slug);
