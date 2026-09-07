# Sips — Wine Tasting Journey build notes

This is the non-secret operating record for the project. Never add passwords, API keys, database passwords, recovery codes, or service-role keys to this file.

## Accounts and services

| Purpose | Service | Account or location |
| --- | --- | --- |
| Project email | Yahoo Mail | `sipswine@yahoo.com` |
| Source code | GitHub | `colonnamedia/wine-sips-tasting` |
| Hosting | Vercel | GitHub-connected project; production domain `https://sipswinejourney.com` |
| Authentication and database | Supabase | Project created; browser credentials belong in Vercel environment variables |
| Transactional email | Resend | Account created; connect to Supabase custom SMTP before public launch |

## Deferred domain email setup

- Add `sipswinejourney.com` to Resend and verify the DNS records through Vercel.
- Use `accounts@sipswinejourney.com` as the Supabase Auth sender.
- Connect Resend custom SMTP in Supabase and brand confirmation/reset emails as **Sips — Wine Tasting Journey**.
- Set the Supabase Site URL to `https://sipswinejourney.com` and allow `https://sipswinejourney.com/**` as a redirect URL.
- Send a fresh signup, confirmation and password-reset test after configuration.

## Premium and verified rewards direction

- Launch target: `$7.99/month` with an optional `$4.99/month` founding-member price and annual plan later.
- A rating of 5 saves the wine to the member's **5-Sip Cellar**, enables direct winery purchase links, and supports scheduled or calendar reminders.
- Do not award points because a wine received a 5; doing so would bias ratings. Award points for verified winery visits and completed tasting flights regardless of score.
- Verify visits server-side using a one-mile geofence, acceptable GPS accuracy, timestamp and frequency limits. Add a rotating winery QR code or staff/receipt code as stronger verification.
- Unverified ratings can remain in a private journal, but only verified ratings affect public scores or rewards.
- Prefer digital or winery-funded rewards. Cap any Sips-funded reward cost at 10–15% of collected Premium revenue.
- Suggested starting awards: 20 points for a verified check-in, 10 for completing a flight, 10 for QR verification, 10 for a first visit to a new winery, and 25 for a verified partner purchase.
- Suggested rewards: digital badges/maps at 100–250 points, partner-funded tasting or merchandise upgrades at 500–750, and partner-funded order/shipping offers at 1,000–1,500.

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

## Regional explorer structure

Each wine territory gets its own Explore page, winery dataset, map position, SEO metadata, and directory-source disclosure. The New York State winery-license source belongs only to the Finger Lakes explorer and must not appear on future Napa Valley, Sonoma County, or other territory pages.

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
