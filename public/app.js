let INDEX = null;
let CURRENT_PATH = null;
const treeEl = document.getElementById("tree");
const metaEl = document.getElementById("meta");
const mdView = document.getElementById("mdView");
const htmlView = document.getElementById("htmlView");
const sortSel = document.getElementById("sortSel");
const filterSel = document.getElementById("filterSel");
const navToggle = document.getElementById("navToggle");

navToggle.addEventListener("click", () =>
  document.querySelector(".sidebar").classList.toggle("open")
);

async function loadIndex() {
  try {
    const res = await fetch("index.json");
    INDEX = await res.json();
  } catch {
    treeEl.innerHTML = "<p style='color:red'>index.json missing. run the build.</p>";
    return;
  }
  rebuildTree();
  autoOpenLatest();
}

function rebuildTree() {
  treeEl.innerHTML = "";
  const roots = ["pinned", "posts"];
  for (const root of roots) {
    const dir = INDEX.tree.find(d => d.name === root);
    if (dir) {
      const h = document.createElement("div");
      h.className = "dir";
      h.textContent = root;
      treeEl.appendChild(h);
      dir.children.forEach(f => treeEl.appendChild(renderFile(f)));
    }
  }
}

function renderFile(f) {
  const a = document.createElement("a");
  a.className = "file";
  a.textContent = (f.pinned ? "📌 " : "") + f.name;
  a.addEventListener("click", e => {
    e.preventDefault();
    openPath(f.path);
  });
  return a;
}

function autoOpenLatest() {
  if (!INDEX.flat?.length) return;
  const sorted = [...INDEX.flat].sort((a,b)=>b.mtime - a.mtime);
  openPath(sorted[0].path);
}

async function openPath(path) {
  if (path === CURRENT_PATH) return;
  CURRENT_PATH = path;

  const f = INDEX.flat.find(x => x.path === path);
  if (!f) return;

  metaEl.textContent = `${f.pinned ? "Pinned • " : ""}${new Date(f.mtime).toISOString().slice(0,10)} • ${f.name}`;

  if (f.ext === ".md") await renderMarkdown(path);
  else await renderHTML(path);

  if (window.innerWidth < 900)
    document.querySelector(".sidebar").classList.remove("open");
}

async function renderMarkdown(path) {
  htmlView.style.display = "none";
  mdView.style.display = "block";
  const res = await fetch(path);
  const text = await res.text();
  const html = DOMPurify.sanitize(marked.parse(text));
  mdView.innerHTML = html;
}

async function renderHTML(path) {
  mdView.style.display = "none";
  htmlView.style.display = "block";
  htmlView.src = path;
}

window.addEventListener("DOMContentLoaded", loadIndex);