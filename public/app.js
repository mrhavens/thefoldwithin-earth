/* app.js (v2.0.0)
 * - loads /index.json (generated at build)
 * - builds collapsible tree (left)
 * - renders HTML in sandboxed iframe OR Markdown via marked+DOMPurify
 * - default sort: date (new→old). toggle to alpha.
 * - deep links: #=/posts/foo.md
 */

let INDEX = null;
let CURRENT_PATH = null;
let PATH_TO_EL = new Map();

const treeEl = document.getElementById("tree");
const sortSel = document.getElementById("sort");
const filterSel = document.getElementById("filter");
const iframe = document.getElementById("htmlFrame");
const mdBox  = document.getElementById("mdContainer");
const metaEl = document.getElementById("meta");

const ICONS = {
  ".md": "📝",
  ".html": "🧩",
  "dir": "🗂️"
};

function icon(ext){ return ICONS[ext] || "📄"; }

function humanDate(ms){
  const d = new Date(ms || 0);
  if (!ms) return "";
  return d.toISOString().slice(0,10);
}

function applySort(list, mode){
  const arr = list.slice();
  if (mode === "alpha") {
    arr.sort((a,b)=> a.title.localeCompare(b.title));
  } else {
    arr.sort((a,b)=> (b.mtime||0)-(a.mtime||0)); // new → old
  }
  return arr;
}

function filterFlat(list, filter){
  if (filter === "pinned") return list.filter(x=>x.pinned);
  if (filter === "posts")  return list.filter(x=>!x.pinned);
  return list;
}

function filterTree(node, allowedSet){
  if (node.type === "file") return allowedSet.has(node.path) ? node : null;
  const kids = [];
  for (const c of node.children||[]){
    const f = filterTree(c, allowedSet);
    if (f) kids.push(f);
  }
  return { ...node, children: kids };
}

function buildNode(node){
  if (node.type === "dir"){
    const wrap = document.createElement("div");
    wrap.className = "tree-node dir";
    wrap.setAttribute("role","treeitem");
    wrap.setAttribute("aria-expanded","false");

    const label = document.createElement("div");
    label.className = "dir-label";
    label.innerHTML = `<span>${icon("dir")}</span><strong>${node.name}</strong>`;
    label.addEventListener("click", ()=>{
      const open = wrap.classList.toggle("open");
      wrap.setAttribute("aria-expanded", open?"true":"false");
    });
    wrap.appendChild(label);

    const children = document.createElement("div");
    children.className = "children";
    for (const c of node.children || []){
      children.appendChild(buildNode(c));
    }
    wrap.appendChild(children);
    return wrap;
  } else {
    const a = document.createElement("a");
    a.className = "file";
    a.setAttribute("role","treeitem");
    a.href = `#=${node.path}`;
    a.innerHTML = `${node.pinned ? '<span class="pin">PIN</span>' : ''}${icon(node.ext)} ${node.title} <span class="meta">${humanDate(node.mtime)} · ${node.name}</span>`;
    a.addEventListener("click", (e)=>{
      e.preventDefault();
      openPath(node.path);
    });
    PATH_TO_EL.set(node.path, a);
    return a;
  }
}

function setActive(path){
  document.querySelectorAll(".file.active").forEach(el=>el.classList.remove("active"));
  const el = PATH_TO_EL.get(path);
  if (el){
    el.classList.add("active");
    // ensure ancestors open
    let p = el.parentElement;
    while (p && p !== treeEl){
      if (p.classList.contains("dir")){
        p.classList.add("open");
        p.setAttribute("aria-expanded","true");
      }
      p = p.parentElement;
    }
    el.scrollIntoView({ block:"nearest", behavior:"smooth" });
  }
}

function rebuildTree(){
  PATH_TO_EL.clear();
  treeEl.innerHTML = "";
  // compute filtered/sorted flat set
  const sorted = applySort(filterFlat(INDEX.flat, filterSel.value), sortSel.value);
  const allowed = new Set(sorted.map(x=>x.path));
  const filteredTree = filterTree(INDEX.tree, allowed);
  treeEl.appendChild(buildNode(filteredTree));
  // expand top-level
  treeEl.querySelectorAll(".dir").forEach(d=>d.classList.add("open"));
}

async function renderMarkdown(path){
  iframe.hidden = true;
  mdBox.hidden = false;

  const res = await fetch(path, { cache: "no-cache" });
  if (!res.ok) throw new Error(`fetch ${path} ${res.status}`);
  const txt = await res.text();
  // marked is global when CDN loads; fallback to plain text if missing
  const rawHtml = (window.marked ? window.marked.parse(txt) : `<pre>${txt.replace(/[&<>]/g, s=>({ "&":"&amp;","<":"&lt;",">":"&gt;" }[s]))}</pre>`);
  const safe = (window.DOMPurify ? window.DOMPurify.sanitize(rawHtml) : rawHtml);
  mdBox.innerHTML = safe;
}

async function renderHTML(path){
  mdBox.hidden = true;
  iframe.hidden = false;
  iframe.src = path;
}

async function openPath(path){
  if (!path || path === CURRENT_PATH) return;
  CURRENT_PATH = path;
  if (location.hash !== `#=${path}`) history.pushState(null,"",`#=${path}`);

  const entry = INDEX.flat.find(x=>x.path === path);
  if (!entry) return;

  metaEl.textContent = `${entry.pinned ? "Pinned • " : ""}${humanDate(entry.mtime)} • ${entry.path}`;
  setActive(path);

  if (entry.ext === ".md") await renderMarkdown(path);
  else await renderHTML(path);
}

async function boot(){
  try{
    const res = await fetch("/index.json", { cache: "no-cache" });
    INDEX = await res.json();
  } catch (e){
    treeEl.innerHTML = "<p style='color:#f66'>index.json missing. run the build.</p>";
    return;
  }

  sortSel.addEventListener("change", rebuildTree);
  filterSel.addEventListener("change", rebuildTree);

  rebuildTree();

  // choose initial route
  const hashPath = location.hash.startsWith("#=") ? location.hash.slice(2) : null;
  if (hashPath) {
    openPath(hashPath);
  } else {
    // default: newest among current filter
    const sorted = applySort(filterFlat(INDEX.flat, filterSel.value), "date");
    if (sorted.length) openPath(sorted[0].path);
  }

  window.addEventListener("popstate", ()=>{
    const hp = location.hash.startsWith("#=") ? location.hash.slice(2) : null;
    if (hp && hp !== CURRENT_PATH) openPath(hp);
  });
}

boot();