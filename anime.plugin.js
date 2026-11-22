/* cloudora-plugin
{
  "id": "anime",
  "name": "Anime",
  "version": "1.0.0",
  "api": 1,
  "description": "Browse and search anime (AniList), with a built-in episode player and a server list.",
  "author": "Cloudora",
  "homepage": "https://github.com/az4if/Cloudora-plugins"
}
*/
// Anime plugin for Cloudora: adds an "Anime" page.
//  - trending / popular / search / details come from AniList (https://anilist.co), fetched through Cloudora's tunnel
//  - episodes play in an embed player (a list of servers) or, if you set a source API in this plugin's settings, in a <video>
//  - routes: #anime  #anime/search/<q>  #anime/info/<anilist id>  #anime/watch/<anilist id>/<episode>

// ---- embed servers (pure data + helpers; also unit tested) ----
export const VIDEO_SERVERS = [
  { name: "megm", url: "https://megaplay.buzz/stream/mal/{mal}/{ep}/{lang}" },
  { name: "mega", url: "https://megaplay.buzz/stream/ani/{ani}/{ep}/{lang}" },
  { name: "pmha", url: "https://ani.pm/embed/ani/{ani}/{ep}/{lang}?hardsub=1" },
  { name: "pmhm", url: "https://ani.pm/embed/mal/{mal}/{ep}/{lang}?hardsub=1" },
  { name: "pma", url: "https://ani.pm/embed/ani/{ani}/{ep}/{lang}" },
  { name: "pmm", url: "https://ani.pm/embed/mal/{mal}/{ep}/{lang}" },
  { name: "vidm", url: "https://megavid.buzz/mal/{mal}/{ep}/{lang}?color=%2322d3a5" },
  { name: "vida", url: "https://megavid.buzz/ani/{ani}/{ep}/{lang}?color=%2322d3a5" },
  { name: "prom", url: "https://vidlink.pro/anime/{mal}/{ep}/{lang}" },
  { name: "profallm", url: "https://vidlink.pro/anime/{mal}/{ep}/{lang}?fallback=true" },
  { name: "nesta", url: "https://vidnest.fun/anime/{ani}/{ep}/{lang}" },
  { name: "pahea", url: "https://vidnest.fun/animepahe/{ani}/{ep}/{lang}" },
  { name: "uscca", url: "https://tryembed.us.cc/embed/anime/{ani}/{ep}/{lang}" },
  { name: "easym", url: "https://player.videasy.net/anime/{mal}/{ep}?color=10B981&overlay=true" },
  { name: "zokoa", url: "https://zokoanime.video/stream/ani/{ani}/{ep}/{lang}" },
  { name: "zokom", url: "https://zokoanime.video/stream/mal/{mal}/{ep}/{lang}" },
  { name: "animoa", url: "https://cdn.4animo.xyz/embed/ani/{ani}/{ep}/{lang}?k=1" },
  { name: "animom", url: "https://cdn.4animo.xyz/embed/mal/{mal}/{ep}/{lang}?k=1" },
  { name: "linka", url: "https://anilink.cc/watch/{ani}/{ep}?variant={lang}" },
  { name: "hawka", url: "https://vidhawk.buzz/embed/ani/{ani}/{ep}/{lang}" },
  { name: "hawkm", url: "https://vidhawk.buzz/embed/mal/{mal}/{ep}/{lang}" },
  { name: "babam", url: "https://babastream.top/embed/{mal}/{ep}/{lang}" },
  { name: "xoa", url: "https://anixo.buzz/embed/ani/{ani}/{ep}?track={lang}" },
  { name: "xom", url: "https://anixo.buzz/embed/mal/{mal}/{ep}?track={lang}" },
];

