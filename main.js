// main.js — dynamic markdown loader for The Fold Within

document.addEventListener("DOMContentLoaded", async () => {
  const postsContainer = document.getElementById("posts");
  const main = document.querySelector("main");

  // Load post metadata from posts.json
  const response = await fetch("posts/posts.json");
  const posts = await response.json();

  // Render index of posts
  posts.forEach(post => {
    const article = document.createElement("article");
    article.innerHTML = `
      <div class="thumb"></div>
      <h3>${post.title}</h3>
      <p class="date">${post.date}</p>
      <p>${post.excerpt}</p>
    `;
    article.addEventListener("click", () => loadPost(post.file));
    postsContainer.appendChild(article);
  });

  // Load a markdown post dynamically
  async function loadPost(filename) {
    try {
      const res = await fetch(`posts/${filename}`);
      if (!res.ok) throw new Error("Post not found.");
      const md = await res.text();
      const html = marked.parse(md);

      main.innerHTML = `
        <section class="post">
          <a href="#" id="back">← Back to Archive</a>
          <div class="markdown">${html}</div>
        </section>
      `;

      document.getElementById("back").addEventListener("click", () => location.reload());
    } catch (err) {
      main.innerHTML = `<p class="error">⚠️ ${err.message}</p>`;
    }
  }
});