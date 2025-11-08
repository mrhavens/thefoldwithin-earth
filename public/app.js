/* global marked, DOMPurify */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const state = {
  index: null,
  sidebarOpen: false,      // mobile overlay (<=1024)
  desktopCollapsed: false, // desktop collapse
  sort: "newest",
  section: "all",
  q: ""
};

const els = {
  body: document.body,
  sidebar: $("#sidebar"),
  content: $("#content"),
  viewer: $("#viewer"),
  tree: $("#tree"),
  routeHint: $("#routeHint"),
  navToggle: $("#navToggle"),
  filterSection: $("#filterSection"),
  sortOrder: $("#sortOrder"),
  searchBox: $("#searchBox"),
};

init();

async function init(){
  // restore preferences
  try {
    state.desktopCollapsed = localStorage.getItem("desktopCollapsed") === "1";
  } catch {}

  // set collapse classes for initial paint
  if (window.matchMedia("(min-width:1025px)").matches) {
    els.body.classList.toggle("sidebar-collapsed", state.desktopCollapsed);
    els.body.classList.add("sidebar-open"); // open on desktop unless collapsed
  }

  els.navToggle.addEventListener("click", toggleSidebar);

  window.addEventListener("resize", onResizeMode);
  window.addEventListener("hashchange", onRoute);
  onResizeMode(); // set initial open/closed class for mobile/desktop

  // Fetch index
  try {
    const res = await fetch("/index.json", { cache: "no-cache" });
    if (!res.ok) throw new Error(res.status + " " + res.statusText);
    state.index = await res.json();
  } catch (e) {
    console.error("Failed to load index.json", e);
    els.viewer.innerHTML = `<p style="color:#f66">Could not load index.json</p>`;
    return;
  }

  // Build filters
  buildFilters();

  // Render tree
  renderTree();

  // Route initial
  onRoute();
}

/* ---------- UI wiring ---------- */

function onResizeMode(){
  const desktop = window.matchMedia("(min-width:1025px)").matches;

  if (desktop) {
    // Desktop: overlay classes off; use collapsed flag to shift layout
    els.body.classList.remove("sidebar-open");
    els.body.classList.toggle("sidebar-collapsed", state.desktopCollapsed);
    els.navToggle.setAttribute("aria-expanded", (!state.desktopCollapsed).toString());
  } else {
    // Mobile: collapsed flag irrelevant; use overlay class instead
    els.body.classList.remove("sidebar-collapsed");
    if (!state.sidebarOpen) els.body.classList.remove("sidebar-open");
    els.navToggle.setAttribute("aria-expanded", state.sidebarOpen.toString());
  }
}

function toggleSidebar(){
  const desktop = window.matchMedia("(min-width:1025px)").matches;
  if (desktop){
    state.desktopCollapsed = !els.body.classList.contains("sidebar-collapsed");
    els.body.classList.toggle("sidebar-collapsed");
    els.navToggle.setAttribute("aria-expanded", (!state.desktopCollapsed).toString());
    try { localStorage.setItem("desktopCollapsed", state.desktopCollapsed ? "1" : "0"); } catch {}
  } else {
    state.sidebarOpen = !els.body.classList.contains("sidebar-open");
    els.body.classList.toggle("sidebar-open");
    els.navToggle.setAttribute("aria-expanded", state.sidebarOpen.toString());
  }
}

function buildFilters(){
  const sections = ["all", ...state.index.sections];
  els.filterSection.innerHTML = sections.map(s =>
    `<option value="${s}">${capitalize(s)}</option>`
  ).join("");
  els.filterSection.value = state.section;

  els.filterSection.addEventListener("change", e => {
    state.section = e.target.value;
    renderTree();
  });

  els.sortOrder.value = state.sort;
  els.sortOrder.addEventListener("change", e => {
    state.sort = e.target.value;
    renderTree();
  });

  els.searchBox.addEventListener("input", e => {
    state.q = e.target.value.trim().toLowerCase();
    renderTree();
  });
}

