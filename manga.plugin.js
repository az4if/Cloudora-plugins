/* cloudora-plugin
{
  "id": "manga",
  "name": "Manga",
  "version": "1.0.0",
  "api": 1,
  "description": "Adds a Manga button to the sidebar that opens atsu.moe in a tab.",
  "author": "Cloudora"
}
*/
export default function register(api) {
  api.page({ id: "manga", title: "Manga", action: () => api.open("https://atsu.moe/") });
}
