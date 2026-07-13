# The Closet — Inventory Tracker

A live inventory tracker for a shared arts-&-crafts closet.

- **Guests** (no login) see the live dashboard, take items, and request returns.
- **Admins** (password) add/remove items, manage categories, and confirm returns.

Built with **Next.js** + **Supabase** (database, image storage, realtime). Deploys free to **Vercel**.

## Setup

Full step-by-step instructions are in **`DEPLOYMENT_INSTRUCTIONS.md`**, located one folder up from this app folder.

Quick version:
1. Create a free Supabase project and run `supabase-setup.sql` in its SQL Editor.
2. Copy `.env.local.example` → `.env.local` and fill in your keys (or set them in Vercel).
3. `npm install && npm run dev` to run locally, or import the repo into Vercel to deploy.

## Environment variables

| Variable | What it is |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (secret) |
| `ADMIN_PASSWORD` | Password that unlocks admin mode |
| `ADMIN_SESSION_SECRET` | Any long random string (signs the login cookie) |
