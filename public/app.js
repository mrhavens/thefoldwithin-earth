const els = {
  menuBtn: document.getElementById("menuBtn"),
  primaryNav: document.getElementById("primaryNav"),
  sectionSelect: document.getElementById("sectionSelect"),
  tagSelect: document.getElementById("tagSelect"),
  sortSelect: document.getElementById("sortSelect"),
  searchMode: document.getElementById("searchMode"),
  searchBox: document.getElementById("searchBox"),
  postList: document.getElementById("postList"),
  viewer: document.getElementById("viewer"),
  content: document.getElementById("content"),
  toggleControls: document.getElementById("toggleControls"),
  filterPanel: document.getElementById("filterPanel")
};

let indexData = null;
let sidebarOpen = false;

async function init() {
  try {
    indexData = await (await fetch("index.json")).json();
    populateNav();
    populateSections();
    populateTags();
    wireUI();
    renderList();
    handleHash();
    window.addEventListener("hashchange", handleHash);
  } catch (e) {
    els.viewer.innerHTML = "<h1>Error</h1><p>Failed to load site data.</p>";
  }
}

// Only show folder name if any index.* exists
function populateNav() {
  els.primaryNav.innerHTML = '<a href="#/">Home</a>';
  const navSections = [...new Set(
    indexData.flat
      .filter(f => f.isIndex)
      .map(f => f.path.split("/")[0])
  )].sort();
  navSections.forEach(s => {
    els.primaryNav.innerHTML += `<a href="#/${s}/">${s.charAt(0).toUpperCase() + s.slice(1)}</a>`;
  });
}

function populateSections() {
  els.sectionSelect.innerHTML = '<option value="all">All Sections</option>';
  indexData.sections.forEach(s => {
    const opt = document.createElement("option");
    opt.value = s; opt.textContent = s;
    els.sectionSelect.appendChild(opt);
  });
}

function populateTags() {
  indexData.tags.forEach(t => {
    const opt = document.createElement("option");
    opt.value = t; opt.textContent = t;
    els.tagSelect.appendChild(opt);
  });
}

function formatTimestamp(ms) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

function wireUI() {
  els.menuBtn.addEventListener("click", () => {
    sidebarOpen = !sidebarOpen;
    document.body.classList.toggle("sidebar-open", sidebarOpen);
  });

  els.toggleControls.addEventListener("click", () => {
    const open = els.filterPanel.open;
    els.filterPanel.open = !open;
    els.toggleControls.textContent = open ? "Filters" : "Hide";
  });

  els.sectionSelect.addEventListener("change", () => {
    renderList();
    if (els.sectionSelect.value !== "all") loadDefaultForSection(els.sectionSelect.value);
  });

  [els.tagSelect, els.sortSelect, els.searchMode].forEach(el => el.addEventListener("change", renderList));
  els.searchBox.addEventListener("input", renderList);

  els.content.addEventListener("click", (e) => {
    if (window.innerWidth < 1024 && document.body.classList.contains("sidebar-open")) {
      if (!e.target.closest("#sidebar")) {
        document.body.classList.remove("sidebar-open");
        sidebarOpen = false;
      }
    }
  });
}

function renderList() {
  const section = els.sectionSelect.value;
  const tags = Array.from(els.tagSelect.selectedOptions).map(o => o.value.toLowerCase());
  const sort = els.sortSelect.value;
  const mode = els.searchMode.value;
  const query = els.searchBox.value.toLowerCase();

  let posts = indexData.flat.filter(p => !p.isIndex);
  if (section !== "all") posts = posts.filter(p => p.path.split('/')[0] === section);
  if (tags.length) posts = posts.filter(p => tags.every(t => p.tags.includes(t)));
  if (query) {
    posts = posts.filter(p => {
      const text = mode === "content" ? p.title + " " + p.excerpt : p.title;
      return text.toLowerCase().includes(query);
    });
  }
  posts.sort((a, b) => sort === "newest" ? b.mtime - a.mtime : a.mtime - b.mtime);

  els.postList.innerHTML = posts.length ? "" : "<li>No posts found.</li>";
  posts.forEach(p => {
    const li = document.createElement("li");
    const pin = p.isPinned ? "Star " : "";
    const time = formatTimestamp(p.ctime);
    li.innerHTML = `<a href="#/${p.path}">${pin}${p.title}</a><small>${time}</small>`;
    els.postList.appendChild(li);
  });
}

function loadDefaultForSection(section) {
  const posts = indexData.flat.filter(p => p.path.split('/')[0] === section && !p.isIndex);
  if (!posts.length) {
    els.viewer.innerHTML = `<h1>${section}</h1><p>No content yet.</p>`;
    return;
  }
  const pinned = posts.find(p => p.isPinned) || posts.sort((a,b) => b.mtime - a.mtime)[0];
  location.hash = `#/${pinned.path}`;
}

async function handleHash() {
  els.viewer.innerHTML = "";
  const rel = location.hash.replace(/^#\//, "");
  if (!rel) return renderDefault();

  if (rel.endsWith('/')) {
    const section = rel.slice(0, -1);
    const indexFile = indexData.flat.find(f => f.path.startsWith(section + "/") && f.isIndex);
    if (indexFile) {
      indexFile.ext === ".md" ? await renderMarkdown(indexFile.path) : renderIframe(indexFile.path);
    } else {
      els.sectionSelect.value = section;
      renderList();
      loadDefaultForSection(section);
    }
  } else {
    const file = indexData.flat.find(f => f.path === rel);
    if (!file) {
      els.viewer.innerHTML = "<h1>404</h1><p>Not found.</p>";
      return;
    }
    file.ext === ".md" ? await renderMarkdown(file.path) : renderIframe(file.path);
  }
}

async function renderMarkdown(rel) {
  const src = await fetch(rel).then(r => r.ok ? r.text() : Promise.reject());
  els.viewer.innerHTML = `<article class="markdown">${marked.parse(src)}</article>`;
}

function renderIframe(rel) {
  const iframe = document.createElement("iframe");
  iframe.src = "/" + rel;
  iframe.loading = "eager";
  iframe.setAttribute("sandbox", "allow-same-origin allow-scripts allow-forms");
  els.viewer.appendChild(iframe);

  iframe.onload = () => {
    try {
      const doc = iframe.contentDocument;
      const style = doc.createElement("style");
      style.textContent = `
        html,body{background:#0b0b0b;color:#e6e3d7;font-family:Inter,sans-serif;margin:0;padding:2rem;}
        *{max-width:720px;margin:auto;}
        img, video, iframe {max-width:100%;height:auto;}
      `;
      doc.head.appendChild(style);
    } catch (e) {}
  };
}

function renderDefault() {
  const latest = indexData.flat.filter(f => !f.isIndex).sort((a,b) => b.mtime - a.mtime)[0];
  if (latest) location.hash = `#/${latest.path}`;
  else els.viewer.innerHTML = "<h1>Welcome</h1><p>Add content to begin.</p>";
}

init();