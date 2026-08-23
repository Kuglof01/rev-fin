# Spendly

Multi-user spending tracker with Next.js, Supabase Auth/Postgres, Tailwind and Recharts.

## Important fixes
- Cloudflare/OpenNext build recursion fixed: `package.json` `build` is now only `next build`.
- Cloudflare Workers Builds should use `npx @opennextjs/cloudflare build`.
- Supabase browser configuration is available during the Next.js build; the project uses public publishable/anon credentials and RLS for security.
- Category/subcategory/purchase CRUD now reports every Supabase error instead of silently swallowing it.
- Dashboard loading reports missing tables, RLS failures and other database errors with a Retry button.
- New users get default categories/subcategories. Existing accounts with no categories are repaired by the SQL migration.
- Database triggers prevent cross-user category/subcategory relationships.
- Category deletion correctly reports the foreign-key error when purchases still use it.
- Subcategory deletion is supported. Existing purchases keep their category and simply lose that subcategory.

## Supabase
Run all of `supabase/schema.sql` in Supabase SQL Editor. It is designed to be rerunnable. Enable Email under Authentication -> Providers.

## Cloudflare
This is a Next.js Worker using OpenNext, not a static Pages export. In Workers Builds use:

- Build command: `npx @opennextjs/cloudflare build`
- Deploy command: `npx @opennextjs/cloudflare deploy`
- Production branch: `main`

Cloudflare's current Next.js/OpenNext docs require build variables for `NEXT_PUBLIC_*` values because Next.js inlines them during the build. The project includes `.env.production` with the configured public Supabase values; you can instead configure the same variables in Cloudflare Build Variables and secrets.

Never add a Supabase `service_role`/secret key to the browser project.
