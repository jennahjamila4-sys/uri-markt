-- 003_rpc_functions.sql
-- Wichtige RPCs: award_xp, process_transaction_commission, send_notification, escalate_no_show

-- Helper function: calculate level from XP
create or replace function calculate_level(p_xp_points int)
returns text language plpgsql as $$
declare
  v_level text;
begin
  case
    when p_xp_points < 50 then v_level := 'Beobachter';
    when p_xp_points < 200 then v_level := 'Dorf-Händler';
    when p_xp_points < 500 then v_level := 'Lokal-Matador';
    when p_xp_points < 1000 then v_level := 'Kantons-Legende';
    else v_level := 'Gotthard-Titan';
  end case;
  return v_level;
end;
$$;

-- Award XP with idempotency
create or replace function award_xp(
  p_user_id uuid,
  p_amount int,
  p_reason text,
  p_idempotency_key text
)
returns jsonb language plpgsql as $$
declare
  v_result jsonb;
  v_new_xp int;
  v_new_level text;
begin
  -- Idempotency check
  if exists (select 1 from xp_log where idempotency_key = p_idempotency_key) then
    return jsonb_build_object('success', false, 'error', 'Already awarded');
  end if;

  -- Insert into log
  insert into xp_log (user_id, amount, reason, idempotency_key)
  values (p_user_id, p_amount, p_reason, p_idempotency_key);

  -- Update profile XP and level
  update profiles
  set xp_points = coalesce(xp_points, 0) + p_amount,
      level = calculate_level(coalesce(xp_points, 0) + p_amount)
  where id = p_user_id
  returning xp_points, level into v_new_xp, v_new_level;

  v_result := jsonb_build_object(
    'success', true,
    'xp_gained', p_amount,
    'new_xp', v_new_xp,
    'new_level', v_new_level,
    'reason', p_reason
  );

  return v_result;
end;
$$;

-- Process transaction commission (seller gets paid minus 10% commission in Taler)
create or replace function process_transaction_commission(
  p_transaction_id uuid,
  p_seller_id uuid
)
returns jsonb language plpgsql as $$
declare
  v_tx record;
  v_seller_taler_balance numeric;
  v_result jsonb;
begin
  -- Get transaction
  select * into v_tx from transactions where id = p_transaction_id;
  if v_tx is null then
    return jsonb_build_object('success', false, 'error', 'Transaction not found');
  end if;

  if v_tx.seller_id != p_seller_id then
    return jsonb_build_object('success', false, 'error', 'Not authorized');
  end if;

  if v_tx.status != 'pending' then
    return jsonb_build_object('success', false, 'error', 'Transaction already processed');
  end if;

  -- Check if seller has enough Taler to pay commission
  select coalesce(credits, 0) into v_seller_taler_balance
  from profiles where id = p_seller_id;

  if v_seller_taler_balance < v_tx.commission then
    return jsonb_build_object('success', false, 'error', 'Insufficient Taler balance', 'balance', v_seller_taler_balance, 'needed', v_tx.commission);
  end if;

  -- Deduct commission from seller's Taler balance
  update profiles
  set credits = coalesce(credits, 0) - v_tx.commission
  where id = p_seller_id;

  -- Mark transaction as confirmed
  update transactions
  set status = 'confirmed',
      confirmed_at = now()
  where id = p_transaction_id;

  v_result := jsonb_build_object(
    'success', true,
    'message', 'Commission processed',
    'amount', v_tx.amount,
    'commission', v_tx.commission
  );

  return v_result;
end;
$$;

-- Send notification via RPC (bypasses RLS restrictions)
create or replace function send_notification(
  p_recipient_id uuid,
  p_title text,
  p_message text,
  p_type text,
  p_listing_id uuid default null
)
returns jsonb language plpgsql as $$
declare
  v_notification_id uuid;
  v_payload jsonb;
begin
  v_payload := jsonb_build_object(
    'title', p_title,
    'message', p_message,
    'listing_id', p_listing_id,
    'timestamp', now()
  );

  insert into notifications (
    user_id,
    type,
    payload,
    read
  )
  values (p_recipient_id, p_type, v_payload, false)
  returning id into v_notification_id;

  return jsonb_build_object('success', true, 'notification_id', v_notification_id);
end;
$$;

-- Escalate no-show (refund commission, add strike)
create or replace function escalate_no_show(
  p_transaction_id uuid,
  p_seller_id uuid
)
returns jsonb language plpgsql as $$
declare
  v_tx record;
  v_result jsonb;
begin
  select * into v_tx from transactions where id = p_transaction_id;
  if v_tx is null then
    return jsonb_build_object('success', false, 'error', 'Transaction not found');
  end if;

  if v_tx.seller_id != p_seller_id then
    return jsonb_build_object('success', false, 'error', 'Not authorized');
  end if;

  -- Refund commission to seller
  update profiles
  set credits = coalesce(credits, 0) + v_tx.commission
  where id = p_seller_id;

  -- Add strike to buyer
  update profiles
  set strikes = coalesce(strikes, 0) + 1
  where id = v_tx.buyer_id;

  -- Mark transaction as no-show
  update transactions
  set status = 'no_show',
      no_show_reported_at = now()
  where id = p_transaction_id;

  v_result := jsonb_build_object('success', true, 'message', 'No-show recorded');
  return v_result;
end;
$$;

-- Create buy intent (for createBuyIntent server action)
create or replace function create_buy_intent(
  p_buyer_id uuid,
  p_listing_id uuid,
  p_payment_method text,
  p_buyer_contact text
)
returns jsonb language plpgsql as $$
declare
  v_listing record;
  v_buyer_profile record;
  v_commission numeric;
  v_tx_id uuid;
begin
  -- Get listing
  select id, user_id, price, status, title into v_listing
  from listings where id = p_listing_id;

  if v_listing is null or v_listing.status != 'active' then
    return jsonb_build_object('success', false, 'error', 'Listing not available');
  end if;

  if v_listing.user_id = p_buyer_id then
    return jsonb_build_object('success', false, 'error', 'Cannot buy own listing');
  end if;

  -- Check buyer profile
  select can_buy, is_banned into v_buyer_profile
  from profiles where id = p_buyer_id;

  if not v_buyer_profile.can_buy or v_buyer_profile.is_banned then
    return jsonb_build_object('success', false, 'error', 'Not allowed to buy');
  end if;

  -- Calculate commission (10%)
  v_commission := ((v_listing.price::numeric / 100) * 10)::numeric(12,2);

  -- Create transaction
  insert into transactions (
    buyer_id,
    seller_id,
    listing_id,
    amount,
    commission,
    payment_method,
    buyer_contact,
    status
  )
  values (p_buyer_id, v_listing.user_id, p_listing_id, v_listing.price, v_commission, p_payment_method, p_buyer_contact, 'pending')
  returning id into v_tx_id;

  -- Reserve listing
  update listings set status = 'reserved' where id = p_listing_id;

  -- Send notification to seller
  perform send_notification(
    v_listing.user_id,
    '⚡ Neue Kaufanfrage!',
    'Jemand möchte "' || v_listing.title || '" kaufen.',
    'tx_pending',
    p_listing_id
  );

  return jsonb_build_object('success', true, 'transaction_id', v_tx_id);
end;
$$;