function renderTree(){
  if (!state.index) return;
  const items = state.index.flat.slice();

  // filter
  const filtered = items.filter(f => {
    const inSection = state.section === "all" || f.path.startsWith(state.section + "/");
    const inQuery = !state.q || f.title.toLowerCase().includes(state.q) || f.name.toLowerCase().includes(state.q);
    return inSection && inQuery;
  });

  // sort
  filtered.sort((a,b) => {
    if (state.sort === "title") return a.title.localeCompare(b.title, undefined, {sensitivity:"base"});
    if (state.sort === "oldest") return (a.mtime ?? 0) - (b.mtime ?? 0);
    return (b.mtime ?? 0) - (a.mtime ?? 0); // newest
  });

  // render
  els.tree.innerHTML = filtered.map(f => {
    const d = new Date(f.mtime || Date.now());
    const meta = `${d.toISOString().slice(0,10)} • ${f.name}`;
    return `
      <a href="#=${encodeURIComponent(f.path)}" data-path="${f.path}">
        <div class="title">${escapeHtml(f.title)}</div>
        <div class="meta">${meta}</div>
      </a>
    `;
  }).join("");

  // close overlay on mobile after click
  els.tree.addEventListener("click", evt => {
    const link = evt.target.closest("a[data-path]");
    if (!link) return;
    if (!window.matchMedia("(min-width:1025px)").matches){
      els.body.classList.remove("sidebar-open");
      state.sidebarOpen = false;
      els.navToggle.setAttribute("aria-expanded", "false");
    }
  }, { once:true });
}

/* ---------- Routing & rendering ---------- */

function onRoute(){
  const raw = location.hash || "#/";
  const [, path = "/"] = raw.split("#=");
  const decoded = decodeURIComponent(path);

  els.routeHint.textContent = decoded === "/" ? "" : decoded;

  if (decoded === "/" || decoded === "") {
    els.viewer.innerHTML = `
      <div class="empty">
        <h1>The Fold Within</h1>
        <p>Select a note on the left.</p>
      </div>`;
    return;
  }

  // security: lock to /public files only
  if (decoded.includes("..")) {
    els.viewer.textContent = "Invalid path.";
    return;
  }

  const ext = decoded.split(".").pop().toLowerCase();
  if (ext === "md") return renderMarkdown(decoded);
  if (ext === "html") return renderHTML(decoded);
  // default: try as md first, then html
  return renderMarkdown(decoded).catch(() => renderHTML(decoded));
}

async function renderMarkdown(relPath){
  const res = await fetch("/" + relPath, { cache:"no-cache" });
  if (!res.ok) throw new Error("not found");
  const text = await res.text();

  const html = marked.parse(text, { mangle:false, headerIds:true });
  const safe = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: false,   // allow default safe list
    ALLOWED_ATTR: false
  });

  els.viewer.innerHTML = safe;
  // ensure the top of the article is visible on load without giant spacers
  els.viewer.scrollIntoView({ block:"start", behavior:"instant" });
}

async function renderHTML(relPath){
  // Use an iframe for full HTML notes, auto-height to remove any blank space
  const iframe = document.createElement("iframe");
  iframe.setAttribute("sandbox", "allow-same-origin allow-scripts allow-forms");
  iframe.style.width = "100%";
  iframe.style.border = "0";
  iframe.loading = "eager";

  // Clear, mount, then size after load
  els.viewer.innerHTML = "";
  els.viewer.appendChild(iframe);
  iframe.src = "/" + relPath;

  const sizeIframe = () => {
    try {
      const doc = iframe.contentDocument || iframe.contentWindow.document;
      const h = Math.max(
        doc.body.scrollHeight,
        doc.documentElement.scrollHeight
      );
      iframe.style.height = h + "px";
    } catch { /* cross-origin shouldn't happen here */ }
  };

  iframe.addEventListener("load", () => {
    sizeIframe();
    // resize observer for dynamic html (images etc.)
    try {
      const ro = new ResizeObserver(sizeIframe);
      ro.observe(iframe.contentDocument.documentElement);
    } catch { /* not critical */ }
    // also a delayed pass for images/fonts
    setTimeout(sizeIframe, 250);
    setTimeout(sizeIframe, 800);
  });
}

/* ---------- Helpers ---------- */
function capitalize(s){ return s.charAt(0).toUpperCase() + s.slice(1) }
function escapeHtml(s){ return s.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])) }