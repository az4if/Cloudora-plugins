# Cloudora plugins

Optional add-ons for [Cloudora](../Cloudora-main). Install one in **Settings → Plugins** (choose the file, or paste its address or code). They stay in your browser only.

| File | Adds |
| --- | --- |
| `anime.plugin.js` | **Anime** page: AniList browse/search, details, batched episode list, embed player with a server list, continue watching. Optional licensed HLS/MP4 source API in the plugin's settings |
| `manga.plugin.js` | **Manga** button that opens [atsu.moe](https://atsu.moe/) in a tab |
| `example/hello.plugin.js` | A tiny example to copy when writing your own |

Writing your own: see `PLUGINS.md` in the core project.

```sh
node --test tests/anime.test.mjs
```
