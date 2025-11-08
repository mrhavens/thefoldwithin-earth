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

let indexData = null;
let state = { section: "posts", sort: "newest", query: "", sidebarOpen: false };

async function init(){
  indexData = await (await fetch("index.json")).json();
  populateSections();
  wireUI();
  renderList();
  handleHash();
  window.addEventListener("hashchange", handleHash);
}

function populateSections(){
  els.sectionSelect.innerHTML = "";
  indexData.sections.forEach(s=>{
    const opt = document.createElement("option");
    opt.value = s; opt.textContent = s;
    els.sectionSelect.appendChild(opt);
  });
}

function wireUI(){
  els.menuBtn.addEventListener("click", ()=>{
    state.sidebarOpen = !state.sidebarOpen;
    document.body.classList.toggle("sidebar-open", state.sidebarOpen);
  });
  els.sectionSelect.addEventListener("change", ()=>renderList());
  els.sortSelect.addEventListener("change", ()=>renderList());
  els.searchBox.addEventListener("input", ()=>renderList());
  els.content.addEventListener("click", ()=>{
    if (window.matchMedia("(max-width:1024px)").matches && document.body.classList.contains("sidebar-open")){
      document.body.classList.remove("sidebar-open");
      state.sidebarOpen = false;
    }
  });
}

function renderList(){
  const section = els.sectionSelect.value;
  const sort = els.sortSelect.value;
  const query = els.searchBox.value.toLowerCase();

  let posts = indexData.flat.filter(p=>p.path.startsWith(section));
  if (query) posts = posts.filter(p=>p.title.toLowerCase().includes(query));
  posts.sort((a,b)=> sort==="newest"? b.mtime-a.mtime : a.mtime-b.mtime);

  els.postList.innerHTML = "";
  for (const p of posts){
    const li = document.createElement("li");
    li.innerHTML = `<a href="#/${p.path}">${p.title}</a><br><small>${new Date(p.mtime).toISOString().split("T")[0]}</small>`;
    els.postList.appendChild(li);
  }
}

async function handleHash(){
  const rel = location.hash.replace(/^#\//,"");
  if (!rel) return renderDefault();
  const file = indexData.flat.find(f=>f.path===rel);
  if (!file) return;
  file.ext===".md"? await renderMarkdown(file.path) : renderHTML(file.path);
}

async function renderMarkdown(rel){
  const src = await fetch(rel).then(r=>r.text());
  const html = marked.parse(src);
  els.viewer.innerHTML = `<article>${html}</article>`;
}

function renderHTML(rel){
  const iframe = document.createElement("iframe");
  iframe.setAttribute("sandbox","allow-same-origin allow-scripts allow-forms");
  iframe.loading = "eager";
  iframe.src = "/" + rel;
  els.viewer.innerHTML = "";
  els.viewer.appendChild(iframe);
  iframe.addEventListener("load", ()=>{
    try{
      const d = iframe.contentDocument || iframe.contentWindow.document;
      const s = d.createElement("style");
      s.textContent = `
        html,body{margin:0;padding:0;background:transparent;color:#e6e3d7;font:16px/1.6 Inter,ui-sans-serif;}
        main,article,section{max-width:720px;margin:auto;padding:2rem;}
      `;
      d.head.appendChild(s);
    }catch{}
  });
}

function renderDefault(){
  const latest = [...indexData.flat].sort((a,b)=>b.mtime-a.mtime)[0];
  if (latest) location.hash = "#/" + latest.path;
}

init();