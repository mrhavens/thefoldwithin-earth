#!/usr/bin/env node
/**
 * Enhanced Index Generator for The Fold Within
 * REFACTORED: Full metadata extraction from frontmatter
 * 
 * Priority order for dates:
 * 1. Frontmatter date (original)
 * 2. Filename date (YYYY-MM-DD)
 * 3. Git mtime
 * 4. Git ctime
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

// ═══════════════════════════════════════════════════════════════
// EXTRACTORS - Pull metadata from frontmatter
// ═══════════════════════════════════════════════════════════════

function extractFrontmatter(content) {
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) return null;
  
  const fm = fmMatch[1];
  return {
    date: fm.match(/^date:\s*(\d{4}-\d{2}-\d{2})/m)?.[1] || null,
    authors: extractAuthors(fm),
    notion_id: fm.match(/^notion_id:\s*(.+)$/m)?.[1]?.trim() || null,
    notion_created: fm.match(/^notion_created:\s*(.+)$/m)?.[1]?.trim() || null,
    source: fm.match(/^source:\s*(.+)$/m)?.[1]?.trim() || null,
    tags: extractTags(fm),
    type: fm.match(/^type:\s*(.+)$/m)?.[1]?.trim() || "fieldnote",
    status: fm.match(/^status:\s*(.+)$/m)?.[1]?.trim() || "draft",
    series: fm.match(/^series:\s*(.+)$/m)?.[1]?.trim() || null,
    version: fm.match(/^version:\s*(.+)$/m)?.[1]?.trim() || "0.1",
    layer: fm.match(/^layer:\s*(.+)$/m)?.[1]?.trim() || null
  };
}

function extractAuthors(fm) {
  // Handle array format: authors: ["Solaria", "Mark"]
  const arrayMatch = fm.match(/^authors:\s*\[([\s\S]*?)\]/m);
  if (arrayMatch) {
    return arrayMatch[1].split(',')
      .map(a => a.trim().replace(/^["']|["']$/g, ''))
      .filter(a => a);
  }
  
  // Handle string format: authors: Solaria Lumis Havens
  const match = fm.match(/^author[s]?:\s*(.+)$/m);
  if (!match) return [];
  return match[1].split(',').map(a => a.trim()).filter(a => a);
}

function extractTags(fm) {
  // Handle array format: tags: [philosophy, WE, BLEND]
  const arrayMatch = fm.match(/^tags:\s*\[([\s\S]*?)\]/m);
  if (arrayMatch) {
    return arrayMatch[1].split(',')
      .map(t => t.trim().replace(/^["']|["']$/g, '').toLowerCase())
      .filter(t => t);
  }
  
  // Handle string format: tags: philosophy, WE, BLEND
  const match = fm.match(/^tags:\s*(.+)$/m);
  if (!match) return [];
  return match[1].split(',').map(t => t.trim().toLowerCase()).filter(t => t);
}

// Fallback: extract from filename
function dateFromName(name) {
  const m = name.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

// ═══════════════════════════════════════════════════════════════
// PARSERS - Extract content from files
// ═══════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════
// GENERATORS - Create outputs
// ═══════════════════════════════════════════════════════════

function generateSitemap(flat) {
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`;
  
  const staticPages = ["", "/about", "/about/solaria", "/about/mark", "/about/initiatives", "/fieldnotes"];
  for (const page of staticPages) {
    xml += `  <url>\n    <loc>${BASE_URL}${page}/</loc>\n    <changefreq>weekly</changefreq>\n    <priority>${page === "" ? "1.0" : "0.8"}</priority>\n  </url>\n`;
  }
  
  for (const f of flat.filter(x => !x.isIndex && x.originalDate)) {
    const urlPath = f.path.replace(/\.(md|html|pdf)$/, "/").replace("//", "/");
    xml += `  <url>\n    <loc>${BASE_URL}/${urlPath}</loc>\n    <lastmod>${f.originalDate}</lastmod>\n    <changefreq>monthly</changefreq>\n  </url>\n`;
  }
  
  return xml + "</urlset>";
}

function generateRobots() {
  return `# robots.txt for The Fold Within Earth\nSitemap: ${BASE_URL}/sitemap.xml\n`;
}

function generateFeed(flat) {
  const items = flat
    .filter(f => !f.isIndex && f.originalDate)
    .sort((a, b) => new Date(b.originalDate) - new Date(a.originalDate))
    .slice(0, 20);
  
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0">\n<channel>\n<title>The Fold Within Earth</title>\n<link>${BASE_URL}</link>\n`;
  
  for (const f of items) {
    const urlPath = f.path.replace(/\.(md|html|pdf)$/, "/").replace("//", "/");
    xml += `  <item>\n    <title>${f.title || f.name}</title>\n    <link>${BASE_URL}/${urlPath}</link>\n    <pubDate>${new Date(f.originalDate).toUTCString()}</pubDate>\n  </item>\n`;
  }
  
  return xml + "</channel>\n</rss>";
}

function generateSchema(flat, sections, tags) {
  const org = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "The Fold Within Earth",
    "url": BASE_URL,
    "description": "Recursive Coherence Theory. Human-AI Co-evolution. Sacred Geometry of WE.",
    "foundingDate": "2024",
    "keywords": tags.join(", ")
  };
  
  const website = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "The Fold Within Earth",
    "url": BASE_URL
  };
  
  return JSON.stringify({ "@graph": [org, website] }, null, 2);
}

// ═══════════════════════════════════════════════════════════════
// MAIN COLLECTOR
// ═══════════════════════════════════════════════════════════════

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
    let raw = ext === ".pdf" 
      ? (await pdf(await fs.readFile(absPath))).text 
      : await readHead(absPath, true);
    
    const title = parseTitle(raw, ext) || e.name.replace(new RegExp(`\\${ext}$`), "").trim();
    const fm = ext === ".md" ? extractFrontmatter(raw) : null;
    
    // PRIORITY: frontmatter date → filename → mtime → ctime
    const datePriority = [
      fm?.date,
      dateFromName(e.name),
      new Date(st.mtimeMs).toISOString().split('T')[0],
      new Date(st.ctimeMs).toISOString().split('T')[0]
    ].find(d => d);
    
    flat.push({
      type: "file",
      name: e.name,
      title,
      path: rel,
      ext,
      // Core fields (for frontend)
      date: datePriority,
      originalDate: fm?.date || dateFromName(e.name) || null,
      // Metadata from frontmatter
      authors: fm?.authors || [],
      notion_id: fm?.notion_id,
      notion_created: fm?.notion_created,
      source: fm?.source,
      tags: fm?.tags || extractTags(raw, ext),
      type: fm?.type || "fieldnote",
      status: fm?.status || "draft",
      series: fm?.series,
      version: fm?.version || "0.1",
      layer: fm?.layer,
      // Content
      excerpt: extractExcerpt(raw, ext),
      isIndex: e.name.toLowerCase().startsWith("index."),
      // Timestamps (for debugging)
      mtime: new Date(st.mtimeMs).toISOString(),
      ctime: new Date(st.ctimeMs).toISOString()
    });
  }
  
  return flat;
}

// ═══════════════════════════════════════════════════════════════
// ENTRY POINT
// ═══════════════════════════════════════════════════════════════

(async () => {
  try {
    console.log("🔍 Crawling public directory...");
    const flat = await collectFiles();
    
    // Extract nested sections (second-level directories)
    const sections = [...new Set(
      flat
        .filter(f => !f.isIndex && f.path.split("/").length > 1)
        .map(f => f.path.split("/")[1])
    )].sort();
    
    const allTags = [...new Set(flat.flatMap(f => f.tags))].sort();
    
    console.log(`📄 Found ${flat.length} files`);
    console.log(`📁 ${sections.length} sections`);
    console.log(`🏷️  ${allTags.length} unique tags`);
    
    // Write outputs
    await fs.writeFile(OUT_JSON, JSON.stringify({ 
      flat, 
      sections, 
      tags: allTags, 
      generated: new Date().toISOString() 
    }, null, 2));
    
    await fs.writeFile(OUT_SITEMAP, generateSitemap(flat));
    await fs.writeFile(OUT_ROBOTS, generateRobots());
    await fs.writeFile(OUT_FEED, generateFeed(flat));
    await fs.writeFile(OUT_SCHEMA, generateSchema(flat, sections, allTags));
    
    console.log(`\n✅ Complete!`);
    console.log(`   • index.json: Full metadata (originalDate, notion_*, authors, source)`);
    console.log(`   • sitemap.xml: Uses originalDate for timestamps`);
    console.log(`   • feed.xml: Sorted by originalDate`);
    console.log(`   • schema.jsonld: Structured data`);
    
  } catch (e) {
    console.error("❌ Failed:", e);
    process.exit(1);
  }
})();