// ids = { anilist, mal, ep, lang } -> the server's URL, or "" when it needs an id we don't have
export function buildVideoServerUrl(server, ids) {
  if (!server || typeof server.url !== "string") return "";
  const v = {
    ani: ids.anilist ? encodeURIComponent(String(ids.anilist)) : "",
    mal: ids.mal ? encodeURIComponent(String(ids.mal)) : "",
    ep: ids.ep ? encodeURIComponent(String(ids.ep)) : "",
    lang: ids.lang ? encodeURIComponent(String(ids.lang)) : "",
  };
  if ((server.url.includes("{ani}") && !v.ani) || (server.url.includes("{mal}") && !v.mal)) return "";
  return server.url.replace(/\{(ani|mal|ep|lang)\}/g, (_m, k) => v[k] ?? "");
}
export const availableVideoServers = (ids, servers = VIDEO_SERVERS) => servers.filter((s) => buildVideoServerUrl(s, ids));

// label for the server list: host name + which id it uses + any variant
export function describeVideoServer(server) {
  const host = new URL(server.url.replace(/\{\w+\}/g, "x")).hostname.replace(/^(www|cdn|player)\./, "");
  const word = host.split(".")[0].length > 3 ? host.split(".")[0] : host;
  const sub = [server.url.includes("{ani}") ? "AniList" : "MAL", /hardsub/.test(server.url) && "hardsub", /fallback/.test(server.url) && "fallback", /animepahe/.test(server.url) && "AnimePahe"].filter(Boolean);
  return { title: word[0].toUpperCase() + word.slice(1), sub: sub.join(" · ") };
}

export const BATCH = 100; // episodes per batch in the episode list
export const epRange = (b, count) => [b * BATCH + 1, Math.min(count, (b + 1) * BATCH)];

const CSS = String.raw`.pbody{display:flex;flex-direction:column;gap:10px;width:min(1100px,100%);margin:0 auto;padding:16px}
.chlist.eps .chip{min-width:44px;text-align:center}
.eprow{display:flex;align-items:center;gap:10px;margin-bottom:8px}
.chlist.eps .chip.cur{border-color:var(--accent);background:color-mix(in srgb,var(--accent) 18%,var(--surface2));color:var(--accent)}
.pstage{position:relative;width:min(100%,calc(54vh * 16 / 9));aspect-ratio:16/9;margin:0 auto;border-radius:14px;overflow:hidden;background:#000;box-shadow:0 10px 40px #0007}
.pstage video,.pstage iframe{position:absolute;inset:0;width:100%;height:100%;border:0;background:#000}
.pstage video[hidden]{display:none}
.pload{position:absolute;inset:0;z-index:2;display:grid;place-items:center;background:#000c;pointer-events:none;color:#cfcfd6}
.pload[hidden]{display:none}.pload .loading{color:#cfcfd6;flex-direction:column;gap:14px}.pload .spin{--s:38px;--t:4px}
.pbar{display:flex;align-items:center;flex-wrap:wrap;gap:10px;min-height:34px}
.pbar .grow{flex:1}.pbar #p-msg{font-size:13px}
.pbar .btn{display:inline-flex;align-items:center;gap:7px}.pbar .btn svg{width:15px;height:15px}
.seg.sm button{padding:5px 11px;flex:none}.seg[hidden]{display:none}
.srvbox h4{margin:6px 0 8px;font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em}
.srvlist{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:6px;padding:6px;border:1px solid var(--border);border-radius:16px;background:var(--surface)}
.sgrp{grid-column:1/-1;padding:8px 8px 2px;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}
.srv{display:flex;align-items:center;gap:10px;min-width:0;padding:9px 11px;border:1px solid transparent;border-radius:11px;background:none;text-align:left;transition:background .12s,border-color .12s}
.srv:hover{background:var(--surface2)}
.srv .dot{flex:none;width:8px;height:8px;border-radius:50%;border:2px solid var(--muted);transition:all .15s}
.srv .st{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:500}
.srv small{flex:none;color:var(--muted);font-size:11px}
.srv.on{border-color:var(--accent);background:color-mix(in srgb,var(--accent) 13%,transparent)}
.srv.on .dot{border-color:var(--accent);background:var(--accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--accent) 28%,transparent)}
.srv:focus-visible,.dd-btn:focus-visible{outline:2px solid var(--accent);outline-offset:1px}
.rhead .back{display:inline-flex;align-items:center;gap:6px;padding:6px 12px 6px 8px}.rhead .back svg{width:16px;height:16px}
.pgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(340px,100%),1fr));gap:14px;align-items:start}
.pbox{min-width:0;padding:14px;border:1px solid var(--border);border-radius:16px;background:var(--surface)}
.phead{display:flex;align-items:center;gap:10px;margin-bottom:10px}.phead h4{margin:0 auto 0 0;font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em}
.pbox .srvlist{padding:0;border:0;background:none;grid-template-columns:repeat(auto-fill,minmax(165px,1fr))}
#w-eps{max-height:300px;position:relative}
.eps .chip,.chlist.eps .chip{display:inline-flex;align-items:center;justify-content:center;min-width:44px;text-align:center;font-variant-numeric:tabular-nums}`;

