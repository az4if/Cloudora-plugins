import test from "node:test";
import assert from "node:assert/strict";
import { plain, safeUrl, ago } from "../rss.plugin.js";
import { describeCode, forecastUrl, geocodeUrl, placeLabel, validPlace, dayName } from "../weather.plugin.js";
import { THEMES, themeCss } from "../themes.plugin.js";
import { parseMatches, cleanRule, PRESETS } from "../tweaks.plugin.js";

test("rss: plain text, safe links, ages", () => {
  assert.equal(plain("<p>Hi &amp; <b>bye</b></p>"), "Hi & bye");
  assert.equal(plain("x".repeat(300), 10).length, 10);
  assert.equal(safeUrl("javascript:alert(1)"), "");
  assert.equal(safeUrl("https://a.com/x"), "https://a.com/x");
  assert.equal(safeUrl("not a url"), "");
  assert.equal(ago(1000, 1000 + 5 * 60e3), "5m");
  assert.equal(ago(1000, 1000 + 3 * 3600e3), "3h");
  assert.equal(ago(0), "");
});

test("weather: codes, urls, places", () => {
  assert.equal(describeCode(0).label, "Clear");
  assert.equal(describeCode(95).label, "Thunderstorm");
  assert.equal(describeCode(12345).label, "Unknown");
  const u = new URL(forecastUrl(23.8, 90.4, "imperial"));
  assert.equal(u.hostname, "api.open-meteo.com");
  assert.equal(u.searchParams.get("temperature_unit"), "fahrenheit");
  assert.equal(u.searchParams.get("latitude"), "23.8");
  assert.equal(new URL(geocodeUrl("São Paulo")).searchParams.get("name"), "São Paulo");
  assert.equal(placeLabel({ name: "Paris", admin1: "Paris", country: "France" }), "Paris, France");
  assert.equal(validPlace({ name: "x", lat: 95, lon: 0 }), false);
  assert.equal(validPlace({ name: "x", lat: 10, lon: 20 }), true);
  assert.equal(dayName("2026-11-21", 0), "Today");
});

test("themes: unique ids, every colour present, overrides inline style", () => {
  assert.equal(new Set(THEMES.map((t) => t.id)).size, THEMES.length);
  for (const t of THEMES) {
    for (const k of ["bg", "side", "surface", "surface2", "border", "text", "muted", "accent", "accent2"]) assert.match(t[k], /^#[0-9a-f]{6}$/i, `${t.id}.${k}`);
    assert.match(themeCss(t), /--bg:#[0-9a-f]{6} !important/i);
    assert.ok(/color-scheme:(dark|light) !important/.test(themeCss(t)));
  }
});

test("tweaks: site patterns and rules", () => {
  assert.deepEqual(parseMatches("Example.com, *.other.org  *"), ["example.com", "*.other.org", "*"]);
  assert.deepEqual(parseMatches("https://a.com/path"), ["a.com"]);
  for (const bad of ["", "   ", "a b!", "<script>", "*.*", "a.com:8080"]) assert.throws(() => parseMatches(bad), bad);
  assert.throws(() => cleanRule({ name: "x", matches: "a.com" }), /CSS or JavaScript/);
  const r = cleanRule({ name: "  Dark ", matches: "a.com", css: "a{}" });
  assert.equal(r.name, "Dark"); assert.equal(r.on, true); assert.ok(r.id);
  for (const p of PRESETS) cleanRule({ ...p });
});
