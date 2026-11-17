// Who sent us visitors to checkandroll.app (LON-3645, approved by Mike 2026-11-12).
//
// The same counting rules as mediaflowswift.com (longroadsoftware/mediaflowswift.com,
// cloudflare/traffic.js), copied because the two sites deploy separately. Keep them in step.
// Counts, per day, how many visits ARRIVED from each kind of source, with no cookie and nothing
// kept about the visitor: only daily totals in the D1 database `lrs-traffic`, which
// mediaflowswift.com/api/traffic-stats already reports for every site.
//
// Never stored: IP address, full referrer URL or its path, user agent, any id. The IP is only
// compared in memory with the family's home addresses (EXCLUDE_IPS), like lrs-downloads does.
//
// Not copied: the `src`/`med`/`cmp` link tagging. It exists so lrs-downloads can credit a
// download to its source, and this site has no download (the app comes from the App Store).
// A request that carries `src` is still never counted as a new visit.

export const BOT_UA = /bot|crawl|spider|slurp|preview|facebookexternalhit|curl|wget|python|httpclient|headless|okhttp|go-http|java\/|monitor|uptime|lighthouse|scan|fetch|axios|node|ruby|perl|php|libwww|httpx|aiohttp|scrapy|phantom|selenium|puppeteer|playwright/i;

