const els = {
  menuBtn: document.getElementById("menuBtn"),
  primaryNav: document.getElementById("primaryNav"),
  subNav: document.getElementById("subNav"),
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
let currentParent = null;
let indexFiles = null; // Cached

async function init() {
  try {
    indexData = await (await fetch("index.json")).json();
    indexFiles = indexData.flat.filter(f => f.isIndex); // Cache
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

function populateNav() {
  els.primaryNav.innerHTML = '<a href="#/">Home</a>';
  const navSections = [...new Set(
    indexData.flat
      .filter(f => f.isIndex && f.path.split("/").length > 1)
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

  if (indexData.sections.includes("posts")) {
    els.sectionSelect.value = "posts";
  } else if (indexData.sections.length > 0) {
    els.sectionSelect.value = indexData.sections[0];
  }
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

// NESTED HORIZON: Deep-Aware Sub-Navigation
function renderSubNav(parent) {
  const subnav = els.subNav;
  subnav.innerHTML = "";
  subnav.classList.remove("visible");

  if (!parent || !indexData.hierarchies?.[parent]) return;

  const subs = indexData.hierarchies[parent];
  subs.forEach(child => {
    const link = document.createElement("a");
    link.href = `#/${parent}/${child}/`;
    link.textContent = child.charAt(0).toUpperCase() + child.slice(1);
    subnav.appendChild(link);
  });

  requestAnimationFrame(() => {
    subnav.classList.add("visible");
  });
}

async function handleHash() {
  els.viewer.innerHTML = "";
  const rel = location.hash.replace(/^#\//, "");
  const parts = rel.split("/").filter(Boolean); // e.g., ["about", "Mark"]

  // Determine current depth parent for subnav
  const currentParentPath = parts.slice(0, -1).join("/") || parts[0] || null;

  if (currentParentPath !== currentParent) {
    currentParent = currentParentPath;
    renderSubNav(currentParent);
  }

  // Sync sidebar section to top-level
  const topSection = parts[0] || null;
  if (topSection && indexData.sections.includes(topSection)) {
    els.sectionSelect.value = topSection;
    renderList();
  }

  if (!rel) return renderDefault();

  // CASE: Trailing slash → render index at *current* level
  if (rel.endsWith('/')) {
    const currentPath = parts.join("/");

    const indexFile = indexFiles.find(f => {
      const dir = f.path.split("/").slice(0, -1).join("/");
      return dir === currentPath;
    });

    if (indexFile) {
      try {
        if (indexFile.ext === ".md") {
          const src = await fetch(indexFile.path).then(r => r.ok ? r.text() : "");
          const html = marked.parse(src || `# ${currentPath.split("/").pop()}\n\nNo content yet.`);
          els.viewer.innerHTML = `<article class="markdown">${html}</article>`;
        } else if (indexFile.ext === ".html") {
          // Use unified bounded renderer even for nested index.html
          renderIframe(indexFile.path);
        } else {
          els.viewer.innerHTML = `<h1>${currentPath.split("/").pop()}</h1><p>Unsupported type.</p>`;
        }
      } catch (e) {
        els.viewer.innerHTML = `<h1>${currentPath.split("/").pop()}</h1><p>No content yet.</p>`;
      }
    } else {
      // No index → show children or fallback
      if (topSection) {
        els.sectionSelect.value = topSection;
        renderList();
        loadDefaultForSection(topSection);
      } else {
        els.viewer.innerHTML = `<h1>${currentPath.split("/").pop()}</h1><p>No content yet.</p>`;
      }
    }
  } 
  // CASE: Direct file
  else {
    const file = indexData.flat.find(f => f.path === rel);
    if (!file) {
      els.viewer.innerHTML = "<h1>404</h1><p>Not found.</p>";
      return;
    }
    file.ext === ".md" ? await renderMarkdown(file.path) : renderIframe(file.path);
  }
}

async function renderMarkdown(rel) {
  const src = await fetch(rel).then(r => r.ok ? r.text() : "");
  els.viewer.innerHTML = `<article class="markdown">${marked.parse(src || "# Untitled")}</article>`;
}

function renderIframe(rel) {
  const viewer = els.viewer;
  const container = document.createElement("div");
  container.className = "preview-wrapper";

  const header = document.createElement("div");
  header.className = "preview-header";
  header.innerHTML = `<button class="popout-btn" data-src="${rel}">Open Full View ↗</button>`;

  const iframe = document.createElement("iframe");
  iframe.src = "/" + rel;
  iframe.loading = "eager";
  iframe.setAttribute("sandbox", "allow-same-origin allow-scripts allow-forms");

  container.appendChild(header);
  container.appendChild(iframe);
  viewer.appendChild(container);

  header.querySelector(".popout-btn").addEventListener("click", e => {
    const url = e.target.dataset.src.startsWith("/") ? e.target.dataset.src : "/" + e.target.dataset.src;
    window.open(url, "_blank", "noopener,noreferrer");
  });

  iframe.onload = () => {
    try {
      const doc = iframe.contentDocument;
      const style = doc.createElement("style");
      style.textContent = `
  html,body{
    background:#0b0b0b;
    color:#e6e3d7;
    font-family:Inter,sans-serif;
    margin:0;
    padding:3vh 6vw;
    line-height:1.8;
  }
  body{
    display:flex;
    flex-direction:column;
    align-items:center;
    justify-content:flex-start;
    min-height:100vh;
  }
  *{
    max-width:960px;
    width:100%;
  }
  img,video,iframe{
    max-width:100%;
    height:auto;
    border-radius:8px;
  }
`;
      doc.head.appendChild(style);
    } catch {}
  };
}

function renderDefault() {
  const defaultSection = indexData.sections.includes("posts") ? "posts" : (indexData.sections[0] || null);
  if (defaultSection) {
    els.sectionSelect.value = defaultSection;
    renderList();
    loadDefaultForSection(defaultSection);
  } else {
    els.viewer.innerHTML = "<h1>Welcome</h1><p>Add content to begin.</p>";
  }
}

init();
