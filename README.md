# Sips — Wine Tasting Journey

A mobile-first, Vercel-ready interactive prototype for shared wine trips and tastings.

## Run locally

```bash
npm install
npm run dev
```

## Deploy to Vercel

Import this directory or its Git repository in Vercel. The included `vercel.json` supplies the single-page-app rewrite.

Winery coordinates are cached in `src/data/wineries.json`. Run `node scripts/geocode-wineries.mjs` after refreshing the state-license directory to geocode addresses with the U.S. Census Geocoder.

### Supabase authentication

1. In Supabase, open **SQL Editor** and run `supabase/schema.sql`.
2. In **Authentication → URL Configuration**, set the production Site URL and add the local and production redirect URLs.
3. Add the following variables to Vercel for Production, Preview, and Development:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
```

Use only the public project URL and publishable key in browser variables. Never expose the database password or service-role key.

The app supports account creation, email confirmation, login, logout, password reset, password recovery, and persistent browser sessions. Supabase's default authentication email service can be used during setup; configure Resend as custom SMTP before a public launch.

After the base schema succeeds, run `supabase/trips-ratings.sql`. It adds shareable owner-controlled trips, member-only personal ratings, and an automatic saved-wine record whenever a member rates a wine 5.

## Current prototype

- Interactive regional map with sample wineries
- Wine-region selector with Finger Lakes active and Napa Valley and Sonoma County marked coming soon
- Add/remove wineries from a shared trip
- Five-level behavioral wine ratings
- Winery profiles and current tasting flights
- Group tasting comparison
- Personal taste profile and saved history
- Device-local persistence for ratings and trips (cloud sync is the next build slice)
- Supabase registration, login, email confirmation, password reset and session persistence

The winery names and tasting data are representative placeholders. Replace them with verified data before a public launch.
