// build.js — tiny static-site generator without the generator
// Scans /posts/*.md, extracts front-matter & first paragraph,
// writes posts/posts.json, rss.xml, and sitemap.xml

const fs = require("fs");
const path = require("path");

const POSTS_DIR = path.join(__dirname, "posts");
const SITE_URL  = "https://thefoldwithin.earth"; // change if needed

function slugify(s) {
  return s
    .toLowerCase()
    .normalize("NFKD").replace(/[^\w\s-]/g, "")
    .trim().replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function parseFrontMatter(src) {
  // very small YAML-ish parser
  const fm = { title: "", date: "", excerpt: "", tags: [] };
  const m = src.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!m) return { fm, body: src };

  const block = m[1];
  for (const line of block.split("\n")) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let val = line.slice(idx + 1).trim();

    if (key === "tags") {
      // tags: [a, b, c] OR tags: a, b, c
      if (/^\[.*\]$/.test(val)) {
        val = val.replace(/^\[|\]$/g, "");
      }
      fm.tags = val.split(",").map(t => t.trim()).filter(Boolean);
    } else if (key in fm) {
      fm[key] = val;
    }
  }
  const body = src.slice(m[0].length);
  return { fm, body };
}

function firstParagraph(text) {
  const body = text.replace(/\r/g, "").trim();
  const noFM  = body.replace(/^---[\s\S]*?---/, "").trim();
  const para  = noFM.split(/\n{2,}/).find(p => p.replace(/\s/g, "").length > 0) || "";
  return para.replace(/\n/g, " ").trim();
}

function toISODate(s, fallback) {
  // try to parse; if fail, fallback (usually file mtime)
  const d = s ? new Date(s) : null;
  if (d && !isNaN(d.getTime())) return d.toISOString();
  return fallback.toISOString();
}

function escapeXML(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

const files = fs.readdirSync(POSTS_DIR).filter(f => f.endsWith(".md"));

const posts = files.map(file => {
  const full  = path.join(POSTS_DIR, file);
  const raw   = fs.readFileSync(full, "utf8");
  const stat  = fs.statSync(full);
  const { fm, body } = parseFrontMatter(raw);

  const fallbackTitle = file.replace(/\.md$/i, "").replace(/-/g, " ").replace(/\s+/g, " ").trim();
  const title   = fm.title || fallbackTitle;
  const excerpt = fm.excerpt || (firstParagraph(raw).slice(0, 200) + (firstParagraph(raw).length > 200 ? "…" : ""));
  const slug    = slugify(fm.title || fallbackTitle);
  const dateISO = toISODate(fm.date, stat.mtime);

  return {
    title,
    date: dateISO,         // ISO for reliable sort
    excerpt,
    tags: fm.tags || [],
    slug,
    file                      // actual filename
  };
});

// newest first
posts.sort((a, b) => (a.date < b.date ? 1 : -1));

// write JSON index
fs.writeFileSync(
  path.join(POSTS_DIR, "posts.json"),
  JSON.stringify(posts, null, 2),
  "utf8"
);
console.log(`✅ posts.json written (${posts.length} posts)`);

// write RSS
const rssItems = posts.map(p => {
  const url = `${SITE_URL}/#/post/${p.slug}`;
  return `
  <item>
    <title>${escapeXML(p.title)}</title>
    <link>${url}</link>
    <guid>${url}</guid>
    <pubDate>${new Date(p.date).toUTCString()}</pubDate>
    <description>${escapeXML(p.excerpt)}</description>
  </item>`;
}).join("");

const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
  <title>The Fold Within</title>
  <link>${SITE_URL}</link>
  <description>Uncovering the recursive real.</description>
  <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
  ${rssItems}
</channel>
</rss>`;

fs.writeFileSync(path.join(__dirname, "rss.xml"), rss, "utf8");
console.log("✅ rss.xml written");

// write sitemap
const sitemapUrls = posts.map(p => `  <url><loc>${SITE_URL}/#/post/${p.slug}</loc></url>`).join("\n");
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${SITE_URL}</loc></url>
${sitemapUrls}
</urlset>`;
fs.writeFileSync(path.join(__dirname, "sitemap.xml"), sitemap, "utf8");
console.log("✅ sitemap.xml written");