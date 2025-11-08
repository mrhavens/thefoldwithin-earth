let INDEX, CURRENT_PATH=null, PATH_TO_EL=new Map();
const treeEl=document.getElementById("tree");
const mdView=document.getElementById("mdView");
const iframe=document.getElementById("htmlView");
const metaLine=document.getElementById("meta");
const sortSel=document.getElementById("sort");
const filterSel=document.getElementById("filter");
const searchBox=document.getElementById("search");
const prevBtn=document.getElementById("prev");
const nextBtn=document.getElementById("next");

async function loadIndex(){
  const res=await fetch("/index.json",{cache:"no-store"});
  INDEX=await res.json();
  populateFilters();
  rebuildTree();
  window.addEventListener("popstate",()=>{const hp=location.hash.slice(2);if(hp)openPath(hp);});
  const init=location.hash.slice(2)||INDEX.flat.sort((a,b)=>b.mtime-a.mtime)[0].path;
  openPath(init);
}
function populateFilters(){
  const cats=new Set(INDEX.sections);
  filterSel.innerHTML='<option value="all">All</option>';
  for(const c of cats){const o=document.createElement("option");o.value=c;o.textContent=c;filterSel.appendChild(o);}
}
function rebuildTree(){
  treeEl.innerHTML="";
  const filter=filterSel.value;
  const sort=sortSel.value;
  const query=searchBox.value.toLowerCase();
  for(const dir of INDEX.tree){
    if(filter!=="all"&&dir.name!==filter)continue;
    treeEl.appendChild(renderNode(dir,sort,query));
  }
}
function renderNode(node,sort,query){
  if(node.type==="dir"){
    const div=document.createElement("div");
    div.className="dir";div.setAttribute("aria-expanded","false");
    const lbl=document.createElement("span");
    lbl.className="label";lbl.textContent=node.name;
    lbl.addEventListener("click",()=>{
      const idx=node.children.find(c=>/^index\.(md|html)$/.test(c.name));
      if(idx)openPath(idx.path);
      else div.classList.toggle("open");
    });
    div.appendChild(lbl);
    const kids=document.createElement("div");kids.className="children";
    const sorted=[...node.children].sort((a,b)=>{
      if(sort==="name")return a.name.localeCompare(b.name);
      return sort==="old"?a.mtime-b.mtime:b.mtime-a.mtime;
    });
    for(const c of sorted){
      if(c.type==="file"){
        if(query&&!c.title.toLowerCase().includes(query))continue;
        const a=document.createElement("a");
        a.className="file";a.textContent=c.title;
        a.addEventListener("click",e=>{e.preventDefault();openPath(c.path);});
        PATH_TO_EL.set(c.path,a);
        kids.appendChild(a);
      }else kids.appendChild(renderNode(c,sort,query));
    }
    div.appendChild(kids);
    return div;
  }
  return document.createTextNode("");
}

async function openPath(path){
  if(path===CURRENT_PATH)return;
  CURRENT_PATH=path;
  if(location.hash!==`#=${path}`)history.pushState(null,"",`#=${path}`);
  let f=INDEX.flat.find(x=>x.path===path);
  if(!f){metaLine.textContent="Not found";return;}
  metaLine.textContent=`${f.pinned?"📌 ":""}${new Date(f.mtime).toISOString().slice(0,10)} • ${f.name}`;
  if(f.ext===".md")await renderMarkdown(f.path);
  else renderHTML(f.path);
  setActive(path);
  updatePager();
  if(window.innerWidth<900)document.querySelector(".sidebar").classList.remove("open");
}
async function renderMarkdown(path){
  const res=await fetch(path);
  if(!res.ok){mdView.innerHTML="<p>File not found</p>";return;}
  const text=await res.text();
  const html=(window.marked?window.marked.parse(text):text);
  const safe=(window.DOMPurify?window.DOMPurify.sanitize(html):html);
  mdView.innerHTML=safe;
  iframe.style.display="none";mdView.style.display="block";
}
function renderHTML(path){
  iframe.src=path;
  iframe.style.display="block";mdView.style.display="none";
}
function setActive(path){
  document.querySelectorAll(".file.active").forEach(el=>el.classList.remove("active"));
  const el=PATH_TO_EL.get(path);
  if(el){el.classList.add("active");let p=el.parentElement;while(p&&p!==treeEl){if(p.classList.contains("children"))p.parentElement.classList.add("open");p=p.parentElement;}}
}
function updatePager(){
  const list=INDEX.flat.filter(f=>f.ext===".md"||f.ext===".html").sort((a,b)=>b.mtime-a.mtime);
  const i=list.findIndex(x=>x.path===CURRENT_PATH);
  prevBtn.disabled=i<=0;nextBtn.disabled=i>=list.length-1;
  prevBtn.onclick=()=>{if(i>0)openPath(list[i-1].path);};
  nextBtn.onclick=()=>{if(i<list.length-1)openPath(list[i+1].path);};
}
let searchTimer;
searchBox.addEventListener("input",()=>{clearTimeout(searchTimer);searchTimer=setTimeout(rebuildTree,300);});
sortSel.addEventListener("change",rebuildTree);
filterSel.addEventListener("change",rebuildTree);
document.body.addEventListener("click",e=>{
  const a=e.target.closest("a[href]");
  if(!a)return;
  const href=a.getAttribute("href");
  if(href.startsWith("/")&&!href.startsWith("//")&&!a.target){
    e.preventDefault();
    openPath(href.replace(/^\//,""));
  }
});
window.addEventListener("DOMContentLoaded",loadIndex);