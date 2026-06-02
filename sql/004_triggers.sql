-- 004_triggers.sql
-- Utility triggers (created_at, search triggers etc.)

create or replace function set_created_at()
returns trigger language plpgsql as $$
begin
  if new.created_at is null then
    new.created_at := now();
  end if;
  return new;
end;
$$;

create trigger trg_set_created_at_profiles before insert on profiles
for each row execute function set_created_at();

create trigger trg_set_created_at_listings before insert on listings
for each row execute function set_created_at();
