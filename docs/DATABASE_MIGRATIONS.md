# Database migrations (Supabase)

SQL migrations live in `supabase/migrations/`. Apply them to the **same** Supabase project your `.env` / `EXPO_PUBLIC_*` vars point at.

## “Could not find the table `public.saved_cart_proposals` in the schema cache”

That means PostgREST (Supabase API) does not see the saved-cart tables yet. They are created in:

`supabase/migrations/023_saved_cart_proposals.sql`

### Option A — Run the SQL file with repo credentials (recommended when `db push` fails)

If `supabase db push` errors with **remote migration versions not found in local migrations directory**, you can still apply this migration directly.

Requirements: `.env` has `SUPABASE_DATABASE_PASSWORD`, `psql` installed, `supabase link` has created `supabase/.temp/project-ref`.

```bash
cd /path/to/locoman-expo
node scripts/run-supabase-sql.mjs supabase/migrations/023_saved_cart_proposals.sql
```

If the API still returns a schema-cache error, run `NOTIFY pgrst, 'reload schema';` once in the SQL Editor (or wait a minute).

### Option B — Supabase CLI

```bash
cd /path/to/locoman-expo
npx supabase db push
```

If push fails due to migration history drift, use Option A or the SQL Editor. See [Supabase CLI docs](https://supabase.com/docs/guides/cli).

### Option C — Supabase Dashboard

1. Open **SQL Editor** in the Supabase dashboard.
2. Paste the full contents of `supabase/migrations/023_saved_cart_proposals.sql`.
3. Run the script.
4. If the API still errors, wait a minute or reload the API schema (hosted projects usually refresh automatically). You can also run:

   ```sql
   NOTIFY pgrst, 'reload schema';
   ```

### Dependencies

Migration `023` expects prior migrations (e.g. `users`, `clients`, `bundle_drafts`, `products`, `trainer_custom_products`, `invitations`, `orders`, `order_items`). Apply migrations **in numeric order** if this is a fresh database.

## Verify

In SQL Editor:

```sql
SELECT to_regclass('public.saved_cart_proposals');
```

You should get `saved_cart_proposals` (not `null`).
