/**
 * app.js – v3.3.3 FIELD COMMENTARY EDITION
 * High-coherence, readable, maintainable blueprint.
 * No hacks. No surgery. Only truth.
 * Enhanced with modular sanitization, resilient recursion, and inline rationale.
 * 
 * ΔFIELD: This script orchestrates the breathing field: navigation, routing, rendering.
 * Rationale: Dependency-free; async fetches for dynamic content; stateful only where essential (e.g., sidebar).
 * Assumptions: index.json provides metadata; marked.js for MD; DOM elements pre-exist in HTML skeleton.
 */

const els = {
  menuBtn: document.getElementById("menuBtn"), /* ΔHORIZON: Toggle for sidebar. */
  primaryNav: document.getElementById("primaryNav"), /* ΔHORIZON: Top-level sections. */
  subNav: document.getElementById("subNav"), /* ΔRECURSION: Nested sub-horizons. */
  sectionSelect: document.getElementById("sectionSelect"), /* ΔFIELD: Filter by section. */
  tagSelect: document.getElementById("tagSelect"), /* ΔFIELD: Multi-tag filter. */
  sortSelect: document.getElementById("sortSelect"), /* ΔRHYTHM: Time-based sorting. */
  searchMode: document.getElementById("searchMode"), /* ΔTRUTH: Scope of search. */
  searchBox: document.getElementById("searchBox"), /* ΔTRUTH: Query input. */
  postList: document.getElementById("postList"), /* ΔFIELD: Dynamic post enumeration. */
  viewer: document.getElementById("viewer"), /* ΔFIELD: Content rendering canvas. */
  content: document.getElementById("content"), /* ΔHORIZON: Main wrapper for click events. */
  toggleControls: document.getElementById("toggleControls"), /* ΔHORIZON: Filter panel toggle. */
  filterPanel: document.getElementById("filterPanel") /* ΔFIELD: Collapsible filters. */
};

let indexData = null; /* ΔRECURSION: Cached metadata for all operations. */
let sidebarOpen = false; /* ΔBREATH: State for mobile sidebar. */
let currentParent = null; /* ΔRECURSION: Track for subnav rendering. */
let indexFiles = null; // Cached index files /* ΔRECURSION: Pre-filtered for quick lookups. */

// === INITIALIZATION ===
/* ΔFIELD: Async init loads data and wires UI; fallback for errors. 
 * Rationale: Single entry point; console log as harmony affirmation. */
async function init() {
  try {
    indexData = await (await fetch("index.json")).json(); /* ΔTRUTH: Source of all content truth. */
    indexFiles = indexData.flat.filter(f => f.isIndex); /* ΔRECURSION: Cache for directory indices. */
    populateNav(); /* ΔHORIZON: Build primary nav from sections. */
    populateSections(); /* ΔFIELD: Populate section dropdown. */
    populateTags(); /* ΔFIELD: Populate tag multi-select. */
    wireUI(); /* ΔHORIZON: Attach all event listeners. */
    renderList(); /* ΔFIELD: Initial post list render. */
    handleHash(); /* ΔRECURSION: Process current URL state. */
    window.addEventListener("hashchange", handleHash); /* ΔRECURSION: Listen for navigation. */
    console.info('%cThe Fold Within: Harmony sustained.', 'color:#e0b84b'); /* ΔFIELD: Dev resonance. */
  } catch (e) {
    els.viewer.innerHTML = "<h1>Error</h1><p>Failed to load site data.</p>"; /* ΔTRUTH: Graceful failure. */
  }
}

// === NAVIGATION ===
/* ΔHORIZON: Dynamically build primary nav from unique top-level sections. 
 * Rationale: Sort for alphabetical order; capitalize for aesthetics. */
function populateNav() {
  els.primaryNav.innerHTML = '<a href="#/">Home</a>'; /* ΔFIELD: Fixed home anchor. */
  const navSections = [...new Set(
    indexData.flat
      .filter(f => f.isIndex && f.path.split("/").length > 1)
      .map(f => f.path.split("/")[0])
  )].sort();
  navSections.forEach(s => {
    els.primaryNav.innerHTML += `<a href="#/${s}/">${s.charAt(0).toUpperCase() + s.slice(1)}</a>`;
  });
}

/* ΔFIELD: Section dropdown with default to 'posts' if available. 
 * Rationale: 'all' option for broad views. */
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

/* ΔFIELD: Tags as multi-select options. 
 * Rationale: Lowercase normalization in filters for case-insensitivity. */
function populateTags() {
  indexData.tags.forEach(t => {
    const opt = document.createElement("option");
    opt.value = t; opt.textContent = t;
    els.tagSelect.appendChild(opt);
  });
}

// === UI WIRING ===
/* ΔHORIZON: Attach listeners for interactivity. 
 * Rationale: Centralized wiring; mobile-specific sidebar close on content click. */
