/* global marked, DOMPurify */
const $  = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => [...r.querySelectorAll(s)];

const els = {
  body: document.body,
  sidebar: $("#sidebar"),
  content: $("#content"),
  viewer: $("#viewer"),
  tree: $("#tree"),
  navToggle: $("#navToggle"),
  filterSection: $("#filterSection"),
  sortOrder: $("#sortOrder"),
  searchBox: $("#searchBox"),
};

const state = {
  index: null,
  section: "all",
  sort: "newest",
  q: "",
  sidebarOpen: false,
  desktopCollapsed: false
};

init();

async function init(){
  const ok = await waitForLibs(3000);
  if (!ok){
    els.viewer.innerHTML = `<p style="color:#f66">Markdown renderer failed to load. Check /lib/marked.min.js and /lib/purify.min.js.</p>`;
    return;
  }

  try { state.desktopCollapsed = localStorage.getItem("desktopCollapsed")==="1"; } catch {}

  wireToggles();
  onResizeMode();

  try{
    const res = await fetch("/index.json", { cache:"no-cache" });
    if (!res.ok) throw new Error(res.status);
    state.index = await res.json();
  }catch(e){
    console.error("index.json load failed", e);
    els.viewer.innerHTML = `<p style="color:#f66">Could not load index.json</p>`;
    return;
  }

  buildFilters();
  renderTree();

  window.addEventListener("hashchange", onRoute);
  onRoute();
}

/* ---------- Lib readiness ---------- */
function waitForLibs(timeoutMs=3000){
  const start = performance.now();
  return new Promise(resolve=>{
    (function tick(){
      const ready = !!(window.marked && window.DOMPurify);
      if (ready) return resolve(true);
      if (performance.now() - start > timeoutMs) return resolve(false);
      setTimeout(tick, 60);
    })();
  });
}

/* ---------- UI wiring ---------- */
function wireToggles(){
  els.navToggle.addEventListener("click", ()=>{
    const desktop = window.matchMedia("(min-width:1025px)").matches;
    if (desktop){
      state.desktopCollapsed = !els.body.classList.contains("sidebar-collapsed");
      els.body.classList.toggle("sidebar-collapsed");
      try{ localStorage.setItem("desktopCollapsed", state.desktopCollapsed ? "1":"0"); }catch{}
    }else{
      state.sidebarOpen = !els.body.classList.contains("sidebar-open");
      els.body.classList.toggle("sidebar-open");
    }
  });

  window.addEventListener("resize", onResizeMode);
}

function onResizeMode(){
  const desktop = window.matchMedia("(min-width:1025px)").matches;
  if (desktop){
    els.body.classList.remove("sidebar-open");
    els.body.classList.toggle("sidebar-collapsed", state.desktopCollapsed);
  } else {
    els.body.classList.remove("sidebar-collapsed");
    if (!state.sidebarOpen) els.body.classList.remove("sidebar-open");
  }
}

function buildFilters(){
  const sections = ["all", ...(state.index?.sections ?? [])];
  els.filterSection.innerHTML = sections.map(s=>`<option value="${s}">${cap(s)}</option>`).join("");
  els.filterSection.value = state.section;

  els.filterSection.addEventListener("change", e=>{
    state.section = e.target.value;
    renderTree();
  });

  els.sortOrder.value = state.sort;
  els.sortOrder.addEventListener("change", e=>{
    state.sort = e.target.value;
    renderTree();
  });

  els.searchBox.addEventListener("input", e=>{
    state.q = e.target.value.trim().toLowerCase();
    renderTree();
  });
}

