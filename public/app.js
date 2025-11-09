/**
 * app.js – v3.3.1 PREVIEW + PORTAL
 * High-coherence, readable, maintainable.
 * No hacks. No surgery. Only truth.
 */

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
let indexFiles = null; // Cached index files

// === INITIALIZATION ===
async function init() {
  try {
    indexData = await (await fetch("index.json")).json();
    indexFiles = indexData.flat.filter(f => f.isIndex);
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

// === NAVIGATION ===
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

  const defaultSection = indexData.sections.includes("posts") ? "posts" : indexData.sections[0];
  if (defaultSection) els.sectionSelect.value = defaultSection;
}

function populateTags() {
  indexData.tags.forEach(t => {
    const opt = document.createElement("option");
    opt.value = t; opt.textContent = t;
    els.tagSelect.appendChild(opt);
  });
}

// === UI WIRING ===
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

  // Close sidebar on content click (mobile)
  els.content.addEventListener("click", (e) => {
    if (window.innerWidth < 1024 && document.body.classList.contains("sidebar-open")) {
      if (!e.target.closest("#sidebar")) {
        document.body.classList.remove("sidebar-open");
        sidebarOpen = false;
      }
    }
  });
}

// === LIST RENDERING ===
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
    const time = new Date(p.ctime).toLocaleDateString();
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

// === SUBNAV (NESTED HORIZON) ===
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

  requestAnimationFrame(() => subnav.classList.add("visible"));
}

// === HASH ROUTING ===
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
      if (indexFile.ext === ".md") {
        await renderMarkdown(indexFile.path);
      } else {
        await renderIframe("/" + indexFile.path);
      }
    } else {
      if (topSection) loadDefaultForSection(topSection);
      else els.viewer.innerHTML = `<h1>${currentPath.split("/").pop()}</h1><p>No content yet.</p>`;
    }
  } else {
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

// === PREVIEW + PORTAL ENGINE ===
async function renderIframe(rel) {
  const preview = await generatePreview(rel);
  const portalBtn = `<button class="portal-btn" data-src="${rel}">Open Full Experience</button>`;

  els.viewer.innerHTML = `
    <div class="preview-header">${portalBtn}</div>
    <article class="preview-content">${preview}</article>
  `;

  els.viewer.querySelector(".portal-btn").addEventListener("click", e => {
    window.open(e.target.dataset.src, "_blank", "noopener,noreferrer");
  });
}

async function generatePreview(rel) {
  try {
    const res = await fetch(rel);
    if (!res.ok) throw new Error();
    const html = await res.text();

    let content = html.match(/<body[^>]*>([\s\S]*)<\/body>/i)?.[1] || html;

    // Strip dangerous/interactive elements
    content = content
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<link[^>]*rel=["']stylesheet["'][^>]*>/gi, "")
      .replace(/\s+(on\w+)=["'][^"']*["']/gi, "")
      .replace(/\s+style=["'][^"']*["']/gi, "");

    const div = document.createElement("div");
    div.innerHTML = content;
    trimPreview(div, 3, 3000); // depth, char limit

    return div.innerHTML || `<p>Empty content.</p>`;
  } catch {
    return `<p>Preview unavailable. <a href="${rel}" target="_blank" rel="noopener">Open directly</a>.</p>`;
  }
}

function trimPreview(el, maxDepth, charLimit, depth = 0, chars = 0) {
  if (depth > maxDepth || chars > charLimit) {
    el.innerHTML = "...";
    return;
  }
  for (const child of [...el.children]) {
    trimPreview(child, maxDepth, charLimit, depth + 1, chars + child.textContent.length);
    if (chars > charLimit) child.remove();
  }
}

// === DEFAULT VIEW ===
function renderDefault() {
  const defaultSection = indexData.sections.includes("posts") ? "posts" : indexData.sections[0];
  if (defaultSection) {
    els.sectionSelect.value = defaultSection;
    renderList();
    loadDefaultForSection(defaultSection);
  } else {
    els.viewer.innerHTML = "<h1>Welcome</h1><p>Add content to begin.</p>";
  }
}

// === START ===
init();
