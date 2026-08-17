-- A trigger function is compiled against the shape of the first trigger relation.
-- The previous shared function referenced NEW.id and NEW.transaction_id, so a deferred
-- invocation from the other relation failed with "column new does not exist".
CREATE FUNCTION enforce_balanced_ledger_transaction_from_transaction() RETURNS trigger AS $$
DECLARE
  entry_count INTEGER;
  entry_sum NUMERIC;
  invalid_wallet_count INTEGER;
BEGIN
  SELECT COUNT(*), COALESCE(SUM("amount_minor"), 0)
    INTO entry_count, entry_sum FROM "ledger_entries" WHERE "transaction_id" = NEW.id;
  IF entry_count < 2 OR entry_sum <> 0 THEN
    RAISE EXCEPTION 'ledger transaction % must contain at least two balanced entries', NEW.id;
  END IF;
  SELECT COUNT(*) INTO invalid_wallet_count
  FROM "ledger_entries" entry
  JOIN "wallets" wallet ON wallet.id = entry.wallet_id
  JOIN "ledger_transactions" transaction ON transaction.id = entry.transaction_id
  WHERE entry.transaction_id = NEW.id
    AND (wallet.family_id <> transaction.family_id OR wallet.currency <> transaction.currency);
  IF invalid_wallet_count > 0 THEN
    RAISE EXCEPTION 'ledger transaction % contains a wallet from another family or currency', NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION enforce_balanced_ledger_transaction_from_entry() RETURNS trigger AS $$
DECLARE
  entry_count INTEGER;
  entry_sum NUMERIC;
  invalid_wallet_count INTEGER;
BEGIN
  SELECT COUNT(*), COALESCE(SUM("amount_minor"), 0)
    INTO entry_count, entry_sum FROM "ledger_entries" WHERE "transaction_id" = NEW.transaction_id;
  IF entry_count < 2 OR entry_sum <> 0 THEN
    RAISE EXCEPTION 'ledger transaction % must contain at least two balanced entries', NEW.transaction_id;
  END IF;
  SELECT COUNT(*) INTO invalid_wallet_count
  FROM "ledger_entries" entry
  JOIN "wallets" wallet ON wallet.id = entry.wallet_id
  JOIN "ledger_transactions" transaction ON transaction.id = entry.transaction_id
  WHERE entry.transaction_id = NEW.transaction_id
    AND (wallet.family_id <> transaction.family_id OR wallet.currency <> transaction.currency);
  IF invalid_wallet_count > 0 THEN
    RAISE EXCEPTION 'ledger transaction % contains a wallet from another family or currency', NEW.transaction_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER "ledger_transaction_balanced_on_transaction" ON "ledger_transactions";
DROP TRIGGER "ledger_transaction_balanced_on_entry" ON "ledger_entries";

CREATE CONSTRAINT TRIGGER "ledger_transaction_balanced_on_transaction"
AFTER INSERT ON "ledger_transactions" DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION enforce_balanced_ledger_transaction_from_transaction();

CREATE CONSTRAINT TRIGGER "ledger_transaction_balanced_on_entry"
AFTER INSERT ON "ledger_entries" DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION enforce_balanced_ledger_transaction_from_entry();
