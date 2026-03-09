# Phyllo Social Program Backfill Notes

## What Was Implemented

- Added a one-off seed/backfill script at `scripts/seed-social-program.ts`.
- The script initializes social-program records for existing active trainers:
  - social membership
  - active campaign commitment
  - current-month commitment progress
  - baseline social profile

## Script Behavior

For each active trainer, the script:

1. Ensures a membership row exists in `trainer_social_memberships` (default `invited` if missing).
2. Ensures an active commitment exists in `trainer_social_campaign_commitments` with baseline KPI thresholds.
3. Ensures a progress row exists in `trainer_social_commitment_progress` for the current month.
4. Ensures a profile row exists in `trainer_social_profiles` with zeroed baseline metrics.
5. Prints structured summary stats at the end.

## Migration Step Performed

Applied remote migrations via:

- `supabase db push`

This included `011_phyllo_social_program.sql` (plus prior pending migrations), which created the required social tables in the remote DB.

## Backfill Execution

Executed:

- `pnpm tsx 'scripts/seed-social-program.ts'`

Final run result:

- `trainersScanned`: 6
- `membershipCreated`: 6
- `commitmentsCreated`: 6
- `progressCreated`: 6
- `profilesCreated`: 6
- `alreadyPresent`: 0
- `errors`: 0

## Notes

- The first seed attempt failed before migration because `trainer_social_memberships` did not exist in the remote schema.
- After `supabase db push`, re-running the seed completed successfully with zero errors.
