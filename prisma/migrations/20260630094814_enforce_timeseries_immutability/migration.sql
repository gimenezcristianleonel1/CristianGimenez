-- Enforce append-only (immutable) time-series tables at the database level.
-- Domain rule: WeightHistory, HealthRecord and AnimalMovement records are
-- never UPDATEd; new facts are always INSERTed with their own timestamp.
-- This protects data integrity for future ML/IA training pipelines.

CREATE OR REPLACE FUNCTION prevent_row_update() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION
    'Table % is an append-only time-series; UPDATE is not allowed. Insert a new record instead.',
    TG_TABLE_NAME
    USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER weight_history_no_update
  BEFORE UPDATE ON "weight_history"
  FOR EACH ROW EXECUTE FUNCTION prevent_row_update();

CREATE TRIGGER health_records_no_update
  BEFORE UPDATE ON "health_records"
  FOR EACH ROW EXECUTE FUNCTION prevent_row_update();

CREATE TRIGGER animal_movements_no_update
  BEFORE UPDATE ON "animal_movements"
  FOR EACH ROW EXECUTE FUNCTION prevent_row_update();
