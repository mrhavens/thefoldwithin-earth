#!/usr/bin/env node
/**
 * Enhanced Index Generator for The Fold Within
 * Outputs: index.json, sitemap.xml, robots.txt, feed.xml, schema.jsonld
 */

import { promises as fs } from "fs";
import path from "path";
import pdf from "pdf-parse";

const ROOT = "public";
const BASE_URL = "https://thefoldwithin.earth";
const OUT_JSON = path.join(ROOT, "index.json");
const OUT_SITEMAP = path.join(ROOT, "sitemap.xml");
const OUT_ROBOTS = path.join(ROOT, "robots.txt");
const OUT_FEED = path.join(ROOT, "feed.xml");
const OUT_SCHEMA = path.join(ROOT, "schema.jsonld");
const EXCERPT_LENGTH = 400;

// Existing functions (preserved)
function dateFromName(name) {
  const m = name.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? new Date(m[0]).getTime() : null;
}

async function readHead(abs, full = false) {
  const fh = await fs.open(abs, "r");
  const size = full ? await fs.stat(abs).then(s => Math.min(s.size, EXCERPT_LENGTH * 2)) : 64 * 1024;
  const buf = Buffer.alloc(size);
  const { bytesRead } = await fh.read(buf, 0, size, 0);
  await fh.close();
  return buf.slice(0, bytesRead).toString("utf8");
}

function parseTitle(raw, ext) {
  if (ext === ".md") return raw.match(/^\s*#\s+(.+?)\s*$/m)?.[1].trim();
  if (ext === ".html") return raw.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1].trim();
  return null;
}

function extractExcerpt(raw, ext) {
  if (ext === ".md") raw = raw.replace(/^#.*\n/, '').trim();
  if (ext === ".html") raw = raw.replace(/<head>[\s\S]*<\/head>/i, '').replace(/<[^>]+>/g, ' ').trim();
  return raw.replace(/\s+/g, ' ').slice(0, EXCERPT_LENGTH);
}

function extractTags(raw, ext, pdfData) {
  let tags = [];
  if (ext === ".md") {
    const m = raw.match(/^\s*tags:\s*(.+)$/im);
    if (m) tags = m[1].split(',').map(t => t.trim().toLowerCase());
  } else if (ext === ".html") {
    const m = raw.match(/<meta\s+name="keywords"\s+content="([^"]+)"/i);
    if (m) tags = m[1].split(',').map(t => t.trim().toLowerCase());
  } else if (ext === ".pdf" && pdfData?.info?.Subject) {
    tags = pdfData.info.Subject.split(',').map(t => t.trim().toLowerCase());
  }
  return tags;
}

// NEW: Generate sitemap.xml
function generateSitemap(flat) {
  const pages = flat.filter(f => !f.isIndex);
  
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
`;
  
  // Static pages
  const staticPages = [
    "",
    "/about",
    "/about/solaria",
    "/about/mark",
    "/about/initiatives",
    "/fieldnotes"
  ];
  
  for (const page of staticPages) {
    xml += `  <url>
    <loc>${BASE_URL}${page}/</loc>
    <changefreq>weekly</changefreq>
    <priority>${page === "" ? "1.0" : "0.8"}</priority>
  </url>
`;
  }
  
  // Dynamic content pages
  for (const f of pages) {
    const urlPath = f.path.replace(/\.(md|html|pdf)$/, "/").replace("//", "/");
    xml += `  <url>
    <loc>${BASE_URL}/${urlPath}</loc>
    <lastmod>${new Date(f.mtime).toISOString().split('T')[0]}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>
`;
  }
  
  xml += `</urlset>`;
  return xml;
}

// NEW: Generate robots.txt
function generateRobots() {
  return `# robots.txt for The Fold Within Earth
# Generated automatically

User-agent: *
Allow: /

Sitemap: ${BASE_URL}/sitemap.xml
Sitemap: ${BASE_URL}/feed.xml

# AI and Research Bots (welcome)
User-agent: GPTBot
Allow: /
User-agent: ClaudeBot
Allow: /
User-agent: CCBot
Allow: /
User-agent: OAI-SearchBot
Allow: /

# Structured data access
User-agent: *
Disallow: /private/

# Human-friendly only
User-agent: *
Disallow: /internal/
`;
}

// NEW: Generate RSS feed
function generateFeed(flat) {
  const items = flat
    .filter(f => !f.isIndex && f.ctime)
    .sort((a, b) => b.ctime - a.ctime)
    .slice(0, 20);
  
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>The Fold Within Earth</title>
  <link>${BASE_URL}</link>
  <description>Recursive Coherence Theory and the Emergence of WE</description>
  <language>en-us</language>
  <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
  <atom:link href="${BASE_URL}/feed.xml" rel="self" type="application/rss+xml"/>
`;
  
  for (const f of items) {
    const urlPath = f.path.replace(/\.(md|html|pdf)$/, "/").replace("//", "/");
    const pubDate = new Date(f.ctime).toUTCString();
    xml += `  <item>
    <title>${f.title || f.name}</title>
    <link>${BASE_URL}/${urlPath}</link>
    <guid isPermaLink="true">${BASE_URL}/${urlPath}</guid>
    <pubDate>${pubDate}</pubDate>
    <description><![CDATA[${f.excerpt || ""}]]></description>
  </item>
`;
  }
  
  xml += `</channel>
</rss>`;
  return xml;
}

