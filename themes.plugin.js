/* cloudora-plugin
{
  "id": "themes",
  "name": "Theme pack",
  "version": "1.0.0",
  "api": 1,
  "description": "Extra colour themes for Cloudora. Pick one in this plugin's settings.",
  "author": "Cloudora",
  "homepage": "https://github.com/az4if/Cloudora-plugins"
}
*/
// Each theme sets Cloudora's colour variables. "Default" switches the pack off and goes back to your Appearance settings.

export const THEMES = [
  { id: "midnight", name: "Midnight", mode: "dark", bg: "#050814", side: "#050814", surface: "#0b1022", surface2: "#131a33", border: "#222c52", text: "#eaf0ff", muted: "#8f9bc4", accent: "#6ea8ff", accent2: "#a78bfa" },
  { id: "dracula", name: "Dracula", mode: "dark", bg: "#1e1f29", side: "#1e1f29", surface: "#282a36", surface2: "#343746", border: "#44475a", text: "#f8f8f2", muted: "#a0a4c0", accent: "#bd93f9", accent2: "#ff79c6" },
  { id: "nord", name: "Nord", mode: "dark", bg: "#242933", side: "#242933", surface: "#2e3440", surface2: "#3b4252", border: "#4c566a", text: "#eceff4", muted: "#9aa5b8", accent: "#88c0d0", accent2: "#b48ead" },
  { id: "forest", name: "Forest", mode: "dark", bg: "#08110d", side: "#08110d", surface: "#0f1b15", surface2: "#17291f", border: "#254233", text: "#e8f5ec", muted: "#8fb09b", accent: "#4ade80", accent2: "#a3e635" },
  { id: "rose", name: "Rosé", mode: "dark", bg: "#12090d", side: "#12090d", surface: "#1c0f15", surface2: "#2a1822", border: "#47283a", text: "#fdeef3", muted: "#c69aaa", accent: "#fb7185", accent2: "#f0abfc" },
  { id: "mocha", name: "Mocha", mode: "dark", bg: "#16110f", side: "#16110f", surface: "#201915", surface2: "#2d231d", border: "#473829", text: "#f5ebe0", muted: "#b9a592", accent: "#e0a96d", accent2: "#d97757" },
  { id: "paper", name: "Paper", mode: "light", bg: "#f6f3ee", side: "#efeae2", surface: "#ffffff", surface2: "#f1ede6", border: "#ddd6c9", text: "#26231f", muted: "#7b7468", accent: "#c2410c", accent2: "#b45309" },
  { id: "sky", name: "Sky", mode: "light", bg: "#eef4fb", side: "#e6eef8", surface: "#ffffff", surface2: "#eaf1fa", border: "#cfdcec", text: "#14233a", muted: "#5d6f89", accent: "#2563eb", accent2: "#7c3aed" },
];
const VARS = ["bg", "side", "surface", "surface2", "border", "text", "muted", "accent", "accent2"];
// !important is needed because Cloudora writes its own theme as inline style on <html>
export const themeCss = (t) => `:root{${VARS.map((k) => `--${k}:${t[k]} !important`).join(";")};color-scheme:${t.mode} !important}`;

export default function register(api) {
  const { esc } = api.ui;
  let el = null;
  const apply = (id) => {
    el?.remove(); el = null;
    const t = THEMES.find((x) => x.id === id);
    if (!t) return;
    el = document.createElement("style"); el.dataset.plugin = "themes"; el.textContent = themeCss(t); document.head.appendChild(el);
  };
  apply(api.storage.get("theme", ""));
  api.onDispose(() => el?.remove());
  api.settings((box) => {
    const cur = api.storage.get("theme", "");
    box.innerHTML = `<div class="chips"><button type="button" class="chip${cur ? "" : " on"}" data-th="">Default</button>${THEMES.map((t) => `<button type="button" class="chip${cur === t.id ? " on" : ""}" data-th="${t.id}" style="border-left:14px solid ${t.accent}">${esc(t.name)}</button>`).join("")}</div>`;
    box.querySelectorAll("[data-th]").forEach((b) => b.onclick = () => {
      api.storage.set("theme", b.dataset.th); apply(b.dataset.th);
      box.querySelectorAll("[data-th]").forEach((x) => x.classList.toggle("on", x === b));
    });
  });
}
