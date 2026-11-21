# Cloudora plugins

Optional add-ons for Cloudora. Install one in **Settings → Plugins**: choose the file, paste its address, or paste the code. Plugins stay in your browser only and can be turned off, updated or removed any time.

| Plugin | Adds | Address |
| --- | --- | --- |
| `anime.plugin.js` | **Anime** page: AniList browse and search, details, batched episode list, embed player with a server list, continue watching. Optional HLS/MP4 source API in the plugin's settings | `https://raw.githubusercontent.com/az4if/Cloudora-plugins/main/anime.plugin.js` |
| `manga.plugin.js` | **Manga** button that opens [atsu.moe](https://atsu.moe/) in a tab | `https://raw.githubusercontent.com/az4if/Cloudora-plugins/main/manga.plugin.js` |
| `rss.plugin.js` | **News** page: an RSS / Atom reader with filters, read marks and starter feeds (needs plugin API 2) | `https://raw.githubusercontent.com/az4if/Cloudora-plugins/main/rss.plugin.js` |
| `weather.plugin.js` | **Weather** page (Open-Meteo, no account) and a weather card on the new-tab page (needs plugin API 2) | `https://raw.githubusercontent.com/az4if/Cloudora-plugins/main/weather.plugin.js` |
| `themes.plugin.js` | **Theme pack**: eight extra colour themes, chosen in the plugin's settings | `https://raw.githubusercontent.com/az4if/Cloudora-plugins/main/themes.plugin.js` |
| `tweaks.plugin.js` | **Site tweaks**: your own CSS and JavaScript per site, with dark-mode and other presets (needs plugin API 2) | `https://raw.githubusercontent.com/az4if/Cloudora-plugins/main/tweaks.plugin.js` |
| `example/hello.plugin.js` | A tiny example to copy when writing your own | `https://raw.githubusercontent.com/az4if/Cloudora-plugins/main/example/hello.plugin.js` |

Installing from an address enables **Check for update**: bump `version` in the manifest, push, and users get the new one.

> Plugins run with full access to Cloudora. Only install ones you trust.

## Writing your own

See [PLUGINS.md](PLUGINS.md) for the manifest and API.

```sh
npm test
```
