const els = {
  body: document.body,
  menuBtn: document.getElementById("menuBtn"),
  primaryNav: document.getElementById("primaryNav"),
  sectionSelect: document.getElementById("sectionSelect"),
  tagSelect: document.getElementById("tagSelect"),
  sortSelect: document.getElementById("sortSelect"),
  searchMode: document.getElementById("searchMode"),
  searchBox: document.getElementById("searchBox"),
  postList: document.getElementById("postList"),
  viewer: document.getElementById("viewer"),
  content: document.getElementById("content")
};

const sectionIcons = { essays: '✍️', fieldnotes: '📓', pinned: '📌' };
const tagIcons = { /* Optional: e.g., 'tech': '🔧' */ };

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
    els.viewer.innerHTML = "<h1>Error Loading Site</h1><p>Failed to load index data. Please refresh or check connection.</p>";
  }
}

function populateNav() {
  els.primaryNav.innerHTML = '<a href="#/">Home</a>';
  indexData.sections.filter(s => indexData.flat.some(f => f.path.split('/')[0] === s && f.isIndex)).forEach(s => {
    els.primaryNav.innerHTML += `<a href="#/${s}/">${s.charAt(0).toUpperCase() + s.slice(1)}</a>`;
  });
}

function populateSections() {
  els.sectionSelect.innerHTML = '<option value="all">All Sections</option>';
  indexData.sections.forEach(s => {
    const icon = sectionIcons[s] ? `${sectionIcons[s]} ` : '';
    const opt = document.createElement("option");
    opt.value = s;
    opt.textContent = `${icon}${s}`;
    els.sectionSelect.appendChild(opt);
  });
}

function populateTags() {
  els.tagSelect.innerHTML = '';
  indexData.tags.forEach(t => {
    const icon = tagIcons[t] ? `${tagIcons[t]} ` : '';
    const opt = document.createElement("option");
    opt.value = t;
    opt.textContent = `${icon}${t}`;
    opt.title = `Filter by ${t}`;
    els.tagSelect.appendChild(opt);
  });
}

function wireUI() {
  els.menuBtn.addEventListener("click", () => {
    sidebarOpen = !sidebarOpen;
    document.body.classList.toggle("sidebar-open", sidebarOpen);
  });
  els.sectionSelect.addEventListener("change", () => {
    renderList();
    if (els.sectionSelect.value !== "all") loadDefaultForSection(els.sectionSelect.value);
  });
  [els.tagSelect, els.sortSelect, els.searchMode].forEach(el => el.addEventListener("change", renderList));
  els.searchBox.addEventListener("input", renderList);
  els.content.addEventListener("click", () => {
    if (window.matchMedia("(max-width:1024px)").matches && document.body.classList.contains("sidebar-open")) {
      document.body.classList.remove("sidebar-open");
      sidebarOpen = false;
    }
  });
}

function renderList() {
  const section = els.sectionSelect.value;
  const tags = Array.from(els.tagSelect.selectedOptions).map(o => o.value.toLowerCase());
  const sort = els.sortSelect.value;
  const mode = els.searchMode.value;
  const query = els.searchBox.value.toLowerCase();

  let posts = indexData.flat.filter(p => !p.isIndex); // Exclude index from lists
  if (section !== "all") posts = posts.filter(p => p.path.split('/')[0] === section);
  if (tags.length > 0) posts = posts.filter(p => tags.every(t => p.tags.includes(t)));
  if (query) {
    posts = posts.filter(p => {
      const searchText = mode === "content" ? (p.title + ' ' + p.excerpt).toLowerCase() : p.title.toLowerCase();
      return searchText.includes(query);
    });
  }
  posts.sort((a, b) => sort === "newest" ? b.mtime - a.mtime : a.mtime - b.mtime);

  els.postList.innerHTML = posts.length ? "" : "<li>No matching posts found. Try adjusting filters.</li>";
  for (const p of posts) {
    const li = document.createElement("li");
    const pin = p.isPinned ? "&#9733; " : "";
    li.innerHTML = `<a href="#/${p.path}">${pin}${p.title}</a><br><small>${new Date(p.mtime).toISOString().split("T")[0]}</small>`;
    els.postList.appendChild(li);
  }
}

