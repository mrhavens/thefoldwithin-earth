const els = {
  body: document.body,
  menuBtn: document.getElementById("menuBtn"),
  primaryNav: document.getElementById("primaryNav"),
  sectionSelect: document.getElementById("sectionSelect"),
  sortSelect: document.getElementById("sortSelect"),
  searchBox: document.getElementById("searchBox"),
  postList: document.getElementById("postList"),
  viewer: document.getElementById("viewer"),
  content: document.getElementById("content")
};

const staticPages = new Set(["about", "contact", "legal"]);
const sectionIcons = { // Optional: Add icons per section (e.g., 'essays': '✍️')
  essays: '✍️',
  fieldnotes: '📓',
  pinned: '📌'
};

let indexData = null;
let sidebarOpen = false;

async function init() {
  try {
    indexData = await (await fetch("index.json")).json();
    populateNav();
    populateSections();
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
  staticPages.forEach(p => {
    els.primaryNav.innerHTML += `<a href="#/${p}/">${p.charAt(0).toUpperCase() + p.slice(1)}</a>`;
  });
  indexData.sections.forEach(s => {
    els.primaryNav.innerHTML += `<a href="#/${s}/">${s.charAt(0).toUpperCase() + s.slice(1)}</a>`;
  });
}

function populateSections() {
  els.sectionSelect.innerHTML = "";
  indexData.sections.forEach(s => {
    const icon = sectionIcons[s] ? `${sectionIcons[s]} ` : '';
    const opt = document.createElement("option");
    opt.value = s;
    opt.textContent = `${icon}${s}`;
    els.sectionSelect.appendChild(opt);
  });
}

function wireUI() {
  els.menuBtn.addEventListener("click", () => {
    sidebarOpen = !sidebarOpen;
    document.body.classList.toggle("sidebar-open", sidebarOpen);
  });
  els.sectionSelect.addEventListener("change", renderList);
  els.sortSelect.addEventListener("change", renderList);
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
  const sort = els.sortSelect.value;
  const query = els.searchBox.value.toLowerCase();

  let posts = indexData.flat.filter(p => p.path.split('/')[0] === section);
  if (query) posts = posts.filter(p => p.title.toLowerCase().includes(query));
  posts.sort((a, b) => sort === "newest" ? b.mtime - a.mtime : a.mtime - b.mtime);

  els.postList.innerHTML = "";
  for (const p of posts) {
    const li = document.createElement("li");
    const pin = p.pinned ? "&#9733; " : "";
    li.innerHTML = `<a href="#/${p.path}">${pin}${p.title}</a><br><small>${new Date(p.mtime).toISOString().split("T")[0]}</small>`;
    els.postList.appendChild(li);
  }
}

async function handleHash() {
  els.viewer.innerHTML = "";
  const rel = location.hash.replace(/^#\//, "");
  if (!rel) return renderDefault();

  if (rel.endsWith('/')) {
    const section = rel.replace(/\/$/, '');
    if (staticPages.has(section)) {
      renderIframe(`${section}/index.html`);
    } else if (indexData.sections.includes(section)) {
      els.sectionSelect.value = section;
      renderList();
      const sectionPosts = indexData.flat.filter(p => p.path.split('/')[0] === section);
      if (sectionPosts.length === 0) {
        els.viewer.innerHTML = `<h1>${section.charAt(0).toUpperCase() + section.slice(1)}</h1><p>No content in this section yet. Check back soon!</p>`;
      } else {
        const latest = sectionPosts.sort((a, b) => b.mtime - a.mtime)[0];
        location.hash = '#/' + latest.path;
      }
    } else {
      els.viewer.innerHTML = '<h1>404: Section Not Found</h1><p>The requested section does not exist.</p>';
    }
  } else {
    const file = indexData.flat.find(f => f.path === rel);
    if (!file) {
      els.viewer.innerHTML = '<h1>404: File Not Found</h1><p>The requested file could not be located.</p>';
      return;
    }
    try {
      if (file.ext === ".md") {
        await renderMarkdown(file.path);
      } else {
        renderIframe(file.path);
      }
    } catch (e) {
      els.viewer.innerHTML = '<h1>Error Loading Content</h1><p>Unable to load the file. It may be corrupted or inaccessible.</p>';
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
    els.viewer.innerHTML = '<h1>Welcome</h1><p>No content yet. Add files to sections and redeploy!</p>';
  }
}

init();