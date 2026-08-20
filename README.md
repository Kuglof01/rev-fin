# Spendly

A multi-user spending tracker built with Next.js, Supabase Auth/Postgres, Tailwind CSS and Recharts.

## Features
- Email/password account creation and login
- Per-user purchases, categories and subcategories
- Supabase Row Level Security: users can only read/write their own data
- Automatic cross-device synchronization
- Pie and bar charts with category -> subcategory drill-down
- Date filters, editing and deleting

## Supabase setup
1. Create a free Supabase project.
2. In SQL Editor, run `supabase/schema.sql`.
3. In Authentication -> Providers, enable Email.
4. For easiest testing, disable email confirmation; for a public app, configure email confirmation/SMTP as desired.
5. Copy `.env.example` to `.env.local` and add the project URL and anon/publishable key.
6. Run `npm install` and `npm run dev`.

Supabase's current Free plan includes Postgres, Auth, 500 MB database storage and up to 50,000 monthly active users. Free projects may pause after 1 week of inactivity.

## Free hosting/domain
Deploy the Next.js app to Cloudflare Pages/Workers or another free host. A free `*.pages.dev` project address can be used without buying a domain. A custom `.com`/`.hu` domain is normally not free.
