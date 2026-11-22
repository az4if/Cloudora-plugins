/* cloudora-plugin
{
  "id": "rss",
  "name": "News feeds",
  "version": "1.0.0",
  "api": 2,
  "description": "A simple RSS / Atom reader: add feeds, read the latest items, remember what you've read.",
  "author": "Cloudora",
  "homepage": "https://github.com/az4if/Cloudora-plugins"
}
*/
// Needs Cloudora with plugin API 2 (api.refresh). Adds a "News" page. Feeds are fetched through Cloudora's tunnel, so sites that block browsers' CORS still work.
// Everything (feed list, read marks) is kept in this browser.

// ---- pure helpers (unit tested) ----
export const MAX_ITEMS = 30;   // per feed
export const MAX_FEEDS = 40;

const text = (el) => (el && el.textContent ? el.textContent.trim() : "");
const kid = (node, name) => [...node.children].find((c) => c.localName === name);
const kids = (node, name) => [...node.children].filter((c) => c.localName === name);
export const plain = (html, max = 220) => {
  const s = String(html || "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/\s+/g, " ").trim();
  return s.length > max ? s.slice(0, max - 1).trimEnd() + "…" : s;
};
export const safeUrl = (u) => { try { const x = new URL(String(u).trim()); return /^https?:$/.test(x.protocol) ? x.href : ""; } catch { return ""; } };

// RSS 2.0, RSS 1.0 (RDF) and Atom -> { title, items: [{ title, link, date, summary }] }. `doc` is an XML Document.
export function parseFeed(doc) {
  const root = doc && doc.documentElement;
  if (!root || doc.querySelector("parsererror")) throw new Error("That doesn't look like a feed.");
  const out = { title: "", items: [] };
  if (root.localName === "feed") { // Atom
    out.title = text(kid(root, "title"));
    for (const e of kids(root, "entry")) {
      const links = kids(e, "link"), l = links.find((x) => (x.getAttribute("rel") || "alternate") === "alternate") || links[0];
      out.items.push({ title: plain(text(kid(e, "title")), 200), link: safeUrl(l && l.getAttribute("href")), date: Date.parse(text(kid(e, "published")) || text(kid(e, "updated"))) || 0, summary: plain(text(kid(e, "summary")) || text(kid(e, "content"))) });
    }
  } else { // RSS / RDF
    const ch = root.localName === "rdf" ? root : kid(root, "channel");
    if (!ch) throw new Error("That doesn't look like a feed.");
    out.title = text(kid(ch, "title"));
    const items = root.localName === "rdf" ? kids(root, "item") : kids(ch, "item");
    for (const e of items) {
      const date = text(kid(e, "pubDate")) || [...e.children].filter((c) => c.localName === "date").map(text)[0] || "";
      out.items.push({ title: plain(text(kid(e, "title")), 200), link: safeUrl(text(kid(e, "link"))) || safeUrl(text(kid(e, "guid"))), date: Date.parse(date) || 0, summary: plain(text(kid(e, "description"))) });
    }
  }
  out.items = out.items.filter((i) => i.title && i.link).slice(0, MAX_ITEMS);
  return out;
}

export function ago(ts, now = Date.now()) {
  if (!ts) return "";
  const s = Math.max(0, (now - ts) / 1000);
  if (s < 3600) return Math.max(1, Math.floor(s / 60)) + "m";
  if (s < 86400) return Math.floor(s / 3600) + "h";
  if (s < 86400 * 30) return Math.floor(s / 86400) + "d";
  return new Date(ts).toISOString().slice(0, 10);
}

export const STARTERS = [
  { url: "https://news.ycombinator.com/rss", name: "Hacker News" },
  { url: "https://feeds.bbci.co.uk/news/rss.xml", name: "BBC News" },
  { url: "https://www.theverge.com/rss/index.xml", name: "The Verge" },
];

const CSS = `
.rss-add{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 14px}
.rss-add input{flex:1 1 260px;min-width:0;height:38px;padding:0 14px;border:1px solid var(--border);border-radius:999px;background:var(--surface2);color:var(--text);outline:none}
.rss-add input:focus{border-color:var(--accent)}
.rss-feeds{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 16px}
.rss-feeds .chip{cursor:pointer}.rss-feeds .chip.on{border-color:var(--accent);color:var(--text)}
.rss-feeds .chip .rss-x{margin-left:6px;opacity:.6}.rss-feeds .chip .rss-x:hover{opacity:1}
.rss-list{display:flex;flex-direction:column;gap:8px}
.rss-item{display:block;padding:12px 14px;border:1px solid var(--border);border-radius:14px;background:var(--surface2);cursor:pointer;text-align:left;color:var(--text);width:100%}
.rss-item:hover{border-color:var(--accent)}
.rss-item b{display:block;font-weight:600}.rss-item.read b{color:var(--muted);font-weight:500}
.rss-item small{display:block;margin-top:4px;color:var(--muted)}
.rss-item p{margin:6px 0 0;color:var(--muted);font-size:13px}
.rss-err{color:var(--muted);font-size:13px;margin:0 0 10px}
`;

export default function register(api) {
  const { esc, spinner } = api.ui;
  api.style(CSS);
  const feeds = () => { const v = api.storage.get("feeds", []); return Array.isArray(v) ? v.filter((f) => f && safeUrl(f.url)) : []; };
  const setFeeds = (l) => api.storage.set("feeds", l.slice(0, MAX_FEEDS));
  const readSet = () => new Set(api.storage.get("read", []));
  const markRead = (url) => { const r = [...readSet().add(url)].slice(-1500); api.storage.set("read", r); };
  const cache = new Map();   // url -> { exp, feed }
  let only = "";             // feed url filter ("" = all)
  let shown = new Map();     // link -> item, for the current list

  async function fetchFeed(url) {
    const hit = cache.get(url);
    if (hit && hit.exp > Date.now()) return hit.feed;
    const r = await api.fetch(url, { headers: { accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*" } });
    if (!r.ok) throw new Error("HTTP " + r.status);
    const feed = parseFeed(new DOMParser().parseFromString(await r.text(), "text/xml"));
    cache.set(url, { exp: Date.now() + 10 * 60e3, feed });
    return feed;
  }

  async function addFeed(raw, ctx) {
    const url = safeUrl(/^[a-z]+:\/\//i.test(raw.trim()) ? raw : "https://" + raw.trim());
    if (!url) return api.toast("Enter a feed address");
    const l = feeds();
    if (l.some((f) => f.url === url)) return api.toast("Already added");
    if (l.length >= MAX_FEEDS) return api.toast("That's the most feeds you can add");
    try {
      const feed = await fetchFeed(url);
      setFeeds([...l, { url, name: feed.title.slice(0, 40) || new URL(url).hostname }]);
      only = ""; api.refresh("news"); api.toast("Added " + (feed.title || url));
    } catch (err) { api.toast("Couldn't read that feed: " + err.message); }
  }

  function wire(body, ctx) {
    const input = body.querySelector(".rss-add input");
    const submit = () => { const v = input.value.trim(); if (v) addFeed(v, ctx); };
    if (input) { input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } }); body.querySelector("[data-rss-add]").onclick = submit; }
  }

  api.onClick((e) => {
    const t = e.target;
    const st = t.closest("[data-rss-starter]"); if (st) { addFeed(st.dataset.rssStarter, null); return true; }
    const rm = t.closest("[data-rss-rm]"); if (rm) { e.stopPropagation(); setFeeds(feeds().filter((f) => f.url !== rm.dataset.rssRm)); if (only === rm.dataset.rssRm) only = ""; api.refresh("news"); return true; }
    const sel = t.closest("[data-rss-only]"); if (sel) { only = sel.dataset.rssOnly; api.refresh("news"); return true; }
    const it = t.closest("[data-rss-item]");
    if (it) { const u = it.dataset.rssItem; markRead(u); it.classList.add("read"); api.openTab(u); return true; }
    return false;
  });

  api.page({
    id: "news", title: "News", icon: "rss", placeholder: "Filter headlines…",
    async list(q, ctx) {
      const l = feeds();
      const addBar = `<div class="rss-add"><input placeholder="Paste a feed address (RSS or Atom)" spellcheck="false" autocomplete="off" inputmode="url" aria-label="Feed address" /><button type="button" class="btn" data-rss-add>Add feed</button></div>`;
      if (!l.length) {
        ctx.render(`${addBar}<h3>Start with</h3><div class="rss-feeds">${STARTERS.map((s) => `<button type="button" class="chip" data-rss-starter="${esc(s.url)}">${esc(s.name)}</button>`).join("")}</div>`);
        return wire(ctx.body, ctx);
      }
      if (only && !l.some((f) => f.url === only)) only = "";
      const chips = `<div class="rss-feeds"><button type="button" class="chip${only ? "" : " on"}" data-rss-only="">All</button>${l.map((f) => `<span class="chip${only === f.url ? " on" : ""}" data-rss-only="${esc(f.url)}" role="button" tabindex="0">${esc(f.name)}<span class="rss-x" data-rss-rm="${esc(f.url)}" title="Remove feed" aria-label="Remove ${esc(f.name)}">✕</span></span>`).join("")}</div>`;
      ctx.render(`${addBar}${chips}${spinner("Loading feeds…")}`);
      wire(ctx.body, ctx);
      const targets = only ? l.filter((f) => f.url === only) : l;
      const results = await Promise.allSettled(targets.map(async (f) => ({ f, feed: await fetchFeed(f.url) })));
      if (ctx.stale()) return;
      const read = readSet(), errs = [], items = [];
      results.forEach((r, i) => r.status === "fulfilled" ? r.value.feed.items.forEach((it) => items.push({ ...it, from: r.value.f.name })) : errs.push(`${targets[i].name}: ${r.reason.message}`));
      const needle = q.toLowerCase();
      const list = items.filter((i) => !needle || i.title.toLowerCase().includes(needle) || i.summary.toLowerCase().includes(needle)).sort((a, b) => b.date - a.date).slice(0, 120);
      shown = new Map(list.map((i) => [i.link, i]));
      ctx.render(`${addBar}${chips}${errs.length ? `<p class="rss-err">Couldn't load: ${esc(errs.join(" · "))}</p>` : ""}<div class="rss-list">${list.map((i) => `<button type="button" class="rss-item${read.has(i.link) ? " read" : ""}" data-rss-item="${esc(i.link)}"><b>${esc(i.title)}</b><small>${esc(i.from)}${i.date ? " · " + ago(i.date) : ""}</small>${i.summary ? `<p>${esc(i.summary)}</p>` : ""}</button>`).join("") || '<p class="muted">Nothing to show.</p>'}</div>`);
      wire(ctx.body, ctx);
    },
  });
}
