let INDEX, CURRENT_PATH = null, PATH_TO_EL = new Map();
const treeEl = document.getElementById("tree");
const mdView = document.getElementById("mdView");
const htmlView = document.getElementById("htmlView");
const metaLine = document.getElementById("meta");
const sortSel = document.getElementById("sort");
const filterSel = document.getElementById("filter");
const searchBox = document.getElementById("search");
const prevBtn = document.getElementById("prev");
const nextBtn = document.getElementById("next");
const sidebar = document.querySelector(".sidebar");
const navToggle = document.getElementById("navToggle");
const overlay = document.querySelector(".overlay");

navToggle.addEventListener("click", () => sidebar.classList.toggle("open"));
overlay.addEventListener("click", () => sidebar.classList.remove("open"));

// ... (rest same as v2.2.1 up to renderMarkdown)

async function renderMarkdown(path) {
  mdView.style.display = "none";
  const res = await fetch("/" + path);
  if (!res.ok) { mdView.innerHTML = "<p>File not found: " + path + "</p>"; requestAnimationFrame(() => mdView.style.display = "block"); return; }
  const text = await res.text();
  let html = text.replace(/&/g, '&amp;').replace(/</g, '&lt;');  // Default fallback
  let usedFallback = true;
  if (window.marked) {
    html = window.marked.parse(text);
    usedFallback = false;
  }
  let safe = html;
  if (window.DOMPurify) safe = window.DOMPurify.sanitize(html);
  mdView.innerHTML = safe;
  requestAnimationFrame(() => { mdView.style.display = "block"; htmlView.style.display = "none"; });
  if (usedFallback) console.warn("Markdown rendered as plain text: marked.js not loaded. Check CDN/SRI.");
}

// ... (rest same)