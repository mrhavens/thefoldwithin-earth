// build.js — auto-index Markdown posts for The Fold Within
// Parses front-matter, removes it from body, and generates clean summaries.

import fs from "fs";
import path from "path";

const POSTS_DIR = path.join(".", "posts");
const SITE_URL = "https://thefoldwithin.earth"; // Update if needed

function slugify(s) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

// --- Extract YAML-style front matter ---
function parseFrontMatter(src) {
  const fm = { title: "", date: "", excerpt: "", tags: [] };
  const match = src.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) return { fm, body: src };

  const block = match[1];
  for (const line of block.split("\n")) {
    const [key, ...rest] = line.split(":");
    const value = rest.join(":").trim();
    if (key.trim() === "title") fm.title = value;
    if (key.trim() === "date") fm.date = value;
    if (key.trim() === "excerpt") fm.excerpt = value;
    if (key.trim() === "tags") {
      fm.tags = value
        .replace(/[\[\]]/g, "")
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);
    }
  }
  const body = src.slice(match[0].length).trim();
  return { fm, body };
}

function firstParagraph(text) {
  const para = text
    .replace(/\r/g, "")
    .split(/\n{2,}/)
    .find((p) => p.replace(/\s/g, "").length > 0);
  return para ? para.replace(/\n/g, " ").trim() : "";
}

function toISODate(s, fallback) {
  const d = s ? new Date(s) : null;
  if (d && !isNaN(d.getTime())) return d;
  return fallback;
}

function escapeXML(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

const files = fs
  .readdirSync(POSTS_DIR)
  .filter((f) => f.endsWith(".md") && !f.startsWith("_"));

const posts = files.map((file) => {
  const raw = fs.readFileSync(path.join(POSTS_DIR, file), "utf8");
  const stat = fs.statSync(path.join(POSTS_DIR, file));
  const { fm, body } = parseFrontMatter(raw);

  const fallbackTitle = file.replace(/\.md$/, "").replace(/-/g, " ");
  const title = fm.title || fallbackTitle;
  const slug = slugify(title);
  const excerpt =
    fm.excerpt ||
    (firstParagraph(body).slice(0, 200) +
      (firstParagraph(body).length > 200 ? "…" : ""));
  const dateISO = toISODate(fm.date, stat.mtime);

  return {
    title,
    date: dateISO.toISOString().split("T")[0], // human-readable YYYY-MM-DD
    excerpt,
    tags: fm.tags || [],
    slug,
    file,
  };
});

// newest first
posts.sort((a, b) => (a.date < b.date ? 1 : -1));

// write posts.json
fs.writeFileSync(
  path.join(POSTS_DIR, "posts.json"),
  JSON.stringify(posts, null, 2),
  "utf8"
);
console.log(`✅ Generated posts.json (${posts.length} posts)`);

// write rss.xml
const rssItems = posts
  .map((p) => {
    const url = `${SITE_URL}/#/post/${p.slug}`;
    return `
  <item>
    <title>${escapeXML(p.title)}</title>
    <link>${url}</link>
    <guid>${url}</guid>
    <pubDate>${new Date(p.date).toUTCString()}</pubDate>
    <description>${escapeXML(p.excerpt)}</description>
  </item>`;
  })
  .join("");

const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
  <title>The Fold Within</title>
  <link>${SITE_URL}</link>
  <description>Uncovering the Recursive Real.</description>
  <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
  ${rssItems}
</channel>
</rss>`;

fs.writeFileSync("rss.xml", rss, "utf8");
console.log("✅ rss.xml written");

// write sitemap.xml
const sitemapUrls = posts
  .map((p) => `  <url><loc>${SITE_URL}/#/post/${p.slug}</loc></url>`)
  .join("\n");
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${SITE_URL}</loc></url>
${sitemapUrls}
</urlset>`;
fs.writeFileSync("sitemap.xml", sitemap, "utf8");
console.log("✅ sitemap.xml written");