# checkandroll.app

The Check & Roll website: product page, privacy policy and support page. Static files hosted on **Cloudflare Pages** (project `checkandroll-app`, account mediaflowswift@gmail.com) since 2026-11-11; every merge to `main` deploys in about 30 seconds. `_headers` sets response headers and `_redirects` holds permanent redirects (`/old/ /new/ 301`). DNS for checkandroll.app is on Cloudflare; www 301s to the apex. The domain is still registered at GoDaddy.

- `index.html` — product page with the "email me when it's on the App Store" form (Kit form 10079048). Google Analytics loads only after the visitor says yes (`analytics.js`).
- `privacy/` — the app's privacy policy. The App Store listing links here. Change the "Last updated" date with every edit.
- `support/` — support page. The app's Settings › Help and Support opens it.
- `site.css`, `favicon.svg`, `analytics.js`, `images/` — copied from longroadsoftware.com on 2026-10-25. Keep them in step by hand.

These pages lived at longroadsoftware.com/check-and-roll/ until 2026-10-25; those addresses now forward here.

`.app` domains only load over HTTPS; Cloudflare's certificate and "Always Use HTTPS" cover it.
