/* cloudora-plugin
{
  "id": "weather",
  "name": "Weather",
  "version": "1.0.0",
  "api": 2,
  "description": "Current weather and a 7-day forecast (Open-Meteo, no account needed), plus a card on the new-tab page.",
  "author": "Cloudora",
  "homepage": "https://github.com/az4if/Cloudora-plugins"
}
*/
// Needs Cloudora with plugin API 2 (home widgets).
// Search a city on the Weather page and pick it; the new-tab card then shows its weather. Data: https://open-meteo.com

// ---- pure helpers (unit tested) ----
const CODES = [
  [[0], "Clear", "☀️"], [[1], "Mostly clear", "🌤️"], [[2], "Partly cloudy", "⛅"], [[3], "Overcast", "☁️"], [[45, 48], "Fog", "🌫️"],
  [[51, 53, 55, 56, 57], "Drizzle", "🌦️"], [[61, 63, 65, 66, 67], "Rain", "🌧️"], [[71, 73, 75, 77], "Snow", "🌨️"],
  [[80, 81, 82], "Showers", "🌦️"], [[85, 86], "Snow showers", "🌨️"], [[95, 96, 99], "Thunderstorm", "⛈️"],
];
export const describeCode = (code) => { const c = CODES.find(([l]) => l.includes(Number(code))); return c ? { label: c[1], icon: c[2] } : { label: "Unknown", icon: "🌡️" }; };
export const UNITS = { metric: { t: "celsius", w: "kmh", tl: "°C", wl: "km/h" }, imperial: { t: "fahrenheit", w: "mph", tl: "°F", wl: "mph" } };
export const forecastUrl = (lat, lon, units = "metric") => {
  const u = UNITS[units] || UNITS.metric;
  return "https://api.open-meteo.com/v1/forecast?" + new URLSearchParams({
    latitude: String(+lat), longitude: String(+lon), timezone: "auto", temperature_unit: u.t, wind_speed_unit: u.w,
    current: "temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m",
    daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
  });
};
export const geocodeUrl = (name) => "https://geocoding-api.open-meteo.com/v1/search?" + new URLSearchParams({ name: String(name).slice(0, 80), count: "8", language: "en", format: "json" });
export const placeLabel = (p) => [p.name, p.admin1, p.country].filter((x, i, a) => x && a.indexOf(x) === i).join(", ");
export const validPlace = (p) => !!p && typeof p.name === "string" && Number.isFinite(+p.lat) && Math.abs(+p.lat) <= 90 && Number.isFinite(+p.lon) && Math.abs(+p.lon) <= 180;
export const dayName = (iso, i) => i === 0 ? "Today" : new Date(iso + "T12:00:00Z").toLocaleDateString(undefined, { weekday: "short", timeZone: "UTC" });

const CSS = `
.wx-now{display:flex;align-items:center;gap:18px;margin:0 0 6px}.wx-now .wx-ic{font-size:54px;line-height:1}
.wx-now b{font-size:44px;font-weight:600;line-height:1}.wx-now small{display:block;color:var(--muted);margin-top:4px}
.wx-days{display:grid;grid-template-columns:repeat(auto-fill,minmax(92px,1fr));gap:10px;margin:14px 0 0}
.wx-day{padding:12px 8px;border:1px solid var(--border);border-radius:14px;background:var(--surface2);text-align:center}
.wx-day .wx-ic{font-size:26px}.wx-day small{display:block;color:var(--muted)}
.wx-find{display:flex;flex-direction:column;gap:8px;max-width:520px}
.wx-pick{display:flex;justify-content:space-between;gap:10px;padding:11px 14px;border:1px solid var(--border);border-radius:14px;background:var(--surface2);color:var(--text);text-align:left;cursor:pointer}
.wx-pick:hover{border-color:var(--accent)}.wx-pick small{color:var(--muted)}
.wx-card .wx-now b{font-size:30px}.wx-card .wx-now .wx-ic{font-size:36px}
.wx-card{cursor:pointer}
`;

