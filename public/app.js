/* ============================================================
   The Fold Within — app.js v2.6.2
   ============================================================ */

document.addEventListener("DOMContentLoaded", () => {
  const sidebar = document.querySelector(".sidebar");
  const overlay = document.querySelector(".overlay");
  const navToggle = document.getElementById("navToggle");
  const content = document.querySelector(".content");
  const mdView = document.getElementById("mdView");
  const htmlView = document.getElementById("htmlView");

  let currentPath = "";
  let usedFallback = false;

  /* ============================================================
     Sidebar Toggle (Desktop + Mobile)
     ============================================================ */
  navToggle.addEventListener("click", () => {
    const isDesktop = window.innerWidth >= 900;
    if (isDesktop) {
      sidebar.classList.toggle("collapsed");
      content.classList.toggle("full");
    } else {
      sidebar.classList.toggle("open");
      overlay.classList.toggle("active");
    }
  });

  overlay.addEventListener("click", () => {
    sidebar.classList.remove("open");
    overlay.classList.remove("active");
  });

  /* ============================================================
     Load External Libraries (Marked + DOMPurify)
     ============================================================ */
  async function ensureLibsReady(timeoutMs = 4000) {
    const start = Date.now();
    while (
      (!window.marked || !window.DOMPurify) &&
      Date.now() - start < timeoutMs
    ) {
      await new Promise((r) => setTimeout(r, 100));
    }
    if (!window.marked || !window.DOMPurify) {
      console.warn("Markdown libraries not loaded — fallback to plain text.");
      usedFallback = true;
    } else usedFallback = false;
  }

  /* ============================================================
     File Loading + Rendering
     ============================================================ */
  async function loadFile(path) {
    if (!path) return;
    currentPath = path;

    try {
      const res = await fetch(path);
      if (!res.ok) throw new Error(`Path not found: ${path}`);

      const ext = path.split(".").pop().toLowerCase();
      const text = await res.text();

      if (ext === "md" || ext === "markdown") {
        await ensureLibsReady();
        renderMarkdown(text);
      } else if (ext === "html" || ext === "htm") {
        renderHTML(text);
      } else {
        mdView.innerHTML = `<div class="md-warn">Unsupported file type: ${ext}</div>`;
        htmlView.innerHTML = "";
      }
    } catch (err) {
      console.error(err);
      mdView.innerHTML = `<div class="md-warn">${err.message}</div>`;
      htmlView.innerHTML = "";
    }
  }

  /* ============================================================
     Renderers
     ============================================================ */
  function renderMarkdown(text) {
    const safe = window.DOMPurify
      ? DOMPurify.sanitize(window.marked.parse(text))
      : text
          .replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
    mdView.innerHTML = usedFallback
      ? `<div class='md-warn'>Markdown fallback to plain text (libs failed). Check console.</div><pre>${safe}</pre>`
      : safe;
    fadeIn(mdView);
  }

  function renderHTML(text) {
    htmlView.srcdoc = text;
    fadeIn(htmlView);
  }

  /* ============================================================
     Tree Navigation (dynamic)
     ============================================================ */
  document.querySelectorAll(".file").forEach((fileEl) => {
    fileEl.addEventListener("click", () => {
      const path = fileEl.dataset.path;
      loadFile(path);

      // highlight active
      document
        .querySelectorAll(".file.active")
        .forEach((el) => el.classList.remove("active"));
      fileEl.classList.add("active");

      // auto-collapse mobile
      if (window.innerWidth < 900) {
        sidebar.classList.remove("open");
        overlay.classList.remove("active");
      }
    });
  });

  /* ============================================================
     Fade Animation Helper
     ============================================================ */
  function fadeIn(el) {
    if (!el) return;
    el.classList.remove("fade-in");
    void el.offsetWidth; // reflow
    el.classList.add("fade-in");
  }

  /* ============================================================
     Hash-Based Routing (supports #=posts/file.md)
     ============================================================ */
  function handleHashChange() {
    const hash = window.location.hash.replace(/^#=+/, "");
    if (hash && hash !== currentPath) loadFile(hash);
  }

  window.addEventListener("hashchange", handleHashChange);
  handleHashChange();

  /* ============================================================
     Keyboard Shortcuts (optional)
     ============================================================ */
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      sidebar.classList.remove("open", "collapsed");
      content.classList.remove("full");
      overlay.classList.remove("active");
    }
  });
});