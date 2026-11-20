alter table public.menu
  add column if not exists availability_mode text not null default 'manual'
  check (availability_mode in ('manual', 'automatic'));
