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

  [els.tagSelect, els.sortNou, els.searchMode].forEach(el => el.addEventListener("change", renderList));
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
  const parts = rel.split("/").filter(Boolean);

  const currentParentPath = parts.slice(0, -1).join("/") || parts[0] || null;

  if (currentParentPath !== currentParent) {
    currentParent = currentParentPath;
    renderSubNav(currentParent);
  }

  const topSection = parts[0] || null;
  if (topSection && indexData.sections.includes(topSection)) {
    els.sectionSelect.value = topSection;
    renderList();
  }

  if (!rel) return renderDefault();

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
        } else {
          await renderIframe("/" + indexFile.path);  // Now uses Harmonizer
        }
      } catch (e) {
        els.viewer.innerHTML = `<h1>${currentPath.split("/").pop()}</h1><p>No content yet.</p>`;
      }
    } else {
      if (topSection) {
        els.sectionSelect.value = topSection;
        renderList();
        loadDefaultForSection(topSection);
      } else {
        els.viewer.innerHTML = `<h1>${currentPath.split("/").pop()}</h1><p>No content yet.</p>`;
      }
    }
  } 
  else {
    const file = indexData.flat.find(f => f.path === rel);
    if (!file) {
      els.viewer.innerHTML = "<h1>404</h1><p>Not found.</p>";
      return;
    }
    file.ext === ".md" ? await renderMarkdown(file.path) : await renderIframe("/" + file.path);
  }
}

async function renderMarkdown(rel) {
  const src = await fetch(rel).then(r => r.ok ? r.text() : "");
  els.viewer.innerHTML = `<article class="markdown">${marked.parse(src || "# Untitled")}</article>`;
}

// === HARMONIZER ENGINE CORE ===
async function renderIframe(rel) {
  const mode = await detectHarmonizerMode(rel);
  if (mode === 'full') return renderIframeFull(rel);
  return renderIframeHarmonized(rel, mode);
}

// Detect <meta name="harmonizer" content="...">
async function detectHarmonizerMode(rel) {
  try {
    const res = await fetch(rel);
    const html = await res.text();
    const match = html.match(/<meta\s+name=["']harmonizer["']\s+content=["'](.*?)["']/i);
    return match ? match[1].toLowerCase() : 'safe';
  } catch {
    return 'safe';
  }
}

// Harmonized loader (safe/enhanced)
async function renderIframeHarmonized(rel, mode = 'safe') {
  try {
    const res = await fetch(rel);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    let html = await res.text();

    // Strip scripts and styles
    if (mode === 'safe') {
      html = html
        .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, "")
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?<\/style>/gi, "");
    } else if (mode === 'enhanced') {
      // Allow YouTube/SoundCloud embeds
      html = html
        .replace(/<script(?![^>]+(youtube\.com|soundcloud\.com|player)).*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?<\/style>/gi, "");
    }

    const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    const bodyContent = bodyMatch ? bodyMatch[1].trim() : html.trim();

    els.viewer.innerHTML = `
      <div class="harmonizer-header">
        <button class="popout-btn" data-src="${rel}">↗ Open Original</button>
      </div>
      <article class="harmonized">${bodyContent}</article>
    `;
    applyHarmonizerStyles();

    const btn = els.viewer.querySelector(".popout-btn");
    btn.addEventListener("click", e => window.open(e.target.dataset.src, "_blank"));
  } catch (e) {
    els.viewer.innerHTML = `<h1>Error loading</h1><p>${rel}</p>`;
  }
}

// Full mode: preserve original script behavior inside sandbox
function renderIframeFull(rel) {
  els.viewer.innerHTML = `
    <div class="harmonizer-header">
      <button class="popout-btn" data-src="${rel}">↗ Open Original</button>
    </div>
    <iframe src="${rel}" sandbox="allow-scripts allow-same-origin allow-popups allow-forms" style="width:100%;height:calc(100vh - var(--topbar-h) - var(--subnav-h));border:none;"></iframe>
  `;
  const btn = els.viewer.querySelector(".popout-btn");
  btn.addEventListener("click", e => window.open(e.target.dataset.src, "_blank"));
}

// Harmonizer aesthetic pass
function applyHarmonizerStyles() {
  const el = document.querySelector(".harmonized");
  if (!el) return;
  el.querySelectorAll("*").forEach(node => {
    node.style.background = "transparent";
    node.style.color = "inherit";
    node.style.fontFamily = "'Inter', system-ui, sans-serif";
  });
}
// === END HARMONIZER ===

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
