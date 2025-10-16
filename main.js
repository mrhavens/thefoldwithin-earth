// main.js
// Client-side markdown renderer for "The Fold Within"

document.addEventListener('DOMContentLoaded', async () => {
  const content = document.querySelector('main');
  const postsDir = 'posts/';
  
  // Load Markdown renderer
  const rendererScript = document.createElement('script');
  rendererScript.src = 'https://cdn.jsdelivr.net/npm/marked/marked.min.js';
  document.head.appendChild(rendererScript);

  rendererScript.onload = () => {
    // Attach click handlers to all articles
    document.querySelectorAll('article').forEach(article => {
      article.addEventListener('click', async () => {
        const slug = article.querySelector('h3').textContent.trim()
          .toLowerCase().replace(/\s+/g, '-');
        loadPost(slug);
      });
    });
  };

  async function loadPost(slug) {
    try {
      const res = await fetch(`${postsDir}${slug}.md`);
      if (!res.ok) throw new Error('Post not found.');
      const md = await res.text();
      const html = marked.parse(md);

      content.innerHTML = `
        <section class="post">
          <a href="#" id="back">← Back</a>
          <div class="markdown">${html}</div>
        </section>
      `;

      document.getElementById('back').addEventListener('click', () => location.reload());
    } catch (err) {
      content.innerHTML = `<p class="error">⚠️ ${err.message}</p>`;
    }
  }
});