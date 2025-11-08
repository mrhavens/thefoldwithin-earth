// Elements
const sidebar   = document.getElementById("sidebar");
const treeEl    = document.getElementById("tree");
const metaEl    = document.getElementById("meta");
const mdView    = document.getElementById("mdView");
const htmlView  = document.getElementById("htmlView");
const errorBox  = document.getElementById("errorBox");
const sortSel   = document.getElementById("sortSel");
const filterSel = document.getElementById("filterSel");
const searchBox = document.getElementById("searchBox");
const navToggle = document.getElementById("navToggle");
const backdrop  = document.getElementById("backdrop");

// State
let INDEX = null;
let CURRENT_PATH = null;
let PATH_TO_EL = new Map();

// Drawer controls (mobile)
navToggle.addEventListener("click", () => sidebar.classList.toggle("open"));
backdrop.addEventListener("click", () => sidebar.classList.remove("open"));

// -------- Boot --------
window.addEventListener("DOMContentLoaded", async () => {
  await loadIndex();
  if (!INDEX) return;

  sortSel.addEventListener("change", rebuildTree);
  filterSel.addEventListener("change", rebuildTree);
  searchBox.addEventListener("input", rebuildTree);

  window.addEventListener("popstate", () => {
    const hp = location.hash.startsWith("#=") ? location.hash.slice(2) : null;
    if (hp) openPath(hp, {push:false});
  });

  const initial = location.hash.startsWith("#=") ? location.hash.slice(2) : null;
  if (initial) openPath(initial, {push:false});
  else autoOpenLatest();
});

// -------- Data loading --------
async function loadIndex() {
  try{
    const res = await fetch("index.json",{cache:"no-store"});
    INDEX = await res.json();
    rebuildTree();
  }catch(e){
    treeEl.innerHTML = "<p style='color:#ff7a7a'>index.json missing. run the build.</p>";
  }
}

// -------- Tree building / sorting / filtering --------
function rebuildTree() {
  if (!INDEX) return;
  PATH_TO_EL.clear();
  treeEl.innerHTML = "";

  const sort = sortSel.value;
  const filter = filterSel.value;
  const query = searchBox.value.trim().toLowerCase();

  const roots = INDEX.tree
    .filter(d => filter==="all" || d.name===filter)
    .map(d => deepClone(d));

  roots.forEach(r => {
    applySort(r, sort);
    const filtered = applySearch(r, query);
    if (filtered) treeEl.appendChild(renderNode(filtered));
  });

  // Auto-expand top dirs
  treeEl.querySelectorAll(".dir").forEach(d => d.classList.add("open"));
}

function deepClone(obj){ return JSON.parse(JSON.stringify(obj)); }
function getDate(n){ return n.mtime || 0; }

function applySort(dir, sort) {
  if (dir.type !== "dir") return;
  const cmp =
    sort==="alpha" ? (a,b)=> (a.title||a.name).localeCompare(b.title||b.name) :
    sort==="old"   ? (a,b)=> getDate(a)-getDate(b) :
                     (a,b)=> getDate(b)-getDate(a);
  dir.children.sort((a,b)=>{
    if (a.type!==b.type){ return a.type==="dir" ? -1 : 1; } // dirs first
    return cmp(a,b);
  });
  dir.children.forEach(c => c.type==="dir" && applySort(c, sort));
}

function applySearch(node, q) {
  if (!q) return node;
  if (node.type==="file"){
    const t = (node.title||node.name).toLowerCase();
    return t.includes(q)? node : null;
  }
  const kids = node.children.map(c=>applySearch(c,q)).filter(Boolean);
  if (!kids.length) return null;
  node.children = kids;
  return node;
}

// Recursive renderer
function renderNode(node){
  if (node.type==="dir"){
    const wrap = document.createElement("div");
    wrap.className = "dir";
    wrap.setAttribute("role","treeitem");
    const lbl = document.createElement("div");
    lbl.className = "label";
    lbl.textContent = node.name;
    lbl.addEventListener("click", () => wrap.classList.toggle("open"));
    const kids = document.createElement("div");
    kids.className = "children";
    node.children.forEach(c => kids.appendChild(renderNode(c)));
    wrap.append(lbl, kids);
    return wrap;
  } else {
    const a = document.createElement("a");
    a.className = "file";
    a.setAttribute("role","treeitem");
    a.href = `#=${node.path}`;
    a.innerHTML = `${node.pinned?'<span class="pin">PIN</span> ':''}${escapeHtml(node.title||node.name)}`;
    a.addEventListener("click", e => { e.preventDefault(); openPath(node.path); });
    PATH_TO_EL.set(node.path, a);
    return a;
  }
}

function escapeHtml(s){ return s.replace(/[&<>"']/g,c=>({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;" }[c])); }

// -------- Opening / rendering files --------
function autoOpenLatest(){
  if (!INDEX?.flat?.length) return;
  const latest = [...INDEX.flat].sort((a,b)=>getDate(b)-getDate(a))[0];
  if (latest) openPath(latest.path,{push:false});
}

async function openPath(path,{push=true}={}){
  if (!INDEX) return;
  if (path===CURRENT_PATH) return;
  const f = INDEX.flat.find(x=>x.path===path);
  if (!f){ showError("File not found."); return; }

  CURRENT_PATH = path;
  if (push && location.hash!==`#=${path}`) history.pushState(null,"",`#=${path}`);

  hideError();
  setActive(path);
  metaEl.textContent = `${f.pinned?"Pinned • ":""}${new Date(getDate(f)).toISOString().slice(0,10)} • ${f.title||f.name}`;

  if (f.ext === ".md") {
    await renderMarkdown(path);
  } else {
    renderHTML(path);
  }

  // close drawer on mobile
  if (window.innerWidth < 900) sidebar.classList.remove("open");
}

async function renderMarkdown(path){
  htmlView.style.display="none";
  mdView.style.display="block";
  try{
    const res = await fetch(path,{cache:"no-store"});
    if (!res.ok) throw new Error(res.statusText);
    const txt = await res.text();
    const html = window.DOMPurify?.sanitize(window.marked?.parse(txt) || txt) || txt;
    mdView.innerHTML = html;
  }catch(e){
    showError("Failed to load Markdown.");
  }
}

function renderHTML(path){
  mdView.style.display="none";
  htmlView.style.display="block";
  htmlView.src = path;
}

function setActive(path){
  document.querySelectorAll(".file.active").forEach(el=>el.classList.remove("active"));
  const el = PATH_TO_EL.get(path);
  if (el) el.classList.add("active");
}

function showError(msg){ errorBox.textContent = msg; errorBox.hidden = false; }
function hideError(){ errorBox.hidden = true; }