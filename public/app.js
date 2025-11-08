let INDEX, CURRENT_PATH = null, PATH_TO_EL = new Map();
const treeEl = document.getElementById("tree");
const mdView = document.getElementById("mdView");
const htmlView = document.getElementById("htmlView");
const metaLine = document.getElementById("meta");
const sortSel = document.getElementById("sort");
const filterSel = document.getElementById("filter");
const searchBox = document.getElementById("search");
const prevBtn = document.getElementById("prev");
const nextBtn = document.getElementById("next");

async function loadIndex() {
  const res = await fetch("/index.json", { cache: "no-store" });
  INDEX = await res.json();
  populateFilters();
  rebuildTree();
  window.addEventListener("popstate", () => { const hp = location.hash.startsWith("#=") ? location.hash.slice(2) : null; if (hp) openPath(hp); });
  const init = location.hash.startsWith("#=") ? location.hash.slice(2) : INDEX.flat.sort((a, b) => b.mtime - a.mtime)[0]?.path;
  openPath(init);
}
function populateFilters() {
  filterSel.innerHTML = '<option value="all">All</option>';
  for (const cat of INDEX.sections) {
    const opt = document.createElement("option");
    opt.value = opt.textContent = cat;
    filterSel.appendChild(opt);
  }
}
function rebuildTree() {
  treeEl.innerHTML = "";
  PATH_TO_EL.clear();
  const filter = filterSel.value;
  const sort = sortSel.value;
  const query = searchBox.value.trim().toLowerCase();
  const root = { type: "dir", children: INDEX.tree };
  const pruned = filterTree(root, f => (filter === "all" || f.path.split("/")[0] === filter) && (!query || (f.title || f.name).toLowerCase().includes(query)));
  sortDir(pruned, sort);
  for (const c of pruned.children) treeEl.appendChild(renderNode(c));
  treeEl.querySelectorAll(".dir").forEach(d => d.classList.add("open"));  // Auto-open tops
}
function filterTree(node, keep) {
  if (node.type === "file") return keep(node) ? node : null;
  const kids = node.children.map(c => filterTree(c, keep)).filter(Boolean);
  return kids.length ? { ...node, children: kids } : null;
}
function sortDir(node, sort) {
  const cmp = sort === "name" ? (a, b) => a.name.localeCompare(b.name) :
              sort === "old" ? (a, b) => a.mtime - b.mtime : (a, b) => b.mtime - a.mtime;
  node.children.sort((a, b) => (a.type === "dir" && b.type !== "dir") ? -1 : (a.type !== "dir" && b.type === "dir") ? 1 : cmp(a, b));
  node.children.forEach(c => c.type === "dir" && sortDir(c, sort));
}
function renderNode(node) {
  if (node.type === "dir") {
    const div = document.createElement("div");
    div.className = "dir";
    div.setAttribute("aria-expanded", "false");
    const lbl = document.createElement("span");
    lbl.className = "label";
    lbl.textContent = node.name || "/";
    lbl.addEventListener("click", () => {
      const idx = node.children.find(c => c.type === "file" && /^index\.(md|html)$/i.test(c.name));
      if (idx) openPath(idx.path);
      else div.classList.toggle("open");
    });
    div.appendChild(lbl);
    const kids = document.createElement("div");
    kids.className = "children";
    node.children.forEach(c => kids.appendChild(renderNode(c)));
    div.appendChild(kids);
    return div;
  }
  const a = document.createElement("a");
  a.className = "file";
  a.innerHTML = `${node.pinned ? '<span class="pin">📌</span>' : ''}${iconForExt(node.ext)} ${node.title} <span class="meta">(${fmtDate(node.mtime)} · ${node.name})</span>`;
  a.addEventListener("click", e => { e.preventDefault(); openPath(node.path); });
  PATH_TO_EL.set(node.path, a);
  return a;
}
function iconForExt(ext) { return ext === ".md" ? "📝" : "🧩"; }
function fmtDate(ms) { return new Date(ms).toISOString().slice(0, 10); }
function findDir(path) {
  path = path.replace(/\/$/, '');
  function search(node) {
    if (node.type === "dir" && node.path === path) return node;
    for (const c of node.children || []) {
      const found = search(c);
      if (found) return found;
    }
  }
  return search({ children: INDEX.tree });
}
async function openPath(path) {
  if (path === CURRENT_PATH) return;
  CURRENT_PATH = path;
  if (location.hash !== `#=${path}`) history.pushState(null, "", `#=${path}`);
  let f = INDEX.flat.find(x => x.path === path);
  if (!f) {
    const dir = findDir(path);
    if (dir) {
      const idx = dir.children.find(c => c.type === "file" && /^index\.(md|html)$/i.test(c.name));
      if (idx) return openPath(idx.path);
    }
    metaLine.textContent = "Path not found: " + path;
    return;
  }
  metaLine.textContent = `${f.pinned ? "📌 " : ""}${fmtDate(f.mtime)} • ${f.name}`;
  if (f.ext === ".md") await renderMarkdown(f.path);
  else renderHTML(f.path);
  setActive(path);
  updatePager();
  if (window.innerWidth < 900) document.querySelector(".sidebar").classList.remove("open");
}
async function renderMarkdown(path) {
  const res = await fetch("/" + path);
  if (!res.ok) { mdView.innerHTML = "<p>File not found: " + path + "</p>"; return; }
  const text = await res.text();
  const html = window.marked ? window.marked.parse(text) : text.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const safe = window.DOMPurify ? window.DOMPurify.sanitize(html) : html;
  mdView.innerHTML = safe;
  mdView.style.display = "block";
  htmlView.style.display = "none";
}
function renderHTML(path) {
  htmlView.src = "/" + path;
  htmlView.style.display = "block";
  mdView.style.display = "none";
}
function setActive(path) {
  document.querySelectorAll(".file.active").forEach(el => el.classList.remove("active"));
  const el = PATH_TO_EL.get(path);
  if (el) {
    el.classList.add("active");
    let p = el.parentElement;
    while (p && p !== treeEl) {
      if (p.classList.contains("children")) p.parentElement.classList.add("open");
      p = p.parentElement;
    }
  }
}
function updatePager() {
  const query = searchBox.value.trim().toLowerCase();
  const list = INDEX.flat.filter(f => (filterSel.value === "all" || f.path.split("/")[0] === filterSel.value) && (!query || f.title.toLowerCase().includes(query)));
  const cmp = sortSel.value === "name" ? (a, b) => a.name.localeCompare(b.name) :
              sortSel.value === "old" ? (a, b) => a.mtime - b.mtime : (a, b) => b.mtime - a.mtime;
  list.sort(cmp);
  const i = list.findIndex(x => x.path === CURRENT_PATH);
  prevBtn.disabled = i <= 0;
  nextBtn.disabled = i >= list.length - 1 || i < 0;
  prevBtn.onclick = () => i > 0 && openPath(list[i - 1].path);
  nextBtn.onclick = () => i < list.length - 1 && openPath(list[i + 1].path);
}
let searchTimer;
searchBox.addEventListener("input", () => { clearTimeout(searchTimer); searchTimer = setTimeout(rebuildTree, 300); });
sortSel.addEventListener("change", rebuildTree);
filterSel.addEventListener("change", rebuildTree);
document.body.addEventListener("click", e => {
  const a = e.target.closest("a[href]");
  if (!a) return;
  const href = a.getAttribute("href");
  if (href.startsWith("/") && !href.startsWith("//") && !a.target) {
    e.preventDefault();
    openPath(href.replace(/^\//, ""));
  }
});
window.addEventListener("DOMContentLoaded", loadIndex);