// Same rules as lrs-downloads (copied: the two Workers deploy separately).
export function chicagoDate(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

function v4ToBig(ip) {
  const p = ip.split(".");
  if (p.length !== 4 || p.some((x) => !/^\d{1,3}$/.test(x) || +x > 255)) return null;
  return p.reduce((a, x) => (a << 8n) | BigInt(+x), 0n);
}

function v6ToBig(ip) {
  if (!ip.includes(":")) return null;
  let [head, tail] = ip.split("::");
  if (ip.split("::").length > 2) return null;
  const h = head ? head.split(":") : [];
  const t = tail !== undefined ? (tail ? tail.split(":") : []) : null;
  let parts;
  if (t === null) parts = h;
  else parts = [...h, ...Array(8 - h.length - t.length).fill("0"), ...t];
  if (parts.length !== 8 || parts.some((x) => !/^[0-9a-f]{1,4}$/i.test(x))) return null;
  return parts.reduce((a, x) => (a << 16n) | BigInt(parseInt(x, 16)), 0n);
}

/** true when ip is inside one of the comma-separated CIDRs (IPv4 or IPv6). */
export function ipExcluded(ip, list) {
  if (!ip || !list) return false;
  for (const raw of list.split(",")) {
    const cidr = raw.trim();
    if (!cidr) continue;
    const [net, lenStr] = cidr.split("/");
    const v6 = net.includes(":");
    const bits = v6 ? 128 : 32;
    const len = lenStr === undefined ? bits : +lenStr;
    const a = v6 ? v6ToBig(ip) : v4ToBig(ip);
    const b = v6 ? v6ToBig(net) : v4ToBig(net);
    if (a === null || b === null || !(len >= 0 && len <= bits)) continue;
    const shift = BigInt(bits - len);
    if (a >> shift === b >> shift) return true;
  }
  return false;
}

const clean = (s, max = 40) => String(s || "").toLowerCase().replace(/[^a-z0-9._-]/g, "").slice(0, max);

// Referrer host -> source. Host only; the path is never looked at or kept.
const HOSTS = [
  [/(^|\.)(googleads\.g\.doubleclick\.net|doubleclick\.net|googlesyndication\.com|googleadservices\.com)$/, "youtube", "paid"],
  [/(^|\.)(youtube\.com|youtu\.be|youtube-nocookie\.com)$/, "youtube", "video"],
  [/(^|\.)google\.[a-z.]+$/, "google", "organic"],
  [/(^|\.)bing\.com$/, "bing", "organic"],
  [/(^|\.)duckduckgo\.com$/, "duckduckgo", "organic"],
  [/(^|\.)(search\.)?yahoo\.[a-z.]+$/, "yahoo", "organic"],
  [/(^|\.)ecosia\.org$/, "ecosia", "organic"],
  [/(^|\.)search\.brave\.com$/, "brave", "organic"],
  [/(^|\.)(facebook\.com|fb\.me|fb\.com)$/, "facebook", "social"],
  [/(^|\.)instagram\.com$/, "instagram", "social"],
  [/(^|\.)(t\.co|x\.com|twitter\.com)$/, "x", "social"],
  [/(^|\.)(reddit\.com|redd\.it)$/, "reddit", "forum"],
  [/(^|\.)tiktok\.com$/, "tiktok", "social"],
  [/(^|\.)(linkedin\.com|lnkd\.in)$/, "linkedin", "social"],
  [/(^|\.)(chatgpt\.com|chat\.openai\.com)$/, "ai-chatgpt", "ai"],
  [/(^|\.)perplexity\.ai$/, "ai-perplexity", "ai"],
  [/(^|\.)claude\.ai$/, "ai-claude", "ai"],
  [/(^|\.)gemini\.google\.com$/, "ai-gemini", "ai"],
  [/(^|\.)copilot\.microsoft\.com$/, "ai-copilot", "ai"],
  [/(^|\.)news\.ycombinator\.com$/, "hackernews", "forum"],
  [/(^|\.)peerpush\.(com|net)$/, "peerpush", "referral"],
  [/(^|\.)alternativeto\.net$/, "alternativeto", "referral"],
  [/(^|\.)producthunt\.com$/, "producthunt", "referral"],
  [/(^|\.)longroadsoftware\.com$/, "longroadsoftware", "referral"],
  [/(^|\.)checkandroll\.app$/, "checkandroll", "referral"],
  [/(^|\.)mediaflowswift\.com$/, "mediaflowswift", "referral"],
  [/(^|\.)onislandtime\.life$/, "onislandtime", "referral"],
  [/(^|\.)github\.com$/, "github", "referral"],
];

export function mapHost(host) {
  host = String(host || "").toLowerCase().replace(/^www\./, "");
  if (host.startsWith("gemini.google.")) return { source: "ai-gemini", medium: "ai" };
  for (const [re, source, medium] of HOSTS) if (re.test(host)) return { source, medium };
  return { source: clean(host, 60) || "unknown", medium: "referral" };
}

/** Where this landing came from: utm tags first, then a Google Ads click id, then the referrer host. */
export function sourceOf(url, referer, ownHost) {
  const q = url.searchParams;
  if (q.get("utm_source")) {
    return { source: clean(q.get("utm_source")) || "unknown", medium: clean(q.get("utm_medium")), campaign: clean(q.get("utm_campaign")) };
  }
  // The YouTube promotions carry no utm tag (Mike left them as they are). Google adds a click id.
  if (q.get("gclid") || q.get("gad_source") || q.get("gbraid") || q.get("wbraid") || q.get("gad_campaignid")) {
    return { source: "youtube", medium: "paid", campaign: clean(q.get("gad_campaignid") || q.get("utm_campaign")) };
  }
  let host = "";
  try { host = referer ? new URL(referer).hostname : ""; } catch { host = ""; }
  if (!host) return { source: "direct", medium: "", campaign: "" };
  if (host.toLowerCase().replace(/^www\./, "") === ownHost) return null; // our own page: not a landing
  return { ...mapHost(host), campaign: "" };
}

/** "human", "us" (Mike/Sheri at home) or "bot". */
export function whoIs(request, env) {
  const ua = request.headers.get("User-Agent") || "";
  if (!ua || BOT_UA.test(ua)) return "bot";
  // Every real browser sends these; scripts and most scanners don't.
  if (!request.headers.get("Accept-Language")) return "bot";
  if (ipExcluded(request.headers.get("CF-Connecting-IP") || "", env.EXCLUDE_IPS || "")) return "us";
  return "human";
}

export const deviceOf = (ua) => (/Mobi|Android|iPhone|iPad|iPod/i.test(ua || "") ? "mobile" : "desktop");

/** What to count for this page request, or null when it is not a new landing. */
export function landingFor(request, env, ownHost) {
  if (request.method !== "GET") return null;
  const url = new URL(request.url);
  if (url.searchParams.get("src")) return null; // same visitor moving around the site
  const src = sourceOf(url, request.headers.get("Referer"), ownHost);
  if (!src) return null;
  const ua = request.headers.get("User-Agent") || "";
  return {
    who: whoIs(request, env),
    ...src,
    landing: url.pathname.slice(0, 80),
    country: clean((request.cf && request.cf.country) || "", 2) || "xx",
    device: deviceOf(ua),
  };
}

export async function recordVisit(db, site, day, v) {
  await db.prepare(
    `INSERT INTO visits (day, site, who, source, medium, campaign, landing, country, device, n)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 1)
     ON CONFLICT (day, site, who, source, medium, campaign, landing, country, device) DO UPDATE SET n = n + 1`
  ).bind(day, site, v.who, v.source, v.medium, v.campaign, v.landing, v.country, v.device).run();
}
