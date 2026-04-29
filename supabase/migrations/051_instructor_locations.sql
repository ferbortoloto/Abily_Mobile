create table if not exists instructor_locations (
  instructor_id uuid primary key references profiles(id) on delete cascade,
  latitude      float8      not null,
  longitude     float8      not null,
  heading       float4,
  updated_at    timestamptz not null default now()
);

alter table instructor_locations enable row level security;

-- Instructor can write their own location
create policy "instructor_own_location"
  on instructor_locations for all
  using  (auth.uid() = instructor_id)
  with check (auth.uid() = instructor_id);

-- Any authenticated user can read (only written while class is active)
create policy "authenticated_read_location"
  on instructor_locations for select
  using (auth.role() = 'authenticated');

-- Enable Realtime for live updates
alter publication supabase_realtime add table instructor_locations;
