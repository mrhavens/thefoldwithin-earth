/* ============================================================
   Self-Organizing Static Site Framework  v2.3.3
   ============================================================ */

let INDEX, CURRENT_PATH = null, PATH_TO_EL = new Map();

const treeEl    = document.getElementById("tree");
const mdView    = document.getElementById("mdView");
const htmlView  = document.getElementById("htmlView");
const metaLine  = document.getElementById("meta");
const sortSel   = document.getElementById("sort");
const filterSel = document.getElementById("filter");
const searchBox = document.getElementById("search");
const prevBtn   = document.getElementById("prev");
const nextBtn   = document.getElementById("next");
const sidebar   = document.querySelector(".sidebar");
const navToggle = document.getElementById("navToggle");
const overlay   = document.querySelector(".overlay");

/* ------------------------------------------------------------
   Utility: ensure external libs are ready before running
------------------------------------------------------------- */
async function ensureLibsReady() {
  let tries = 0;
  while ((!window.marked || !window.DOMPurify) && tries < 40) {
    await new Promise(r => setTimeout(r, 100));
    tries++;
  }
  if (!window.marked) console.warn("⚠️ marked.js not detected — markdown will show as plain text.");
  if (!window.DOMPurify) console.warn("⚠️ DOMPurify not detected — HTML not sanitized.");
}

/* ------------------------------------------------------------
   Sidebar toggle and overlay
------------------------------------------------------------- */
navToggle.addEventListener("click", () => sidebar.classList.toggle("open"));
overlay.addEventListener("click",  () => sidebar.classList.remove("open"));

/* ------------------------------------------------------------
   Load and render index.json
------------------------------------------------------------- */
async function loadIndex() {
  await ensureLibsReady();
  const res = await fetch("/index.json", { cache: "no-store" });
  INDEX = await res.json();
  populateFilters();
  rebuildTree();

  window.addEventListener("popstate", () => {
    const hp = location.hash.startsWith("#=") ? location.hash.slice(2) : null;
    if (hp) openPath(hp);
  });

  const init = location.hash.startsWith("#=")
    ? location.hash.slice(2)
    : INDEX.flat.sort((a,b)=>b.mtime-a.mtime)[0]?.path;

  openPath(init);
}

function populateFilters() {
  filterSel.innerHTML = '<option value="all">All</option>';
  for (const cat of INDEX.sections) {
    const o = document.createElement("option");
    o.value = o.textContent = cat;
    filterSel.appendChild(o);
  }
}

/* ------------------------------------------------------------
   Build directory tree
------------------------------------------------------------- */
function rebuildTree() {
  treeEl.innerHTML = "";
  PATH_TO_EL.clear();
  const filter = filterSel.value;
  const sort   = sortSel.value;
  const query  = searchBox.value.trim().toLowerCase();
  const root   = { type: "dir", children: INDEX.tree };
  const pruned = filterTree(root, f =>
    (filter==="all" || f.path.split("/")[0]===filter) &&
    (!query || (f.title||f.name).toLowerCase().includes(query))
  );
  sortDir(pruned, sort);
  for (const c of pruned.children) treeEl.appendChild(renderNode(c));
  treeEl.querySelectorAll(".dir").forEach(d => d.classList.add("open"));
}

function filterTree(node, keep) {
  if (node.type === "file") return keep(node) ? node : null;
  const kids = node.children.map(c=>filterTree(c,keep)).filter(Boolean);
  return kids.length ? {...node, children:kids} : null;
}

function sortDir(node, sort) {
  const cmp = sort==="name" ? (a,b)=>a.name.localeCompare(b.name)
            : sort==="old" ? (a,b)=>a.mtime-b.mtime
            : (a,b)=>b.mtime-a.mtime;
  node.children.sort((a,b)=>
    (a.type==="dir"&&b.type!=="dir")?-1:
    (a.type!=="dir"&&b.type==="dir")?1:cmp(a,b));
  node.children.forEach(c=>c.type==="dir"&&sortDir(c,sort));
}

function renderNode(n) {
  if (n.type==="dir") {
    const d = document.createElement("div");
    d.className="dir"; d.setAttribute("aria-expanded","false");
    const lbl=document.createElement("span");
    lbl.className="label"; lbl.textContent=n.name||"/";
    lbl.addEventListener("click",()=>{
      const idx=n.children.find(c=>c.type==="file"&&/^index\.(md|html)$/i.test(c.name));
      if(idx) openPath(idx.path); else d.classList.toggle("open");
    });
    d.appendChild(lbl);
    const kids=document.createElement("div");
    kids.className="children";
    n.children.forEach(c=>kids.appendChild(renderNode(c)));
    d.appendChild(kids);
    return d;
  }
  const a=document.createElement("a");
  a.className="file";
  a.innerHTML=`${n.pinned?'📌 ':''}${iconForExt(n.ext)} ${n.title}
               <span class="meta">(${fmtDate(n.mtime)} · ${n.name})</span>`;
  a.addEventListener("click",e=>{e.preventDefault();openPath(n.path);});
  PATH_TO_EL.set(n.path,a);
  return a;
}

