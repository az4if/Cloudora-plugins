/* cloudora-plugin
{
  "id": "tweaks",
  "name": "Site tweaks",
  "version": "1.0.0",
  "api": 2,
  "description": "Your own CSS and JavaScript for the sites you browse: dark mode, hide elements, small userscripts.",
  "author": "Cloudora",
  "homepage": "https://github.com/az4if/Cloudora-plugins"
}
*/
// Needs Cloudora with plugin API 2 (api.inject). Rules apply to proxied pages, in every frame of the matching sites.
// The JavaScript you add runs inside those sites with full access to them. Only use code you wrote or trust.

// ---- pure helpers (unit tested) ----
export const MATCH_RE = /^(\*|(\*\.)?[a-z0-9]([a-z0-9.-]*[a-z0-9])?)$/i;
// "example.com, *.other.org" -> ["example.com", "*.other.org"]; throws on anything that isn't a site pattern
export function parseMatches(text) {
  const list = String(text || "").split(/[\s,]+/).map((s) => s.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "")).filter(Boolean);
  if (!list.length) throw new Error('Enter at least one site, like "example.com" (subdomains included) or "*" for every site.');
  if (list.length > 50) throw new Error("That's too many sites (50 max).");
  for (const m of list) if (!MATCH_RE.test(m)) throw new Error(`"${m}" isn't a site. Use "example.com", "*.example.com" or "*".`);
  return [...new Set(list)];
}
export function cleanRule(r) {
  const name = String(r.name || "").trim().slice(0, 60) || "Untitled";
  const css = String(r.css || ""), js = String(r.js || "");
  if (!css.trim() && !js.trim()) throw new Error("Add some CSS or JavaScript.");
  if (css.length > 100e3 || js.length > 100e3) throw new Error("CSS and JavaScript are limited to 100 KB each.");
  return { id: String(r.id || "r" + Date.now().toString(36)), name, matches: parseMatches(r.matches), css, js, on: r.on !== false };
}
export const PRESETS = [
  { name: "Dark mode", matches: "*", css: "html{filter:invert(1) hue-rotate(180deg)!important;background:#fff}img,video,picture,canvas,svg,iframe{filter:invert(1) hue-rotate(180deg)!important}" },
  { name: "No animations", matches: "*", css: "*,*::before,*::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}" },
  { name: "Wider text", matches: "*", css: "body{font-size:112%!important;line-height:1.6!important}" },
];