export default function register(api) {
  const { esc, spinner } = api.ui;
  api.style(CSS);
  const units = () => (api.storage.get("units", "metric") === "imperial" ? "imperial" : "metric");
  const place = () => { const p = api.storage.get("place", null); return validPlace(p) ? p : null; };
  const cache = new Map();
  async function load(p) {
    const key = p.lat + "," + p.lon + units(), hit = cache.get(key);
    if (hit && hit.exp > Date.now()) return hit.data;
    const r = await api.fetch(forecastUrl(p.lat, p.lon, units()), { headers: { accept: "application/json" } });
    if (!r.ok) throw new Error("Weather service answered " + r.status);
    const data = await r.json();
    if (!data.current || !data.daily) throw new Error("Unexpected answer from the weather service");
    cache.set(key, { exp: Date.now() + 15 * 60e3, data }); return data;
  }
  const nowHtml = (p, d) => { const u = UNITS[units()], c = describeCode(d.current.weather_code);
    return `<div class="wx-now"><span class="wx-ic">${c.icon}</span><div><b>${Math.round(d.current.temperature_2m)}${u.tl}</b><small>${esc(c.label)} · feels ${Math.round(d.current.apparent_temperature)}${u.tl}</small><small>${esc(placeLabel(p))}</small></div></div>`; };

  api.settings((box) => {
    box.innerHTML = `<label class="fld">Units <select data-k="units"><option value="metric">°C, km/h</option><option value="imperial">°F, mph</option></select></label>`;
    const s = box.querySelector("select"); s.value = units();
    s.onchange = () => { api.storage.set("units", s.value); cache.clear(); api.toast("Saved"); };
  });

  api.widget({
    id: "now", title: "Weather", order: 10,
    async render(body) {
      const p = place();
      if (!p) { body.innerHTML = '<span class="muted">Pick a city on the Weather page.</span>'; return; }
      body.innerHTML = '<span class="muted">Loading…</span>';
      body.onclick = () => api.openPage("weather");
      const d = await load(p);
      body.innerHTML = `<div class="wx-card">${nowHtml(p, d)}</div>`;
    },
  });

  api.onClick((e) => {
    const pick = e.target.closest("[data-wx-pick]"); if (!pick) return false;
    try { const p = JSON.parse(pick.dataset.wxPick); if (validPlace(p)) { api.storage.set("place", p); api.navigate("weather", "replace"); api.toast("Saved " + placeLabel(p)); } } catch {}
    return true;
  });

  api.page({
    id: "weather", title: "Weather", placeholder: "Search for a city…",
    async list(q, ctx) {
      if (q) {
        ctx.render(spinner("Searching…"));
        const r = await api.fetch(geocodeUrl(q), { headers: { accept: "application/json" } });
        const j = await r.json().catch(() => ({}));
        if (ctx.stale()) return;
        const found = (j.results || []).map((x) => ({ name: x.name, admin1: x.admin1, country: x.country, lat: x.latitude, lon: x.longitude })).filter(validPlace);
        return ctx.render(`<h3>Pick your city</h3><div class="wx-find">${found.map((p) => `<button type="button" class="wx-pick" data-wx-pick="${esc(JSON.stringify(p))}"><span>${esc(placeLabel(p))}</span><small>${(+p.lat).toFixed(1)}, ${(+p.lon).toFixed(1)}</small></button>`).join("") || '<p class="muted">No city found.</p>'}</div>`);
      }
      const p = place();
      if (!p) return ctx.render('<p class="muted">Search for your city above to see its weather here and on the new-tab page.</p>');
      ctx.render(spinner("Loading weather…"));
      const d = await load(p);
      if (ctx.stale()) return;
      const u = UNITS[units()];
      ctx.render(`${nowHtml(p, d)}<small class="muted">Humidity ${Math.round(d.current.relative_humidity_2m)}% · Wind ${Math.round(d.current.wind_speed_10m)} ${u.wl}</small>
        <div class="wx-days">${d.daily.time.map((t, i) => { const c = describeCode(d.daily.weather_code[i]); return `<div class="wx-day"><small>${esc(dayName(t, i))}</small><div class="wx-ic" title="${esc(c.label)}">${c.icon}</div><b>${Math.round(d.daily.temperature_2m_max[i])}°</b><small>${Math.round(d.daily.temperature_2m_min[i])}°${d.daily.precipitation_probability_max && d.daily.precipitation_probability_max[i] != null ? " · " + d.daily.precipitation_probability_max[i] + "%" : ""}</small></div>`; }).join("")}</div>`);
    },
  });
}