function iconForExt(ext){return ext===".md"?"📝":"🧩";}
function fmtDate(ms){return new Date(ms).toISOString().slice(0,10);}

/* ------------------------------------------------------------
   Path navigation
------------------------------------------------------------- */
function findDir(p){
  p=p.replace(/\/$/,'');
  function search(n){
    if(n.type==="dir"&&n.path===p) return n;
    for(const c of n.children||[]){const f=search(c);if(f)return f;}
  }
  return search({children:INDEX.tree});
}

async function openPath(path){
  if(path===CURRENT_PATH) return;
  CURRENT_PATH=path;
  if(location.hash!==`#=${path}`) history.pushState(null,"",`#=${path}`);

  let f=INDEX.flat.find(x=>x.path===path);
  if(!f){
    const dir=findDir(path);
    if(dir){
      const idx=dir.children.find(c=>c.type==="file"&&/^index\.(md|html)$/i.test(c.name));
      if(idx) return openPath(idx.path);
    }
    metaLine.textContent="Path not found: "+path;
    return;
  }

  metaLine.textContent=`${f.pinned?"📌 ":""}${fmtDate(f.mtime)} • ${f.name}`;
  if(f.ext===".md") await renderMarkdown(f.path);
  else renderHTML(f.path);
  setActive(path);
  updatePager();
  if(window.innerWidth<900) sidebar.classList.remove("open");
}

/* ------------------------------------------------------------
   Markdown rendering (stable version)
------------------------------------------------------------- */
async function renderMarkdown(path){
  mdView.innerHTML="<p style='color:var(--muted);font-style:italic;'>Loading…</p>";
  htmlView.style.display="none";
  mdView.style.display="block";

  try{
    const res=await fetch("/"+path);
    if(!res.ok) throw new Error("File not found: "+path);
    const text=await res.text();

    let html=text.replace(/&/g,"&amp;").replace(/</g,"&lt;");
    let usedFallback=true;
    if(window.marked){ html=window.marked.parse(text); usedFallback=false; }
    let safe=html;
    if(window.DOMPurify) safe=window.DOMPurify.sanitize(html);

    requestAnimationFrame(()=>{
      mdView.innerHTML=safe;
      mdView.scrollTop=0;                // reset scroll to top
      mdView.classList.add("fade-in");
      mdView.style.display="block";
    });

    if(usedFallback) console.warn("Markdown rendered as plain text (marked.js missing).");
  }catch(e){
    mdView.innerHTML=`<p style='color:red;'>${e.message}</p>`;
  }
}

/* ------------------------------------------------------------
   HTML rendering
------------------------------------------------------------- */
function renderHTML(path){
  htmlView.src="/"+path;
  htmlView.style.display="block";
  mdView.style.display="none";
}

/* ------------------------------------------------------------
   Active state + pager
------------------------------------------------------------- */
function setActive(path){
  document.querySelectorAll(".file.active").forEach(el=>el.classList.remove("active"));
  const el=PATH_TO_EL.get(path);
  if(el){
    el.classList.add("active");
    let p=el.parentElement;
    while(p&&p!==treeEl){
      if(p.classList.contains("children")) p.parentElement.classList.add("open");
      p=p.parentElement;
    }
  }
}

function updatePager(){
  const q=searchBox.value.trim().toLowerCase();
  const list=INDEX.flat.filter(f=>
    (filterSel.value==="all"||f.path.split("/")[0]===filterSel.value)&&
    (!q||f.title.toLowerCase().includes(q))
  );
  const cmp=sortSel.value==="name"?(a,b)=>a.name.localeCompare(b.name)
            :sortSel.value==="old"?(a,b)=>a.mtime-b.mtime
            :(a,b)=>b.mtime-a.mtime;
  list.sort(cmp);
  const i=list.findIndex(x=>x.path===CURRENT_PATH);
  prevBtn.disabled=i<=0;
  nextBtn.disabled=i>=list.length-1||i<0;
  prevBtn.onclick=()=>i>0&&openPath(list[i-1].path);
  nextBtn.onclick=()=>i<list.length-1&&openPath(list[i+1].path);
}

/* ------------------------------------------------------------
   Search / filter / sort
------------------------------------------------------------- */
let searchTimer;
searchBox.addEventListener("input",()=>{
  clearTimeout(searchTimer);
  searchTimer=setTimeout(rebuildTree,300);
});
sortSel.addEventListener("change",rebuildTree);
filterSel.addEventListener("change",rebuildTree);

/* ------------------------------------------------------------
   Internal link interception
------------------------------------------------------------- */
document.body.addEventListener("click",e=>{
  const a=e.target.closest("a[href]");
  if(!a) return;
  const href=a.getAttribute("href");
  if(href.startsWith("/")&&!href.startsWith("//")&&!a.target){
    e.preventDefault();
    openPath(href.replace(/^\//,""));
  }
});

window.addEventListener("resize",()=>{ if(window.innerWidth<900) sidebar.classList.remove("open"); });
window.addEventListener("DOMContentLoaded",loadIndex);