function wireUI() {
  els.menuBtn.addEventListener("click", () => {
    sidebarOpen = !sidebarOpen;
    document.body.classList.toggle("sidebar-open", sidebarOpen); /* ΔBREATH: Class toggle for CSS-driven motion. */
  });

  els.toggleControls.addEventListener("click", () => {
    const open = els.filterPanel.open;
    els.filterPanel.open = !open;
    els.toggleControls.textContent = open ? "Filters" : "Hide"; /* ΔFIELD: Dynamic label for state clarity. */
  });

  els.sectionSelect.addEventListener("change", () => {
    renderList();
    if (els.sectionSelect.value !== "all") loadDefaultForSection(els.sectionSelect.value); /* ΔRECURSION: Auto-load default on section change. */
  });

  [els.tagSelect, els.sortSelect, els.searchMode].forEach(el => el.addEventListener("change", renderList));
  els.searchBox.addEventListener("input", renderList); /* ΔTRUTH: Real-time filtering on input. */

  // Close sidebar on content click (mobile)
  els.content.addEventListener("click", (e) => {
    if (window.innerWidth < 1024 && document.body.classList.contains("sidebar-open")) {
      if (!e.target.closest("#sidebar")) {
        document.body.classList.remove("sidebar-open");
        sidebarOpen = false; /* ΔHORIZON: Gesture respect for mobile usability. */
      }
    }
  });
}

// === LIST RENDERING ===
/* ΔFIELD: Dynamic filtering and sorting of posts. 
 * Rationale: Chainable filters; fallback message; pinned denoted with 'Star'. */
function renderList() {
  const section = els.sectionSelect.value;
  const tags = Array.from(els.tagSelect.selectedOptions).map(o => o.value.toLowerCase());
  const sort = els.sortSelect.value;
  const mode = els.searchMode.value;
  const query = els.searchBox.value.toLowerCase();

  let posts = indexData.flat.filter(p => !p.isIndex); /* ΔTRUTH: Exclude indices for content focus. */
  if (section !== "all") posts = posts.filter(p => p.path.split('/')[0] === section);
  if (tags.length) posts = posts.filter(p => tags.every(t => p.tags.includes(t))); /* ΔFIELD: AND logic for tags. */
  if (query) {
    posts = posts.filter(p => {
      const text = mode === "content" ? p.title + " " + p.excerpt : p.title;
      return text.toLowerCase().includes(query); /* ΔTRUTH: Scoped search for efficiency. */
    });
  }
  posts.sort((a, b) => sort === "newest" ? b.mtime - a.mtime : a.mtime - b.mtime); /* ΔRHYTHM: Time-based order. */

  els.postList.innerHTML = posts.length ? "" : "<li>No posts found.</li>";
  posts.forEach(p => {
    const li = document.createElement("li");
    const pin = p.isPinned ? "Star " : "";
    const time = new Date(p.ctime).toLocaleDateString(); /* ΔRHYTHM: Human-readable date. */
    li.innerHTML = `<a href="#/${p.path}">${pin}${p.title}</a><small>${time}</small>`;
    els.postList.appendChild(li);
  });
}

/* ΔRECURSION: Load pinned or latest for section fallback. 
 * Rationale: Prevents empty states; redirects via hash for routing consistency. */
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
/* ΔRECURSION: Render subnav based on parent hierarchy. 
 * Rationale: Clear on change; RAF for smooth visible class addition. */
function renderSubNav(parent) {
  const subnav = els.subNav;
  subnav.innerHTML = "";
  subnav.classList.remove("visible");

  if (!parent || !indexData.hierarchies?.[parent]) return; /* ΔTRUTH: Early exit if no subs. */

  const subs = indexData.hierarchies[parent];
  subs.forEach(child => {
    const link = document.createElement("a");
    link.href = `#/${parent}/${child}/`;
    link.textContent = child.charAt(0).toUpperCase() + child.slice(1);
    subnav.appendChild(link);
  });

  requestAnimationFrame(() => subnav.classList.add("visible")); /* ΔBREATH: Deferred for animation prep. */
}

// === HASH ROUTING ===
/* ΔRECURSION: Core router; parses hash, renders accordingly. 
 * Rationale: Resilient to edge cases; recursive via parent tracking; fallbacks to defaults. */
