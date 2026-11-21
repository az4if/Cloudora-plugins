import test from "node:test";
import assert from "node:assert/strict";
import { availableVideoServers, buildVideoServerUrl, describeVideoServer, epRange, VIDEO_SERVERS } from "../anime.plugin.js";

test("embed server names are unique and alphanumeric", () => {
  const names = VIDEO_SERVERS.map((s) => s.name);
  assert.equal(new Set(names).size, names.length);
  assert.ok(names.every((n) => /^[a-z0-9]+$/.test(n)));
});

test("builds AniList and MAL embed URLs", () => {
  assert.equal(buildVideoServerUrl(VIDEO_SERVERS.find((s) => s.name === "megm"), { mal: 5114, ep: 12, lang: "sub" }), "https://megaplay.buzz/stream/mal/5114/12/sub");
  assert.equal(buildVideoServerUrl(VIDEO_SERVERS.find((s) => s.name === "pmha"), { anilist: 16498, ep: 5, lang: "dub" }), "https://ani.pm/embed/ani/16498/5/dub?hardsub=1");
});

test("filters embeds by the ids we have", () => {
  assert.ok(availableVideoServers({ mal: 5114, ep: 1, lang: "sub" }).every((s) => !s.url.includes("{ani}")));
  assert.ok(availableVideoServers({ anilist: 1, ep: 1, lang: "sub" }).every((s) => !s.url.includes("{mal}")));
  assert.equal(availableVideoServers({ ep: 1 }).length, 0);
});

test("ids are URL-encoded", () => {
  assert.ok(buildVideoServerUrl(VIDEO_SERVERS[1], { anilist: "1/../2", ep: 1, lang: "sub" }).includes("1%2F..%2F2"));
});

test("labels every server", () => {
  for (const s of VIDEO_SERVERS) { const d = describeVideoServer(s); assert.ok(d.title && d.sub, s.name); }
});

test("episode batches", () => {
  assert.deepEqual(epRange(0, 250), [1, 100]);
  assert.deepEqual(epRange(2, 250), [201, 250]);
});
