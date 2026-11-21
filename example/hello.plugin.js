/* cloudora-plugin
{
  "id": "hello",
  "name": "Hello",
  "version": "1.0.0",
  "api": 1,
  "description": "A tiny example plugin: adds a Hello page with a counter that remembers itself."
}
*/
export default function register(api) {
  const { esc } = api.ui;
  api.page({
    id: "hello", title: "Hello", search: false,
    list(_q, ctx) {
      const n = api.storage.get("count", 0);
      ctx.render(`<h3>Hello from a plugin</h3><p class="muted"><span id="hello-n">${esc(String(n))}</span> clicks so far.</p><button class="btn" data-hello>Click me</button>`);
    },
  });
  api.onClick((e) => {
    if (!e.target.closest("[data-hello]")) return false;
    const n = api.storage.get("count", 0) + 1;
    api.storage.set("count", n);
    document.querySelector("#hello-n").textContent = n;
    return true;
  });
}
