-- 010_constraints.sql
-- Add composite uniqueness and check constraints

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'allocations_node_port_unique'
  ) THEN
    ALTER TABLE allocations ADD CONSTRAINT allocations_node_port_unique UNIQUE (node_id, port);
  END IF;
END $$;
