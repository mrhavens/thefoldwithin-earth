// main.js — client router + markdown renderer
// Routes:
//   #/          -> index
//   #/post/:id  -> render that post

const state = {
  posts: [],
  bySlug: new Map()
};

function $(sel) { return document.querySelector(sel); }

window.addEventListener("hashchange", router);
document.addEventListener("DOMContentLoaded", init);

async function init() {
  try {
    const res = await fetch("posts/posts.json", { cache: "no-cache" });
    if (!res.ok) throw new Error("Could not load posts index.");
    state.posts = await res.json();
    state.bySlug = new Map(state.posts.map(p => [p.slug, p]));

    // render index initially, or route if hash present
    router();
  } catch (err) {
    const container = $("#posts");
    if (container) container.innerHTML = `<p class="error">⚠️ ${err.message}</p>`;
  }
}

function router() {
  const hash = location.hash.replace(/^#/, "");
  const parts = hash.split("/").filter(Boolean);

  if (parts[0] === "post" && parts[1]) {
    renderPost(parts[1]);
  } else {
    renderIndex();
  }
}

function renderIndex() {
  const postsContainer = $("#posts");
  if (!postsContainer) return;
  postsContainer.innerHTML = "";

  state.posts.forEach(post => {
    const article = document.createElement("article");
    article.innerHTML = `
      <div class="thumb"></div>
      <h3>${post.title}</h3>
      <p class="date">${new Date(post.date).toLocaleDateString()}</p>
      <p>${post.excerpt}</p>
    `;
    article.addEventListener("click", () => {
      location.hash = `/post/${post.slug}`;
    });
    postsContainer.appendChild(article);
  });
}

async function renderPost(slug) {
  const main = document.querySelector("main");
  const meta = state.bySlug.get(slug);

  if (!meta) {
    main.innerHTML = `<p class="error">⚠️ Post not found.</p>`;
    return;
  }

  try {
    const res = await fetch(`posts/${meta.file}`, { cache: "no-cache" });
    if (!res.ok) throw new Error("Post file missing.");
    const md = await res.text();
    const html = marked.parse(md);

    main.innerHTML = `
      <section class="post">
        <a href="#/" id="back">← Back to Archive</a>
        <div class="markdown">${html}</div>
      </section>
    `;

    $("#back").addEventListener("click", () => (location.hash = "/"));
  } catch (err) {
    main.innerHTML = `<p class="error">⚠️ ${err.message}</p>`;
  }
}