const FIELDS = "id title{romaji english} coverImage{large} averageScore format episodes chapters";
const LIST = `query($t:MediaType,$s:[MediaSort],$q:String){Page(perPage:20){media(type:$t,sort:$s,search:$q,isAdult:false){${FIELDS}}}}`;
const ONE = `query($id:Int){Media(id:$id){${FIELDS} idMal type description genres siteUrl nextAiringEpisode{episode} externalLinks{url site type}}}`;
const SPEEDS = [0.75, 1, 1.25, 1.5, 2];
const DEFAULT_ANILIST = "https://graphql.anilist.co";

export default function register(api) {
  const { esc, ic, spinner, skeleton, dropdown, closeDropdown } = api.ui;
  const { detail, player: pl, reader, sync: syncView } = api.layers;
  const $ = (s) => document.querySelector(s);
  api.style(CSS);

  // ---- settings (kept in this browser) ----
  const cfg = () => ({ anilist: api.storage.get("anilist", DEFAULT_ANILIST), source: api.storage.get("source", ""), key: api.storage.get("key", ""), official: !!api.storage.get("official", false) });
  const legacy = (k, d) => { try { const v = JSON.parse(localStorage.getItem("cloudora:" + k)); return v ?? d; } catch { return d; } }; // data from before Anime was a plugin
  const recentList = () => { const v = api.storage.get("recent", null); return Array.isArray(v) ? v : legacy("recent:anime", []); };
  api.settings((box) => {
    const c = cfg();
    box.innerHTML = `<label class="fld">Source API address <small>Optional. A licensed HLS/MP4 API you are allowed to use; its sources are listed above the embed servers.</small>
        <input data-k="source" value="${esc(c.source)}" placeholder="https://your-api.example.com" spellcheck="false" autocomplete="off" /></label>
      <label class="fld">Source API key <small>Sent as a Bearer token.</small><input data-k="key" type="password" value="${esc(c.key)}" autocomplete="off" /></label>
      <label class="fld chk"><input data-k="official" type="checkbox" ${c.official ? "checked" : ""} /> This source API is an official service (shows the Official badge)</label>
      <label class="fld">AniList address <small>Advanced. Leave as is unless you run your own AniList-compatible endpoint.</small>
        <input data-k="anilist" value="${esc(c.anilist)}" spellcheck="false" autocomplete="off" /></label>`;
    box.querySelectorAll("[data-k]").forEach((i) => i.addEventListener("change", () => {
      const v = i.type === "checkbox" ? i.checked : i.value.trim().replace(/\/+$/, i.dataset.k === "anilist" ? "" : "");
      api.storage.set(i.dataset.k, i.dataset.k === "source" ? String(v).replace(/\/+$/, "") : v);
      if (i.dataset.k === "anilist") cache.clear();
      api.toast("Saved");
    }));
  });

  // ---- AniList ----
  const cache = new Map();
  async function gql(query, variables) {
    const url = cfg().anilist || DEFAULT_ANILIST, body = JSON.stringify({ query, variables }), key = url + body, hit = cache.get(key);
    if (hit && hit.exp > Date.now()) return hit.data;
    const r = await api.fetch(url, { method: "POST", headers: { "content-type": "application/json", accept: "application/json" }, body });
    let j; try { j = await r.json(); } catch { throw new Error("AniList answered with something unexpected (" + r.status + ")"); }
    if (!j.data) throw new Error((j.errors && j.errors[0].message) || "AniList error");
    if (cache.size > 300) cache.clear();
    cache.set(key, { data: j.data, exp: Date.now() + 5 * 60e3 });
    return j.data;
  }
  const animeCache = new Map();
  async function loadAnime(id) {
    if (!animeCache.has(id)) {
      animeCache.set(id, (await gql(ONE, { id })).Media);
      if (animeCache.size > 30) animeCache.delete(animeCache.keys().next().value);
    }
    return animeCache.get(id);
  }

  // ---- cards, "continue watching" ----
  const mname = (m) => m.title.english || m.title.romaji;
  const mmeta = (m) => [m.averageScore && "★ " + m.averageScore, m.format && m.format.replace("_", " "), m.episodes ? m.episodes + " eps" : m.chapters ? m.chapters + " ch" : ""].filter(Boolean).join(" · ");
  const card = (m) => `<div class="mcard glow" data-id="${m.id}"><img alt="" data-img="${esc(m.coverImage.large)}"><b>${esc(mname(m))}</b><small>${esc(mmeta(m))}</small></div>`;
  const rowsHtml = (rows, data, render) => rows.map(([h], i) => `<h3>${h}</h3><div class="grid">${render(data[i]).join("") || '<p class="muted">Nothing found.</p>'}</div>`).join("");
  const rxBtn = (id) => `<button type="button" class="rx xb" data-rx="${esc(String(id))}" title="Remove from this list" aria-label="Remove from this list">${ic("close")}</button>`;
  function recentHtml() {
    const l = recentList(); if (!l.length) return "";
    return `<h3>Continue watching</h3><div class="grid">${l.map((x) => `<div class="mcard glow" data-id="${x.id}">${rxBtn(x.id)}<img alt="" data-img="${esc(x.cover)}"><b>${esc(x.title)}</b><small>${esc(x.label)}</small></div>`).join("")}</div>`;
  }
  function pushRecent(entry) {
    const l = recentList().filter((x) => x.id !== entry.id);
    l.unshift(entry); l.length = Math.min(l.length, 12); api.storage.set("recent", l);
    api.invalidate("anime");
  }
  function removeRecent(btn) {
    const card = btn.closest(".mcard"), grid = card.parentNode;
    api.storage.set("recent", recentList().filter((x) => String(x.id) !== btn.dataset.rx));
    card.remove();
    if (!grid.querySelector(".mcard")) { grid.previousElementSibling?.remove(); grid.remove(); } // last one: drop the whole row + heading
  }

  // ---- episodes: shown in batches of 100 with a dropdown to pick the batch ----
  let watching = null, playing = null, player = { items: [], cur: -1 }, embedTimer = 0;
  const badge = (official) => official ? '<span class="badge ok">Official</span>' : '<span class="badge warn">Unofficial</span>';
  function renderEps() {
    const w = watching; if (!w) return;
    const [a, z] = epRange(w.batch, w.count);
    const html = Array.from({ length: z - a + 1 }, (_, i) => `<button class="chip${a + i === w.last ? " cur" : ""}" data-ep="${a + i}">${a + i}</button>`).join("");
    for (const [list, label] of [["#eps", "#ep-batch-l"], ["#w-eps", "#w-batch-l"]]) {
      const box = $(list); if (!box) continue;
      box.innerHTML = html;
      const l = $(label); if (l) l.textContent = `Episodes ${a} – ${z}`;
      const cur = box.querySelector(".cur"); if (cur) box.scrollTop = Math.max(0, cur.offsetTop - box.offsetTop - box.clientHeight / 2 + cur.offsetHeight / 2);
    }
  }
  function pickBatch(btn) {
    const w = watching, n = Math.ceil(w.count / BATCH);
    dropdown(btn, Array.from({ length: n }, (_, b) => { const [a, z] = epRange(b, w.count); return [b, `${a} – ${z}`, w.last >= a && w.last <= z ? "watching" : ""]; }), w.batch, (b) => { w.batch = b; renderEps(); });
  }
  function makeWatching(id, m) {
    const count = Math.min(5000, m.episodes || (m.nextAiringEpisode ? m.nextAiringEpisode.episode - 1 : 0));
    const last = Math.min(count, (recentList().find((x) => x.id === id) || {}).ep || 0); // reopen on the batch you were watching
    return { id, malId: m.idMal || 0, title: mname(m), count, cover: m.coverImage.large, last, batch: last ? Math.floor((last - 1) / BATCH) : 0 };
  }

  async function animeDetail(id) {
    detail.hidden = false; detail.innerHTML = `<div class="dcard">${api.ui.closeButton()}${spinner("Loading details…")}</div>`;
    try {
      const m = await loadAnime(id);
      if (detail.hidden) return; // closed while loading
      const desc = (m.description || "No description.").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "");
      const seen = new Set();
      const links = [...(m.externalLinks || []), { url: m.siteUrl, site: "AniList", type: "INFO" }]
        .filter((l) => l.url && /^https?:\/\//.test(l.url) && l.type !== "SOCIAL" && !seen.has(l.site) && seen.add(l.site)).slice(0, 9);
      if (!watching || watching.id !== id) watching = makeWatching(id, m);
      const count = watching.count;
      const play = count ? `<h4>Play here ${badge(cfg().official && !!cfg().source)}</h4>
        <div class="eprow">${count > BATCH ? `<button type="button" class="dd-btn" id="ep-batch" aria-haspopup="listbox" aria-expanded="false"><span id="ep-batch-l"></span>${ic("down")}</button>` : ""}<small class="muted">${count} episode${count > 1 ? "s" : ""}</small></div>
        <div class="chlist eps" id="eps"></div>` : "";
      detail.innerHTML = `<div class="dcard">${api.ui.closeButton()}<img alt="" data-img="${esc(m.coverImage.large)}"><div class="dbody">
        <h2>${esc(mname(m))}</h2><small>${esc(mmeta(m))}</small>
        <div class="chips" style="margin-top:8px">${(m.genres || []).map((g) => `<span class="chip">${esc(g)}</span>`).join("")}</div>
        <p class="desc">${esc(desc)}</p>${play}<h4>Official sources ${badge(true)}</h4>
        <div class="chips">${links.map((l) => `<button class="chip" data-open="${esc(l.url)}">${esc(l.site)}</button>`).join("")}</div></div></div>`;
      renderEps();
    } catch (err) { detail.innerHTML = `<div class="dcard">${api.ui.closeButton()}<p class="muted">Couldn't load details (${esc(err.message)}).</p></div>`; }
  }

  // ---- player ----
  // Direct HLS/MP4 sources (from the optional source API) play in a <video>; embed servers play in an iframe.
  // The iframe must NEVER get a sandbox attribute: servers detect it and refuse to play. When the page is
  // cross-origin isolated (Chromium) the iframe needs `credentialless`, otherwise the browser blocks the embed.
  const ensureHls = () => new Promise((res) => { if (window.Hls) return res(); const s = document.createElement("script"); s.src = "/hls/hls.min.js"; s.onload = s.onerror = res; document.head.appendChild(s); });
  const pmsg = (t) => { const m = $("#p-msg"); if (m) m.textContent = t; };
  const pload = (text) => { const l = $("#p-load"); if (!l) return; l.hidden = !text; if (text) l.innerHTML = spinner(text); };
  function closePlayer() {
    clearTimeout(embedTimer); closeDropdown();
    const v = $("#vid"); if (v) { v.pause(); if (v._hls) v._hls.destroy(); }
    if (!pl.hidden || pl.innerHTML) { pl.hidden = true; pl.innerHTML = ""; }
    playing = null; syncView();
  }
  async function attach(v, src) {
    const pb = $("#p-badge"); if (pb) pb.innerHTML = badge(src.official ?? cfg().official);
    if (v._hls) { v._hls.destroy(); v._hls = null; }
    const fail = () => { pload(""); pmsg("Couldn't play this source (the host may block cross-site playback). Try another server."); };
    if (src.type === "hls" || /\.m3u8(\?|$)/i.test(src.url)) {
      await ensureHls();
      if (window.Hls && Hls.isSupported()) {
        const h = (v._hls = new Hls());
        h.on(Hls.Events.ERROR, (_, e) => e.fatal && fail());
        h.loadSource(src.url); h.attachMedia(v);
      } else if (v.canPlayType("application/vnd.apple.mpegurl")) v.src = src.url; // Safari / iOS native HLS
      else { pload(""); pmsg("This browser can't play HLS streams."); }
    } else v.src = src.url;
  }
  function mountEmbed(url) {
    clearTimeout(embedTimer);
    const stage = $("#pstage"); $("#p-embed")?.remove();
    const f = document.createElement("iframe");
    f.id = "p-embed"; f.title = `${watching.title} · Episode ${watching.last}`;
    f.allow = "autoplay; fullscreen; encrypted-media; picture-in-picture; clipboard-write";
    f.allowFullscreen = true;
    if (window.crossOriginIsolated) f.setAttribute("credentialless", "");
    f.addEventListener("load", () => { clearTimeout(embedTimer); pload(""); pmsg(""); });
    stage.appendChild(f); // a fresh iframe per server so switching doesn't pile up history entries
    f.src = url;
    pload("Loading player…"); pmsg("");
    embedTimer = setTimeout(() => { pload(""); pmsg("Taking a while. If the player stays blank, pick another server below."); }, 12000);
  }
  function renderServers() {
    const box = $("#p-servers"); if (!box) return;
    const groups = new Set(player.items.map((x) => x.group)); let last = "", html = "";
    player.items.forEach((it, i) => {
      if (groups.size > 1 && it.group !== last) html += `<div class="sgrp">${esc(it.group)}</div>`;
      last = it.group;
      html += `<button type="button" role="menuitemradio" aria-checked="${i === player.cur}" class="srv${i === player.cur ? " on" : ""}" data-srv="${i}"><span class="dot"></span><span class="st">${esc(it.title)}</span>${it.sub ? `<small>${esc(it.sub)}</small>` : ""}</button>`;
    });
    box.innerHTML = html;
  }
  async function useServer(i) {
    const it = player.items[i], v = $("#vid"); if (!it || !v) return;
    player.cur = i; renderServers(); pmsg("");
    $("#p-speed").hidden = it.kind !== "native";
    const tab = $("#p-tab"); tab.hidden = it.kind !== "embed"; tab.dataset.open = it.kind === "embed" ? it.url : "";
    if (it.kind === "embed") {
      v.pause(); v.hidden = true; if (v._hls) { v._hls.destroy(); v._hls = null; }
      $("#p-badge").innerHTML = badge(it.official ?? false);
      if (it.name) api.storage.set("server", it.name);
      mountEmbed(it.url);
    } else {
      clearTimeout(embedTimer); $("#p-embed")?.remove(); v.hidden = false;
      pload("Loading stream…");
      await attach(v, it.src);
    }
  }
  async function playEpisode(num) {
    const w = watching, key = `progress:${w.id}:${num}`, c = cfg();
    w.last = num; w.batch = Math.floor((num - 1) / BATCH); renderEps();
    pushRecent({ id: w.id, title: w.title, cover: w.cover, label: "Episode " + num, ep: num });
    closeDropdown(); clearTimeout(embedTimer);
    detail.hidden = true; pl.hidden = false; pl.scrollTop = 0; syncView();
    const many = w.count > BATCH;
    pl.innerHTML = `<div class="rhead"><button class="btn back" id="p-close" data-back>${ic("back")}Back</button><b>${esc(w.title)} · Episode ${num}</b></div>
      <div class="pbody">
        <div class="pstage" id="pstage"><video id="vid" controls playsinline autoplay crossorigin="anonymous" hidden></video><div class="pload" id="p-load">${spinner("Finding sources…")}</div></div>
        <div class="pbar"><span id="p-badge"></span><span class="muted" id="p-msg"></span><span class="grow"></span>
          <div class="seg sm" id="p-speed" hidden>${SPEEDS.map((s) => `<button type="button" data-spd="${s}"${s === 1 ? ' class="on"' : ""}>${s}×</button>`).join("")}</div>
          <button type="button" class="btn" id="p-tab" hidden>${ic("ext")}Open in tab</button>
          <button class="btn" data-pn="${num - 1}" ${num < 2 ? "disabled" : ""}>‹ Prev</button><button class="btn" data-pn="${num + 1}" ${num >= w.count ? "disabled" : ""}>Next ›</button></div>
        <div class="pgrid">
          <div class="pbox"><div class="phead"><h4>Episodes</h4>${many ? `<button type="button" class="dd-btn" id="w-batch" aria-haspopup="listbox" aria-expanded="false"><span id="w-batch-l"></span>${ic("down")}</button>` : ""}<small class="muted">${w.count} total</small></div><div class="chlist eps" id="w-eps"></div></div>
          <div class="pbox"><div class="phead"><h4>Servers</h4></div><div class="srvlist" id="p-servers" role="menu"></div></div>
        </div>
      </div>`;
    renderEps();
    const v = $("#vid"), ids = { anilist: w.id, mal: w.malId, ep: num, lang: "sub" };
    const items = [], embeds = availableVideoServers(ids);
    if (c.source) {
      try {
        const r = await api.fetch(`${c.source}/sources?anilist_id=${w.id}&episode=${num}`, { headers: { accept: "application/json", ...(c.key ? { authorization: "Bearer " + c.key } : {}) } });
        const j = await r.json().catch(() => ({}));
        if (!$("#vid") || watching !== w || w.last !== num) return; // closed or changed episode while we waited
        if (!r.ok) throw new Error(j.error || "source API error " + r.status);
        (j.sources || []).filter((s) => s.url && /^https?:\/\//.test(s.url)).forEach((s, n) => {
          const title = s.label || s.quality || "Source " + (n + 1);
          if (s.type === "embed") items.push({ kind: "embed", group: "Source API", title, sub: "embed", url: s.url, official: s.official ?? c.official });
          else items.push({ kind: "native", group: "Source API", title, sub: (s.type || "").toUpperCase(), src: s });
        });
        (j.subtitles || []).forEach((t, i) => {
          if (!/^https?:\/\//.test(t.url)) return;
          const k = document.createElement("track"); k.kind = "subtitles"; k.src = t.url; k.label = t.label || t.lang || "Subtitles"; k.srclang = t.lang || "en"; k.default = i === 0; v.appendChild(k);
        });
      } catch (err) { if (!embeds.length) { pload(""); return pmsg("Couldn't start playback: " + err.message); } }
    }
    const saved = api.storage.get("server", legacy("server", ""));
    embeds.sort((a, b) => (b.name === saved) - (a.name === saved)); // last server you used goes first
    for (const s of embeds) { const d = describeVideoServer(s); items.push({ kind: "embed", group: "Embed servers", name: s.name, title: d.title, sub: d.sub, url: buildVideoServerUrl(s, ids) }); }
    if (!items.length) { pload(""); return pmsg("No sources found for this episode."); }
    player = { items, cur: -1 };
    const prog = (k) => api.storage.get(k, legacy(k, 0));
    let last = 0;
    v.onloadedmetadata = () => { const t = prog(key); if (t > 10 && t < v.duration - 30) v.currentTime = t; v.playbackRate = +($("#p-speed .on")?.dataset.spd || 1); pload(""); pmsg(""); };
    v.onplaying = () => pload("");
    v.ontimeupdate = () => { if (Date.now() - last > 5000) { last = Date.now(); api.storage.set(key, v.currentTime); } };
    v.onended = () => { api.storage.set(key, 0); if (num < w.count) api.navigate(`anime/watch/${w.id}/${num + 1}`, "replace"); };
    v.onerror = () => { pload(""); pmsg("Couldn't play this source (the host may block cross-site playback). Try another server."); };
    useServer(0);
  }

  // ---- clicks inside this plugin's UI ----
  api.onClick((e) => {
    const t = e.target;
    const rx = t.closest("[data-rx]"); if (rx) { e.stopPropagation(); removeRecent(rx); return true; }
    const eb = t.closest("#ep-batch, #w-batch"); if (eb) { pickBatch(eb); return true; }
    const sv = t.closest("[data-srv]"); if (sv) { useServer(+sv.dataset.srv); return true; }
    const sp = t.closest("[data-spd]"); if (sp) { $("#vid").playbackRate = +sp.dataset.spd; sp.parentNode.querySelectorAll("button").forEach((b) => b.classList.toggle("on", b === sp)); return true; }
    const pn = t.closest("[data-pn]"); if (pn) { if (!pn.disabled) api.navigate(`anime/watch/${watching.id}/${pn.dataset.pn}`, "replace"); return true; }
    const ep = t.closest("[data-ep]"); if (ep) { api.navigate(`anime/watch/${watching.id}/${ep.dataset.ep}`, "replace"); return true; }
    return false;
  });

  // ---- the page ----
  api.page({
    id: "anime", title: "Anime", icon: "play", placeholder: "Search anime…",
    async list(q, ctx) {
      const rows = q ? [["Results", { s: ["SEARCH_MATCH"], q }]] : [["Trending now", { s: ["TRENDING_DESC"] }], ["Most popular", { s: ["POPULARITY_DESC"] }]];
      const data = await Promise.all(rows.map(([, v]) => gql(LIST, { t: "ANIME", ...v })));
      ctx.render((q ? "" : recentHtml()) + rowsHtml(rows, data, (d) => d.Page.media.map(card)));
    },
    // #anime/info/<id>  and  #anime/watch/<id>/<episode>
    async route(parts, ctx) {
      const [kind, idText, n] = parts, id = +idText;
      if (!/^\d{1,8}$/.test(idText || "") || (kind !== "info" && kind !== "watch")) return false;
      const toInfo = (msg) => { if (msg) ctx.toast(msg); ctx.replace(`anime/info/${id}`); return true; };
      if (kind === "info") { closePlayer(); reader.hidden = true; await animeDetail(id); return true; }
      detail.hidden = true; reader.hidden = true;
      let w = watching && watching.id === id ? watching : null;
      if (!w) {
        try { const m = await loadAnime(id); if (ctx.stale()) return true; w = watching = makeWatching(id, m); }
        catch { return toInfo("Couldn't load this anime"); }
      }
      if (!w.count) return toInfo("No episode list for this anime yet");
      const num = Math.max(1, Math.min(w.count, parseInt(n, 10) || 1));
      if (String(num) !== n) { ctx.replace(`anime/watch/${id}/${num}`); return true; }
      if (!(playing && playing.id === w.id && playing.n === num && !pl.hidden)) { playing = { id: w.id, n: num }; await playEpisode(num); }
      return true;
    },
    leave: closePlayer,
  });
  api.onDispose(() => { closePlayer(); detail.hidden = true; });
}
