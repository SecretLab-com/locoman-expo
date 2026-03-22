-- Allow trainers to archive clients they no longer work with (separate from inactive).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'client_status'
      AND e.enumlabel = 'hidden'
  ) THEN
    ALTER TYPE client_status ADD VALUE 'hidden';
  END IF;
END
$$;