/* ---------- Tree ---------- */
function renderTree(){
  if (!state.index) return;
  const items = state.index.flat.slice();

  const filtered = items.filter(f=>{
    const inSection = state.section==="all" || f.path.startsWith(state.section + "/");
    const inQuery = !state.q || f.title.toLowerCase().includes(state.q) || f.name.toLowerCase().includes(state.q);
    return inSection && inQuery;
  });

  filtered.sort((a,b)=>{
    if (state.sort==="title")  return a.title.localeCompare(b.title, undefined, {sensitivity:"base"});
    if (state.sort==="oldest") return (a.mtime??0) - (b.mtime??0);
    return (b.mtime??0) - (a.mtime??0);
  });

  els.tree.innerHTML = filtered.map(f=>{
    const d = new Date(f.mtime || Date.now());
    const meta = `${d.toISOString().slice(0,10)} • ${f.name}`;
    return `<a href="#=${encodeURIComponent(f.path)}" data-path="${f.path}">
      <div class="title">${esc(f.title)}</div>
      <div class="meta">${meta}</div>
    </a>`;
  }).join("");

  els.tree.addEventListener("click", (evt)=>{
    if (!evt.target.closest("a[data-path]")) return;
    if (!window.matchMedia("(min-width:1025px)").matches){
      els.body.classList.remove("sidebar-open");
      state.sidebarOpen = false;
    }
  }, { once:true });
}

/* ---------- Routing & Rendering ---------- */
function onRoute(){
  const hash = location.hash || "#/";
  const sectionMatch = hash.match(/^#\/(essays|fieldnotes|posts)\/?$/i);
  if (sectionMatch){
    state.section = sectionMatch[1].toLowerCase();
    els.filterSection.value = state.section;
    renderTree();
    els.viewer.innerHTML = `<div class="empty"><h1>${cap(state.section)}</h1><p>Select a note on the left.</p></div>`;
    return;
  }

  const [, rawPath=""] = hash.split("#=");
  const rel = decodeURIComponent(rawPath);

  if (!rel){
    els.viewer.innerHTML = `<div class="empty"><h1>The Fold Within</h1><p>Select a note on the left.</p></div>`;
    return;
  }

  if (rel.includes("..")){ els.viewer.textContent = "Invalid path."; return; }

  const ext = rel.split(".").pop().toLowerCase();
  if (ext==="md") return renderMarkdown(rel);
  if (ext==="html") return renderHTML(rel);
  renderMarkdown(rel).catch(()=>renderHTML(rel));
}

async function renderMarkdown(rel){
  const res = await fetch("/" + rel, { cache:"no-cache" });
  if (!res.ok) throw new Error("not found");
  const text = await res.text();

  const html = window.marked.parse(text, { mangle:false, headerIds:true });
  const safe = window.DOMPurify.sanitize(html);
  els.viewer.innerHTML = safe;

  els.viewer.scrollIntoView({ block:"start", behavior:"instant" });
}

async function renderHTML(rel){
  const iframe = document.createElement("iframe");
  iframe.setAttribute("sandbox","allow-same-origin allow-scripts allow-forms");
  iframe.style.width = "100%";
  iframe.style.border = "0";
  iframe.style.margin = "0";
  iframe.loading = "eager";

  els.viewer.innerHTML = "";
  els.viewer.appendChild(iframe);
  iframe.src = "/" + rel;

  const size = ()=>{
    try{
      const d = iframe.contentDocument || iframe.contentWindow.document;
      const h = Math.max(d.body.scrollHeight, d.documentElement.scrollHeight);
      iframe.style.height = h + "px";
    }catch{}
  };

  iframe.addEventListener("load", ()=>{
    try{
      const d = iframe.contentDocument || iframe.contentWindow.document;

      // 🔒 Reset default UA margins so content sits flush like Markdown
      const s = d.createElement("style");
      s.textContent = `
        html,body{margin:0;padding:0;background:transparent}
        body>*:first-child{margin-top:0}
      `;
      d.head.appendChild(s);

      // Track dynamic growth
      try{
        const ro = new ResizeObserver(size);
        ro.observe(d.documentElement);
        ro.observe(d.body);
      }catch{}
    }catch{}

    size();
    setTimeout(size, 250);
    setTimeout(size, 800);
  });
}

/* ---------- Utils ---------- */
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const esc = s => s.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));