// Runs in front of every checkandroll.app page (Cloudflare Pages Functions; _routes.json keeps
// images, video and other files out of it). The page is served exactly as before; when the page
// is a new visit from outside the site, one is added to that day's total for its source
// (functions/_lib/traffic.js, D1 `lrs-traffic`, daily totals only; LON-3645).
// Counting never slows or breaks a page: it runs after the response (waitUntil), and every
// error is caught. With no TRAFFIC binding (a preview, or D1 down) nothing is counted.
import { landingFor, recordVisit, chicagoDate } from "./_lib/traffic.js";

const SITE = "checkandroll.app";

export async function onRequest(context) {
  const resp = await context.next();
  try {
    const { request, env } = context;
    const type = resp.headers.get("Content-Type") || "";
    if (env.TRAFFIC && resp.status === 200 && type.startsWith("text/html")) {
      const landing = landingFor(request, env, SITE);
      if (landing) {
        context.waitUntil(recordVisit(env.TRAFFIC, SITE, chicagoDate(), landing).catch((e) => console.error("visit count failed", String(e))));
      }
    }
  } catch (e) {
    console.error("traffic failed", String(e));
  }
  return resp;
}
