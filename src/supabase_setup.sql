-- pixels table
create table if not exists public.pixels (
  x int not null,
  y int not null,
  color text not null,
  owner_id uuid,
  updated_at timestamptz default now(),
  primary key (x,y)
);

-- messages table (chat)
create table if not exists public.messages (
  id uuid default gen_random_uuid() primary key,
  user_id uuid,
  user_name text,
  text text,
  created_at timestamptz default now()
);

-- leaders table
create table if not exists public.leaders (
  user_id uuid primary key,
  user_name text,
  pixels int default 0,
  last_active timestamptz default now()
);

-- trigger function to maintain leaders counts on insert into pixels
create or replace function public.handle_pixel_upsert() returns trigger as $$
begin
  -- upsert leader row for the owner
  if (new.owner_id is not null) then
    insert into public.leaders (user_id, user_name, pixels, last_active)
    values (new.owner_id, coalesce(new.owner_id::text, 'Anon'), 1, now())
    on conflict (user_id) do update
      set pixels = leaders.pixels + 1,
          last_active = now();
  end if;
  return new;
end;
$$ language plpgsql security definer;

-- attach trigger AFTER INSERT on pixels
drop trigger if exists trg_handle_pixel_upsert on public.pixels;
create trigger trg_handle_pixel_upsert
  after insert on public.pixels
  for each row execute procedure public.handle_pixel_upsert();
