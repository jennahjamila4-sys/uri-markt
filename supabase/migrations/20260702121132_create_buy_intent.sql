-- create_buy_intent — Kaufabsicht serverseitig & atomar anlegen
-- ---------------------------------------------------------------------------
-- Grund: Die Funktion fehlte in der Live-DB → `createBuyIntentAction` lief ins
-- Leere ("Kaufanfrage fehlgeschlagen"). KEIN Client-Insert, weil
--   1) der Käufer per RLS das fremde Inserat nicht auf `reserved` setzen darf, und
--   2) Betrag/Provision niemals vom Client kommen dürfen.
-- Deshalb SECURITY DEFINER: läuft mit Owner-Rechten, umgeht die Käufer-RLS
-- für die Reservierung, setzt buyer_id fest auf auth.uid().
--
-- Einheiten (verifiziert gegen die Live-DB, nicht geraten):
--   * transactions.amount     = Listenpreis in CHF (was der Käufer zahlt)
--   * transactions.commission = 10 % des Preises in TALERN (Verkäufer-Kosten)
--   * profiles.credits        = Rappen (bigint); 1 Taler = 100 credits
--   * process_transaction_commission zieht commission*100 Rappen vom Verkäufer ab
--     (Test bestätigt: commission 10 → credits 10000 → 9000, also 1000 Rappen).
--   => commission hier in Talern (price * 0.1) halten, konsistent zur Abzug-RPC.
-- ---------------------------------------------------------------------------

create or replace function public.create_buy_intent(
  p_listing_id uuid,
  p_payment_method text,
  p_buyer_contact text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_buyer_id uuid := auth.uid();
  v_listing record;
  v_buyer record;
  v_commission numeric;
  v_tx_id uuid;
begin
  if v_buyer_id is null then
    return jsonb_build_object('success', false, 'error', 'Nicht angemeldet');
  end if;

  -- Inserat serverseitig laden
  select id, user_id, price, status, title
    into v_listing
  from listings
  where id = p_listing_id;

  if v_listing.id is null then
    return jsonb_build_object('success', false, 'error', 'Inserat nicht gefunden');
  end if;

  if v_listing.status <> 'active' then
    return jsonb_build_object('success', false, 'error', 'Inserat ist nicht mehr verfügbar');
  end if;

  if v_listing.user_id = v_buyer_id then
    return jsonb_build_object('success', false, 'error', 'Du kannst dein eigenes Inserat nicht kaufen');
  end if;

  -- Käufer-Status prüfen
  select can_buy, is_banned
    into v_buyer
  from profiles
  where id = v_buyer_id;

  if coalesce(v_buyer.is_banned, false) or not coalesce(v_buyer.can_buy, true) then
    return jsonb_build_object('success', false, 'error', 'Kauf derzeit nicht erlaubt');
  end if;

  -- amount = Preis (Käufer zahlt NUR den Preis), commission = 10 % in Talern
  -- (separate Verkäufer-Kosten, NICHT auf amount addiert)
  v_commission := round(coalesce(v_listing.price, 0) * 0.1, 2);

  insert into transactions (
    buyer_id, seller_id, listing_id, amount, commission,
    payment_method, buyer_contact, status
  )
  values (
    v_buyer_id, v_listing.user_id, p_listing_id,
    coalesce(v_listing.price, 0), v_commission,
    p_payment_method, p_buyer_contact, 'pending'
  )
  returning id into v_tx_id;

  -- Inserat atomar reservieren (im selben Aufruf)
  update listings set status = 'reserved' where id = p_listing_id;

  -- Verkäufer benachrichtigen (Live-Signatur: recipient/title/message/type/listing)
  perform send_notification(
    v_listing.user_id,
    '⚡ Neue Kaufanfrage!',
    'Jemand möchte „' || v_listing.title || '" kaufen.',
    'tx_pending',
    p_listing_id
  );

  return jsonb_build_object('success', true, 'transaction_id', v_tx_id);
end;
$$;

grant execute on function public.create_buy_intent(uuid, text, text) to authenticated;