export default function register(api) {
  const { esc } = api.ui;
  api.style(`
.tw-row{display:grid;grid-template-columns:auto 1fr auto;gap:12px;align-items:center;padding:12px 14px;border:1px solid var(--border);border-radius:14px;background:var(--surface2);margin:0 0 8px}
.tw-row b{display:block;font-weight:600}.tw-row small{color:var(--muted);word-break:break-all}.tw-row .acts{display:flex;gap:6px}
.tw-row input[type=checkbox]{width:18px;height:18px;accent-color:var(--accent)}
.tw-form{display:grid;gap:10px;max-width:640px;padding:14px;border:1px solid var(--border);border-radius:14px;background:var(--surface2)}
.tw-form label{display:grid;gap:4px;font-size:13px}.tw-form small{color:var(--muted)}
.tw-form input,.tw-form textarea{width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:10px;background:var(--surface);color:var(--text);outline:none;font:inherit}
.tw-form textarea{min-height:110px;resize:vertical;font:12px/1.4 ui-monospace,Menlo,Consolas,monospace}
.tw-form input:focus,.tw-form textarea:focus{border-color:var(--accent)}.tw-form .acts{display:flex;gap:8px}
.tw-err{color:#e5484d;font-size:13px;min-height:1em}
`);
  const rules = () => { const v = api.storage.get("rules", []); return Array.isArray(v) ? v : []; };
  const save = (l) => { api.storage.set("rules", l); apply(); };
  let removers = [];
  function apply() {
    removers.forEach((r) => r()); removers = [];
    for (const r of rules()) {
      if (!r.on) continue;
      try { removers.push(api.inject({ matches: r.matches, css: r.css, js: r.js })); } catch (err) { console.warn("[tweaks] skipped", r.name, err.message); }
    }
  }
  apply();

  let editing = null, ctx0 = null; // editing: rule | { id: "" } (new) | null
  const form = (r) => `<div class="tw-form">
    <label>Name<input data-f="name" value="${esc(r.name || "")}" maxlength="60" /></label>
    <label>Sites <small>Space or comma separated. "example.com" includes its subdomains; "*" is every site.</small><input data-f="matches" value="${esc((r.matches || []).join(", "))}" spellcheck="false" /></label>
    <label>CSS<textarea data-f="css" spellcheck="false">${esc(r.css || "")}</textarea></label>
    <label>JavaScript <small>Optional. Runs at the start of the page's head: wait for DOMContentLoaded before using the document.</small><textarea data-f="js" spellcheck="false">${esc(r.js || "")}</textarea></label>
    <div class="tw-err" data-err></div>
    <div class="acts"><button type="button" class="btn" data-tw="save">Save</button><button type="button" class="btn" data-tw="cancel">Cancel</button></div></div>`;
  function draw() {
    if (!ctx0) return;
    const l = rules();
    ctx0.render(`<p class="muted" style="max-width:640px">Add CSS or JavaScript that runs on the sites you choose. It applies the next time a page loads.</p>
      ${editing ? form(editing) : `<div class="chips" style="margin:0 0 14px"><button type="button" class="btn" data-tw="new">New tweak</button>${PRESETS.map((p, i) => `<button type="button" class="chip" data-tw-preset="${i}">+ ${esc(p.name)}</button>`).join("")}</div>
      ${l.map((r) => `<div class="tw-row"><input type="checkbox" data-tw-on="${esc(r.id)}" ${r.on ? "checked" : ""} aria-label="Turn on ${esc(r.name)}" /><div><b>${esc(r.name)}</b><small>${esc(r.matches.join(", "))}${r.js ? " · script" : ""}</small></div><div class="acts"><button type="button" class="btn" data-tw-edit="${esc(r.id)}">Edit</button><button type="button" class="btn" data-tw-del="${esc(r.id)}">Delete</button></div></div>`).join("") || '<p class="muted">No tweaks yet.</p>'}`}`);
  }
  api.onClick((e) => {
    const t = e.target, b = t.closest("[data-tw],[data-tw-preset],[data-tw-edit],[data-tw-del]"), on = t.closest("[data-tw-on]");
    if (on) { save(rules().map((r) => r.id === on.dataset.twOn ? { ...r, on: on.checked } : r)); return true; }
    if (!b) return false;
    const l = rules();
    if (b.dataset.tw === "new") { editing = { id: "" }; draw(); }
    else if (b.dataset.twPreset) { const p = PRESETS[+b.dataset.twPreset]; editing = { id: "", name: p.name, matches: [p.matches], css: p.css, js: "" }; draw(); }
    else if (b.dataset.twEdit) { editing = l.find((r) => r.id === b.dataset.twEdit) || null; draw(); }
    else if (b.dataset.twDel) { save(l.filter((r) => r.id !== b.dataset.twDel)); draw(); }
    else if (b.dataset.tw === "cancel") { editing = null; draw(); }
    else if (b.dataset.tw === "save") {
      const f = (k) => ctx0.body.querySelector(`[data-f="${k}"]`).value;
      try {
        const r = cleanRule({ id: editing && editing.id, name: f("name"), matches: f("matches"), css: f("css"), js: f("js"), on: editing && editing.on });
        save(l.some((x) => x.id === r.id) ? l.map((x) => x.id === r.id ? r : x) : [...l, r]); editing = null; draw();
      } catch (err) { ctx0.body.querySelector("[data-err]").textContent = err.message; }
    }
    return true;
  });
  api.page({ id: "tweaks", title: "Site tweaks", icon: "code", search: false, list(_q, ctx) { ctx0 = ctx; editing = null; draw(); }, leave() { editing = null; } });
  api.onDispose(() => { removers.forEach((r) => r()); removers = []; });
}
