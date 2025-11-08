const els = {
  body: document.body,
  menuBtn: document.getElementById("menuBtn"),
  sectionSelect: document.getElementById("sectionSelect"),
  sortSelect: document.getElementById("sortSelect"),
  searchBox: document.getElementById("searchBox"),
  postList: document.getElementById("postList"),
  viewer: document.getElementById("viewer"),
  content: document.getElementById("content")
};

const staticPages = new Set(["about", "contact", "legal"]);

let indexData = null;
let sidebarOpen = false;

async function init() {
  try {
    indexData = await (await fetch("index.json")).json();
    populateSections();
    wireUI();
    renderList();
    handleHash();
    window.addEventListener("hashchange", handleHash);
  } catch (e) {
    els.viewer.innerHTML = "<h1>Error Loading Index</h1><p>Failed to load site data. Please try refreshing.</p>";
  }
}

function populateSections() {
  els.sectionSelect.innerHTML = "";
  indexData.sections.forEach(s => {
    const opt = document.createElement("option");
    opt.value = s;
    opt.textContent = s;
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
  els.viewer.innerHTML = ""; // Clear viewer to avoid stale content
  const rel = location.hash.replace(/^#\//, "");
  if (!rel) return renderDefault();

  if (rel.endsWith('/')) {
    const section = rel.replace(/\/$/, '');
    if (staticPages.has(section)) {
      renderHTML(section + '/index.html');
    } else if (indexData.sections.includes(section)) {
      els.sectionSelect.value = section;
      renderList();
      const sectionPosts = indexData.flat.filter(p => p.path.split('/')[0] === section);
      if (sectionPosts.length === 0) {
        els.viewer.innerHTML = `<h1>${section.charAt(0).toUpperCase() + section.slice(1)}</h1><p>No posts in this section yet.</p>`;
      } else {
        const latest = sectionPosts.sort((a, b) => b.mtime - a.mtime)[0];
        location.hash = '#/' + latest.path; // Triggers hashchange to load
      }
    } else {
      els.viewer.innerHTML = '<h1>404 Not Found</h1>';
    }
  } else {
    const file = indexData.flat.find(f => f.path === rel);
    if (!file) {
      els.viewer.innerHTML = '<h1>404 Not Found</h1>';
      return;
    }
    try {
      file.ext === ".md" ? await renderMarkdown(file.path) : renderHTML(file.path);
    } catch (e) {
      els.viewer.innerHTML = '<h1>Error Loading Content</h1><p>Failed to load the file. Please try another.</p>';
    }
  }
}

async function renderMarkdown(rel) {
  const src = await fetch(rel).then(r => { if (!r.ok) throw new Error(); return r.text(); });
  const html = marked.parse(src);
  els.viewer.innerHTML = `<article>${html}</article>`;
}

function renderHTML(rel) {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("sandbox", "allow-same-origin allow-scripts allow-forms");
  iframe.loading = "eager";
  iframe.src = "/" + rel;
  els.viewer.appendChild(iframe);
  iframe.addEventListener("load", () => {
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
  if (latest) location.hash = "#/" + latest.path;
}

init();