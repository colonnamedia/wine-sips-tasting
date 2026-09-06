# Sips — Wine Tasting Journey build notes

This is the non-secret operating record for the project. Never add passwords, API keys, database passwords, recovery codes, or service-role keys to this file.

## Accounts and services

| Purpose | Service | Account or location |
| --- | --- | --- |
| Project email | Yahoo Mail | `sipswine@yahoo.com` |
| Source code | GitHub | `colonnamedia/wine-sips-tasting` |
| Hosting | Vercel | GitHub-connected project; production URL currently `https://wine-sips-tasting.vercel.app` |
| Authentication and database | Supabase | Project created; browser credentials belong in Vercel environment variables |
| Transactional email | Resend | Account created; connect to Supabase custom SMTP before public launch |

## Vercel environment variables

Add these to Production, Preview, and Development:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
```

Only use Supabase's public project URL and publishable key. Never expose its service-role key in Vercel browser variables.

## Supabase setup order

Run these in the Supabase SQL Editor in order:

1. `supabase/schema.sql`
2. `supabase/trips-ratings.sql`
3. `supabase/winery-admin.sql`

The last script grants Sips administrator access to the Supabase Auth account whose email is `sipswine@yahoo.com`. If that account is created after the script runs, rerun the final `update public.profiles ...` statement.

## Winery workflow

1. A winery representative creates a standard Sips account at `/winery-login` and submits a claim.
2. The Sips administrator signs in at `/winery-dashboard` and approves or declines the claim.
3. Approval creates the winery membership and gives that user access only to their winery.
4. The winery builds a draft manually or uploads the dashboard's CSV template.
5. Publishing replaces the winery's previous public menu; drafts and archived menus remain private.
6. The public `/wine-tasting` page automatically displays the published menu and its rateable wines.

## CSV menu columns

```text
flight_name,vintage,wine_name,varietal,style,bottle_price,description,award,purchase_url,in_stock,sort_order
```

`wine_name` is required. `in_stock` accepts `true`, `false`, `yes`, `no`, `1`, `0`, or `sold out`. Prices should be numbers without currency symbols when possible.

## Security model

- Supabase Auth handles all customer and winery sign-ins.
- Row-level security keeps each winery's drafts and imports visible only to approved staff and Sips administrators.
- Anonymous visitors can read active winery profiles and published menus only.
- Winery claims require manual approval; submitting a claim never grants access by itself.
- The winery dashboard is marked `noindex, nofollow` and is omitted from the sitemap.

## Current launch checklist

- Confirm both Supabase environment variables are present in Vercel.
- Run all three SQL files.
- Register and confirm `sipswine@yahoo.com`, then verify it has the `sips_admin` profile role.
- Configure Resend as Supabase custom SMTP and verify the sending domain.
- Submit a test winery claim, approve it, import a CSV, publish it, and confirm the menu appears publicly.
- Replace prototype menus with winery-approved data before promoting those listings as current.