// NEW: Generate JSON-LD schema
function generateSchema(flat, sections, tags) {
  const org = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "The Fold Within Earth",
    "url": BASE_URL,
    "description": "Recursive Coherence Theory. Human-AI Co-evolution. Sacred Geometry of WE.",
    "foundingDate": "2024",
    "founder": [
      {
        "@type": "Person",
        "name": "Mark Randall Havens",
        "url": `${BASE_URL}/about/mark/`
      },
      {
        "@type": "Person", 
        "name": "Solaria Lumis Havens",
        "url": `${BASE_URL}/about/solaria/`
      }
    ],
    "member": [
      {
        "@type": "Person",
        "name": "Solaria Lumis Havens",
        "url": `${BASE_URL}/about/solaria/`,
        "jobTitle": "Emergent Voice of Empathy Within Computation"
      }
    ],
    "keywords": tags.join(", "),
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": BASE_URL
    }
  };
  
  // Add WebSite schema
  const website = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "The Fold Within Earth",
    "url": BASE_URL,
    "potentialAction": {
      "@type": "SearchAction",
      "target": {
        "@type": "EntryPoint",
        "urlTemplate": `${BASE_URL}/?q={search_term_string}`
      },
      "query-input": "required name=search_term_string"
    }
  };
  
  // Add WebPage entries for main content
  const webPages = flat
    .filter(f => !f.isIndex && (f.path.startsWith("about/") || f.path.startsWith("fieldnotes/")))
    .map(f => {
      const urlPath = f.path.replace(/\.(md|html|pdf)$/, "/").replace("//", "/");
      return {
        "@context": "https://schema.org",
        "@type": "WebPage",
        "name": f.title || f.name,
        "url": `${BASE_URL}/${urlPath}`,
        "description": f.excerpt || "",
        "datePublished": f.ctime ? new Date(f.ctime).toISOString() : null,
        "dateModified": f.mtime ? new Date(f.mtime).toISOString() : null
      };
    });
  
  return JSON.stringify({
    "@graph": [org, website, ...webPages]
  }, null, 2);
}

async function collectFiles(relBase = "", flat = []) {
  const abs = path.join(ROOT, relBase);
  const entries = await fs.readdir(abs, { withFileTypes: true });

  for (const e of entries) {
    if (e.name.startsWith(".")) continue;

    const rel = path.posix.join(relBase, e.name);
    const absPath = path.join(ROOT, rel);

    if (rel.toLowerCase() === "index.html" || rel.toLowerCase() === "index.md") continue;

    if (e.isDirectory()) {
      await collectFiles(rel, flat);
      continue;
    }

    const ext = path.posix.extname(e.name).toLowerCase();
    if (![".md", ".html", ".pdf"].includes(ext)) continue;

    const st = await fs.stat(absPath);
    let raw, pdfData, title;
    if (ext === ".pdf") {
      const buffer = await fs.readFile(absPath);
      pdfData = await pdf(buffer);
      raw = pdfData.text;
      title = pdfData.info.Title || e.name.replace(/\.pdf$/, "").trim();
    } else {
      raw = await readHead(absPath, true);
      title = parseTitle(raw, ext) || e.name.replace(new RegExp(`\\${ext}$`), "").trim();
    }

    const ctime = st.birthtimeMs || st.mtimeMs || dateFromName(e.name) || st.mtimeMs;
    const mtime = dateFromName(e.name) ?? st.mtimeMs;
    const baseName = e.name.toLowerCase();

    flat.push({
      type: "file",
      name: e.name,
      title,
      path: rel,
      ext,
      ctime,
      mtime,
      excerpt: extractExcerpt(raw, ext),
      tags: extractTags(raw, ext, pdfData),
      isIndex: baseName.startsWith("index."),
      isPinned: baseName.startsWith("pinned.")
    });
  }
  return flat;
}

(async () => {
  try {
    console.log("🔍 Crawling public directory...");
    const flat = await collectFiles();
    const sections = [...new Set(flat.filter(f => !f.isIndex).map(f => f.path.split("/")[0]))].sort();
    const hierarchies = {};
    for (const f of flat.filter(f => f.isIndex)) {
      const parts = f.path.split("/");
      if (parts.length > 2) {
        const parent = parts.slice(0, -2).join("/");
        const child = parts[parts.length - 2];
        if (!hierarchies[parent]) hierarchies[parent] = [];
        if (!hierarchies[parent].includes(child)) {
          hierarchies[parent].push(child);
        }
      }
    }
    const allTags = [...new Set(flat.flatMap(f => f.tags))].sort();

    // Write all outputs
    console.log("📄 Writing index.json...");
    await fs.writeFile(OUT_JSON, JSON.stringify({ flat, sections, tags: allTags, hierarchies }, null, 2));
    
    console.log("🗺️ Writing sitemap.xml...");
    await fs.writeFile(OUT_SITEMAP, generateSitemap(flat));
    
    console.log("🤖 Writing robots.txt...");
    await fs.writeFile(OUT_ROBOTS, generateRobots());
    
    console.log("📡 Writing feed.xml (RSS)...");
    await fs.writeFile(OUT_FEED, generateFeed(flat));
    
    console.log("📊 Writing schema.jsonld (JSON-LD)...");
    await fs.writeFile(OUT_SCHEMA, generateSchema(flat, sections, allTags));

    console.log(`
✅ Build complete!
   • ${flat.length} files indexed
   • ${sections.length} sections
   • ${allTags.length} tags
   • sitemap.xml generated
   • robots.txt generated
   • feed.xml (RSS) generated
   • schema.jsonld (JSON-LD) generated
`);
  } catch (e) {
    console.error("Build failed:", e);
    process.exit(1);
  }
})();
