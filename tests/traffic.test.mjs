// node --test tests/*.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { sourceOf, mapHost, landingFor, whoIs } from "../functions/_lib/traffic.js";
import { onRequest } from "../functions/_middleware.js";

const SITE = "checkandroll.app";
const ENV = { EXCLUDE_IPS: "50.42.107.18/32,2001:1960:6800:88df::/64" };
const PHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1";
const MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";
const req = (path, h = {}, cf) => {
  const r = new Request("https://checkandroll.app" + path, {
    headers: { "User-Agent": MAC, "Accept-Language": "en-US", "CF-Connecting-IP": "41.0.0.1", ...h },
  });
  if (cf) Object.defineProperty(r, "cf", { value: cf });
  return r;
};
const src = (path, referer) => sourceOf(new URL("https://checkandroll.app" + path), referer, SITE);

test("referrer hosts map to sources", () => {
  const cases = {
    "www.youtube.com": "youtube", "m.youtube.com": "youtube", "youtu.be": "youtube",
    "googleads.g.doubleclick.net": "youtube", "tpc.googlesyndication.com": "youtube",
    "www.google.com": "google", "www.google.co.za": "google", "www.bing.com": "bing",
    "duckduckgo.com": "duckduckgo", "www.facebook.com": "facebook", "l.facebook.com": "facebook",
    "m.facebook.com": "facebook", "fb.me": "facebook", "www.instagram.com": "instagram",
    "t.co": "x", "x.com": "x", "twitter.com": "x", "old.reddit.com": "reddit", "www.tiktok.com": "tiktok",
    "www.linkedin.com": "linkedin", "lnkd.in": "linkedin", "chatgpt.com": "ai-chatgpt",
    "www.perplexity.ai": "ai-perplexity", "claude.ai": "ai-claude", "gemini.google.com": "ai-gemini",
    "peerpush.com": "peerpush", "longroadsoftware.com": "longroadsoftware", "mediaflowswift.com": "mediaflowswift",
    "some-blog.example.org": "some-blog.example.org",
  };
  for (const [host, want] of Object.entries(cases)) assert.equal(mapHost(host).source, want, host);
  assert.equal(mapHost("googleads.g.doubleclick.net").medium, "paid");
  assert.equal(mapHost("www.youtube.com").medium, "video");
});

test("utm beats referrer; junk utm is cleaned; PeerPush tag", () => {
  assert.deepEqual(src("/?utm_source=Reddit&utm_medium=social&utm_campaign=rv-week", "https://www.google.com/"),
    { source: "reddit", medium: "social", campaign: "rv-week" });
  assert.deepEqual(src("/?utm_source=%3Cscript%3Ex%20y&utm_campaign=" + "a".repeat(90)),
    { source: "scriptxy", medium: "", campaign: "a".repeat(40) });
  assert.equal(src("/?utm_source=%3C%3E").source, "unknown");
  assert.equal(src("/?utm_source=peerpush", "https://peerpush.com/p/x").source, "peerpush");
});

test("Google Ads click ids count as YouTube paid, even with no utm tag", () => {
  assert.deepEqual(src("/?gclid=abc"), { source: "youtube", medium: "paid", campaign: "" });
  assert.deepEqual(src("/?gad_source=1", "https://www.youtube.com/"), { source: "youtube", medium: "paid", campaign: "" });
  assert.deepEqual(src("/", "https://googleads.g.doubleclick.net/pagead/x"), { source: "youtube", medium: "paid", campaign: "" });
  assert.deepEqual(src("/", "https://www.youtube.com/watch?v=abc"), { source: "youtube", medium: "video", campaign: "" });
});

test("no referrer = direct; our own referrer = not a landing", () => {
  assert.deepEqual(src("/", null), { source: "direct", medium: "", campaign: "" });
  assert.equal(src("/faq/", "https://checkandroll.app/"), null);
  assert.equal(src("/faq/", "https://www.checkandroll.app/manual/"), null);
});

test("bots, scripts and the family are kept apart from humans", () => {
  assert.equal(whoIs(req("/"), ENV), "human");
  assert.equal(whoIs(req("/", { "User-Agent": "Googlebot/2.1" }), ENV), "bot");
  assert.equal(whoIs(req("/", { "User-Agent": "curl/8.4" }), ENV), "bot");
  assert.equal(whoIs(req("/", { "Accept-Language": "" }), ENV), "bot");
  assert.equal(whoIs(req("/", { "CF-Connecting-IP": "50.42.107.18" }), ENV), "us");
});

test("a landing records source, path, country and device; a request with src is not counted again", () => {
  assert.deepEqual(landingFor(req("/faq/?gclid=x", { "User-Agent": PHONE }, { country: "ZA" }), ENV, SITE), {
    who: "human", source: "youtube", medium: "paid", campaign: "", landing: "/faq/", country: "za", device: "mobile",
  });
  assert.equal(landingFor(req("/faq/?src=youtube"), ENV, SITE), null);
  assert.equal(landingFor(new Request("https://checkandroll.app/", { method: "HEAD" }), ENV, SITE), null);
});

// The middleware with a fake D1: what it writes, and that the page always comes back untouched.
function fakeD1(fail) {
  const rows = [];
  return { rows, prepare: () => ({ bind: (...a) => ({ run: async () => { if (fail) throw new Error("D1 down"); rows.push(a); } }) }) };
}
async function serve(request, db, page = new Response("<p>hi</p>", { headers: { "Content-Type": "text/html; charset=utf-8" } })) {
  const waits = [];
  const resp = await onRequest({ request, env: { ...ENV, TRAFFIC: db }, next: async () => page, waitUntil: (p) => waits.push(p) });
  await Promise.all(waits);
  return resp;
}

test("middleware counts a landing, skips internal clicks, bots go apart, D1 failures don't break the page", async () => {
  const db = fakeD1();
  await serve(req("/", { Referer: "https://www.youtube.com/" }, { country: "US" }), db);
  await serve(req("/faq/", { Referer: "https://checkandroll.app/" }), db);
  await serve(req("/", { "User-Agent": "Googlebot/2.1" }), db);
  await serve(req("/images/x.png"), db, new Response("png", { headers: { "Content-Type": "image/png" } }));
  await serve(req("/nope/"), db, new Response("gone", { status: 404, headers: { "Content-Type": "text/html" } }));
  assert.equal(db.rows.length, 2);
  assert.deepEqual(db.rows[0].slice(1), ["checkandroll.app", "human", "youtube", "video", "", "/", "us", "desktop"]);
  assert.equal(db.rows[1][2], "bot");
  const r = await serve(req("/"), fakeD1(true));
  assert.equal(r.status, 200);
  assert.equal(await r.text(), "<p>hi</p>");
});