function loadDefaultForSection(section) {
  const posts = indexData.flat.filter(p => p.path.split('/')[0] === section && !p.isIndex); // Exclude index
  if (!posts.length) {
    els.viewer.innerHTML = `<h1>${section.charAt(0).toUpperCase() + section.slice(1)}</h1><p>No content yet. Add files and redeploy!</p>`;
    return;
  }
  const pinned = posts.filter(p => p.isPinned).sort((a, b) => b.mtime - a.mtime)[0];
  const toLoad = pinned || posts.sort((a, b) => b.mtime - a.mtime)[0];
  location.hash = '#/' + toLoad.path;
}

async function handleHash() {
  els.viewer.classList.remove("fade-in");
  els.viewer.innerHTML = "";
  void els.viewer.offsetWidth;
  els.viewer.classList.add("fade-in");
  const rel = location.hash.replace(/^#\//, "");
  if (!rel) return renderDefault();

  if (rel.endsWith('/')) {
    const section = rel.replace(/\/$/, '');
    if (!indexData.sections.includes(section)) {
      els.viewer.innerHTML = '<h1>404: Section Not Found</h1><p>Try navigating from the menu.</p>';
      return;
    }
    const indexFile = indexData.flat.find(f => f.path.split('/')[0] === section && f.isIndex);
    if (indexFile) {
      // Load index for top nav
      try {
        if (indexFile.ext === ".md") {
          await renderMarkdown(indexFile.path);
        } else {
          renderIframe(indexFile.path);
        }
      } catch (e) {
        els.viewer.innerHTML = '<h1>Error Loading Index</h1><p>Unable to load section index.</p>';
      }
    } else {
      // Dynamic load for drop-down style
      els.sectionSelect.value = section;
      renderList();
      loadDefaultForSection(section);
    }
  } else {
    const file = indexData.flat.find(f => f.path === rel);
    if (!file) {
      els.viewer.innerHTML = '<h1>404: File Not Found</h1><p>Check the URL or search again.</p>';
      return;
    }
    try {
      if (file.ext === ".md") {
        await renderMarkdown(file.path);
      } else {
        renderIframe(file.path);
      }
    } catch (e) {
      els.viewer.innerHTML = '<h1>Error Loading Content</h1><p>Unable to load. File may be invalid.</p>';
    }
  }
}

async function renderMarkdown(rel) {
  const src = await fetch(rel).then(r => { if (!r.ok) throw new Error('Fetch failed'); return r.text(); });
  const html = marked.parse(src);
  els.viewer.innerHTML = `<article>${html}</article>`;
}

function renderIframe(rel) {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("sandbox", "allow-same-origin allow-scripts allow-forms");
  iframe.loading = "eager";
  iframe.src = "/" + rel;
  els.viewer.appendChild(iframe);
  iframe.addEventListener("load", () => {
    if (rel.endsWith('.pdf')) return;
    try {
      const d = iframe.contentDocument || iframe.contentWindow.document;
      const s = d.createElement("style");
      s.textContent = `
        html,body{margin:0;padding:0;background:transparent;color:#e6e3d7;font:16px/1.6 Inter,ui-sans-serif;}
        main,article,section{max-width:720px;margin:auto;padding:2rem;}
      `;
      d.head.appendChild(s);
    } catch {}
  });
}

function renderDefault() {
  const latest = [...indexData.flat].sort((a, b) => b.mtime - a.mtime)[0];
  if (latest) {
    location.hash = "#/" + latest.path;
  } else {
    els.viewer.innerHTML = '<h1>Welcome to The Fold Within</h1><p>Add content to sections and redeploy to get started.</p>';
  }
}

init();