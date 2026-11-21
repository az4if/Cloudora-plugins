# Plugins

Cloudora's core is just the browser. Everything else (extra pages, sidebar buttons, anything you write) is a **plugin**: one JavaScript file that each user adds in their own browser under **Settings → Plugins**. Plugins are stored in that browser (IndexedDB), never on the server, and can be turned off, updated or removed at any time without a reload.

> A plugin runs with full access to Cloudora (your history, bookmarks, settings, and requests through your server). Only install plugins from sources you trust. If one breaks the app, open Cloudora with `?noplugins` (for example `https://your-host/?noplugins`) to start with all plugins off, then remove it.

## Installing

Settings → Plugins, then one of:

- **Choose file…** a `*.plugin.js` file from your computer
- **Address**: a URL to a plugin file (the server fetches it through your own tunnel; hosts must allow it). Plugins installed this way can use **Check for update**
- **Paste code**

You'll see the plugin's name, version and author and must confirm before anything runs.

## A plugin file

```js
/* cloudora-plugin
{
  "id": "hello",
  "name": "Hello",
  "version": "1.0.0",
  "api": 1,
  "description": "Says hi.",
  "author": "You",
  "homepage": "https://example.com"
}
*/
export default function register(api) {
  api.page({
    id: "hello", title: "Hello", search: false,
    list(q, ctx) { ctx.render("<h3>Hello!</h3>"); },
  });
}
```

The file must start with the manifest comment. It is read as text and validated before the code is run.

| Field | Rules |
| --- | --- |
| `id` | required, 2 to 32 chars: lowercase letters, digits, dashes. Also used as the storage namespace |
| `name` | required, 40 chars max |
| `version` | required, `1.2.3` style. Updates only install if the version is higher |
| `api` | plugin API the file targets (default `1`). Cloudora refuses files that need a newer one |
| `description`, `author`, `homepage` | optional (`homepage` must be http/https) |

Size limit 1.5 MB. The file is an ES module; `export default function (api) {}` (or `export function register`) is called once on load and has 10 seconds to finish. It can be `async`.

## API (version 1)

| Member | What it does |
| --- | --- |
| `api.page(def)` | Add a sidebar page (below) |
| `api.style(css)` | Add CSS; removed when the plugin is turned off |
| `api.onClick(fn)` | Click handler for the app's discover area. `fn(event)`: return `true` when you handled it |
| `api.onDispose(fn)` | Run `fn` when the plugin is turned off, updated or removed |
| `api.settings(fn)` | `fn(container)` fills your plugin's block in Settings → Plugins |
| `api.fetch(url, init)` | `fetch` through Cloudora's tunnel (no CORS limits, hides your IP from the site) |
| `api.storage` | `get(key, default)`, `set(key, value)`, `remove(key)`: JSON values, private to the plugin |
| `api.navigate(route, "replace"?)` | Go to a route, e.g. `"hello"` or `"hello/info/3"` |
| `api.back()` | Go back one view |
| `api.open(url)` / `api.openTab(url)` | Open a site in the current empty tab / a new tab |
| `api.openPage(id)` | Open a page by id |
| `api.toast(text)` | Show a message |
| `api.invalidate(pageId)` | Re-draw that page's list next time it's shown |
| `api.layers` | `{ detail, player, reader, sync }`: the app's popup/full-screen containers and `sync()` to refresh their state |
| `api.ui` | `esc`, `ic(name)`, `icons`, `spinner(text)`, `skeleton()`, `closeButton()`, `dropdown(button, items, current, pick)`, `closeDropdown()` |
| `api.id`, `api.version`, `api.coreVersion` | Identity and versions |

### Pages

```js
api.page({
  id: "notes",             // route: #notes
  title: "Notes",          // sidebar label
  placeholder: "Search…",  // search box text
  search: true,            // false hides the search box
  nav: true,               // false hides the sidebar button
  list(q, ctx) {},         // draw the page. ctx = { q, body, current(), render(html) }
  route(parts, ctx) {},    // optional: handles #notes/<parts…>; return false to fall back to list()
  leave() {},              // optional: called when the user leaves the page
});

// or a link-style page: a sidebar button that just does something
api.page({ id: "docs", title: "Docs", action: () => api.open("https://example.com/") });
```

Routes: `#<page>`, `#<page>/search/<query>` (calls `list(query)`), and anything else is passed to `route(parts, ctx)` with `ctx = { stale(), nav, replace, toast, syncView }`. Use `ctx.stale()` after any `await` to see if the user has already moved on. Cards with class `mcard` and `data-id` call `open(id)` if you define it, otherwise navigate to `#<page>/info/<id>`.

### Images

Give covers `data-img="<url>"` instead of `src`. Cloudora loads them lazily through the tunnel (cross-origin images are blocked otherwise on Chromium).

### UI kit

Core ships the classes plugins can reuse: `.grid`, `.mcard` (+ `img`, `b`, `small`), `.dcard`, `.chips`/`.chip`, `.chlist`, `.badge`, `.btn`, `.seg`, `.dd-btn`, `.rhead`, `.xb`, `.muted`, `.note`. Look at `style.css` or `example/hello.plugin.js` for how they're used.

### Other things available

- `/hls/hls.min.js` is served by Cloudora if a plugin wants to play HLS (`<script>`-load it on demand).
- Embedding third-party players: never add a `sandbox` attribute (sites detect it); on Chromium Cloudora is cross-origin isolated, so give iframes the `credentialless` attribute when `crossOriginIsolated` is true.

## Plugin authors: test and ship

- Keep pure logic in named `export`s so it can be unit-tested with `node --test` (the manifest comment is harmless to Node).
- Bump `version` for each release; users with an address-installed plugin get it via **Check for update**.
- Plugins are untrusted-by-default code: don't phone home, and keep API keys in `api.storage`, which stays in the user's browser.