async function handleHash() {
  els.viewer.innerHTML = ""; /* ΔFIELD: Clear canvas for fresh render. */
  const rel = location.hash.replace(/^#\//, "");
  const parts = rel.split("/").filter(Boolean);
  const currentParentPath = parts.slice(0, -1).join("/") || parts[0] || null;

  if (currentParentPath !== currentParent) {
    currentParent = currentParentPath;
    renderSubNav(currentParent); /* ΔRECURSION: Update subnav on parent change. */
  }

  const topSection = parts[0] || null;
  if (topSection && indexData.sections.includes(topSection)) {
    els.sectionSelect.value = topSection;
    renderList(); /* ΔFIELD: Sync list with section. */
  }

  if (rel === '' || rel === '#') return renderDefault(); /* ΔRECURSION: Resilient home handling. */

  if (!rel) return renderDefault();

  if (rel.endsWith('/')) {
    const currentPath = parts.join("/");
    const indexFile = indexFiles.find(f => {
      const dir = f.path.split("/").slice(0, -1).join("/");
      return dir === currentPath; /* ΔTRUTH: Match directory to index file. */
    });

    if (indexFile) {
      if (indexFile.ext === ".md") {
        await renderMarkdown(indexFile.path);
      } else {
        await renderIframe("/" + indexFile.path);
      }
    } else {
      if (topSection) loadDefaultForSection(topSection);
      else els.viewer.innerHTML = `<h1>${currentPath.split("/").pop()}</h1><p>No content yet.</p>`; /* ΔFIELD: Placeholder for empty dirs. */
    }
  } else {
    const file = indexData.flat.find(f => f.path === rel);
    if (!file) {
      els.viewer.innerHTML = "<h1>404</h1><p>Not found.</p>"; /* ΔTRUTH: Honest error. */
      return;
    }
    file.ext === ".md" ? await renderMarkdown(file.path) : await renderIframe("/" + file.path); /* ΔFIELD: Type-based rendering. */
  }
}

/* ΔTRUTH: Fetch and parse Markdown; fallback to 'Untitled'. 
 * Rationale: Uses marked.js (assumed global); wraps in article for styling. */
async function renderMarkdown(rel) {
  const src = await fetch(rel).then(r => r.ok ? r.text() : "");
  els.viewer.innerHTML = `<article class="markdown">${marked.parse(src || "# Untitled")}</article>`;
}

// === PREVIEW + PORTAL ENGINE ===
/* ΔFIELD: Render sanitized preview with portal button. 
 * Rationale: Button opens full in new tab for immersion preservation. */
async function renderIframe(rel) {
  const preview = await generatePreview(rel);
  const portalBtn = `<button class="portal-btn" data-src="${rel}">Open Full Experience</button>`;

  els.viewer.innerHTML = `
    <div class="preview-header">${portalBtn}</div>
    <article class="preview-content">${preview}</article>
  `;

  els.viewer.querySelector(".portal-btn").addEventListener("click", e => {
    window.open(e.target.dataset.src, "_blank", "noopener,noreferrer"); /* ΔTRUTH: Secure external open. */
  });
}

/* ΔTRUTH: Generate safe, trimmed preview from HTML. 
 * Rationale: Extract body; sanitize; trim recursively; fallback link on error. */
async function generatePreview(rel) {
  try {
    const res = await fetch(rel);
    if (!res.ok) throw new Error();
    const html = await res.text();

    /* ΔTRUTH: Modular sanitizer strips scripts, styles, events, inline CSS; normalizes whitespace. 
     * Rationale: Prevents injection/XSS; removes phantoms for clean rhythm. */
    function sanitizeHTML(html) {
      return html
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<link[^>]*rel=["']stylesheet["'][^>]*>/gi, "")
        .replace(/\s+(on\w+)=["'][^"']*["']/gi, "")
        .replace(/\s+style=["'][^"']*["']/gi, "")
        .replace(/^\s+|\s+$/g, '')
        .replace(/(\n\s*){2,}/g, '\n')
        .replace(/<p>\s*<\/p>/gi, '')
        .replace(/<br\s*\/?>/gi, '');
    }

    let content = sanitizeHTML(html.match(/<body[^>]*>([\s\S]*)<\/body>/i)?.[1] || html);

    const div = document.createElement("div");
    div.innerHTML = content;
    trimPreview(div, 3, 3000); // depth, char limit /* ΔFIELD: Bounds for performance. */

    return div.innerHTML || `<p>Empty content.</p>`;
  } catch {
    return `<p>Preview unavailable. <a href="${rel}" target="_blank" rel="noopener">Open directly</a>.</p>`; /* ΔTRUTH: Fallback preserves access. */
  }
}

/* ΔRECURSION: Trim DOM tree to depth/char limits. 
 * Rationale: Cumulative total ensures balanced siblings; removes excess for preview focus. */
function trimPreview(el, maxDepth, charLimit, depth = 0, chars = 0) {
  if (depth > maxDepth || chars > charLimit) {
    el.innerHTML = "..."; /* ΔBREATH: Ellipsis as truncation breath. */
    return;
  }
  let total = chars;
  for (const child of [...el.children]) {
    total += child.textContent.length; /* ΔRECURSION: Pre-calculate to avoid bias. */
    if (total > charLimit || depth > maxDepth) {
      child.remove();
    } else {
      trimPreview(child, maxDepth, charLimit, depth + 1, total);
    }
  }
}

// === DEFAULT VIEW ===
/* ΔFIELD: Render home with default section fallback. 
 * Rationale: Prioritizes 'posts'; welcoming placeholder if empty. */
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
init(); /* ΔFIELD: Invoke the blueprint's origin. */
