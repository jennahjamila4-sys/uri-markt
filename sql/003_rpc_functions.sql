-- 003_rpc_functions.sql
-- Beispiel-RPCs: award_xp, process_transaction_commission

create table if not exists xp_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  amount int not null,
  reason text,
  idempotency_key text,
  created_at timestamptz default now()
);

create or replace function award_xp(p_user_id uuid, p_amount int, p_reason text, p_idempotency_key text)
returns void language plpgsql as $$
begin
  if exists (select 1 from xp_log where idempotency_key = p_idempotency_key) then
    return;
  end if;

  insert into xp_log (user_id, amount, reason, idempotency_key) values (p_user_id, p_amount, p_reason, p_idempotency_key);
  update profiles set xp_points = coalesce(xp_points,0) + p_amount where id = p_user_id;
end;
$$;

create or replace function process_transaction_commission(p_tx_id uuid)
returns void language plpgsql as $$
begin
  -- Implement commission logic (transfer, ledger entries, notifications)
  perform 1;
end;
$$;
