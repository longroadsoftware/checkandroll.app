# checkandroll.app

The Check & Roll website: product page, privacy policy and support page. Static files hosted on **Cloudflare Pages** (project `checkandroll-app`, account mediaflowswift@gmail.com) since 2026-11-11; every merge to `main` deploys in about 30 seconds. `_headers` sets response headers and `_redirects` holds permanent redirects (`/old/ /new/ 301`). `wrangler.jsonc` holds the Pages settings (it replaces the dashboard's). DNS for checkandroll.app is on Cloudflare; www 301s to the apex. The domain is still registered at GoDaddy.

- `index.html` — product page with the "email me when it's on the App Store" form (Kit form 10079048). Google Analytics loads only after the visitor says yes (`analytics.js`).
- `functions/_middleware.js` — counts, per day, where page visits came from (YouTube, a search engine, direct…), with country and phone/computer, in the D1 database `lrs-traffic`; nothing about the visitor is kept (LON-3645). The rules are a copy of mediaflowswift.com's `cloudflare/traffic.js` (`functions/_lib/traffic.js`): keep them in step. `_routes.json` keeps images and other files out of it. The totals come out of mediaflowswift.com/api/traffic-stats. Tests: `node --test tests/*.test.mjs`.
- `privacy/` — the app's privacy policy. The App Store listing links here. Change the "Last updated" date with every edit.
- `support/` — support page. The app's Settings › Help and Support opens it.
- `site.css`, `favicon.svg`, `analytics.js`, `images/` — copied from longroadsoftware.com on 2026-10-25. Keep them in step by hand.

These pages lived at longroadsoftware.com/check-and-roll/ until 2026-10-25; those addresses now forward here.

`.app` domains only load over HTTPS; Cloudflare's certificate and "Always Use HTTPS" cover it.
