async function handleHash() {
  els.viewer.innerHTML = "";
  const rel = location.hash.replace(/^#\//, "");
  if (!rel) return renderDefault();

  if (rel.endsWith('/')) {
    const section = rel.slice(0, -1);
    const indexFile = indexData.flat.find(f => 
      f.path.startsWith(section + "/") && f.isIndex
    );

    if (indexFile) {
      // ALWAYS render the index file — never show file name
      try {
        if (indexFile.ext === ".md") {
          const src = await fetch(indexFile.path).then(r => r.ok ? r.text() : "");
          const html = marked.parse(src || "# " + section);
          els.viewer.innerHTML = `<article class="markdown">${html}</article>`;
        } else {
          renderIframe(indexFile.path);
        }
      } catch (e) {
        // If fetch fails, show clean message
        els.viewer.innerHTML = `<h1>${section}</h1><p>No content yet.</p>`;
      }
    } else {
      // No index file → show posts
      els.sectionSelect.value = section;
      renderList();
      loadDefaultForSection(section);
    }
  } else {
    const file = indexData.flat.find(f => f.path === rel);
    if (!file) {
      els.viewer.innerHTML = "<h1>404</h1><p>Not found.</p>";
      return;
    }
    file.ext === ".md" ? await renderMarkdown(file.path) : renderIframe(file.path);
  }
}