// build.mjs — The Fold Within Earth
// Markdown-native static site builder with no external generator.

// ────────────────────────────────────────────────────────────────
// Imports
// ────────────────────────────────────────────────────────────────
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import yaml from "js-yaml";
import { marked } from "marked";

// ────────────────────────────────────────────────────────────────
// Setup
// ────────────────────────────────────────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = path.join(__dirname, "config.json");
const CONTENT_DIR = path.join(__dirname, "content");
const PUBLIC_DIR = path.join(__dirname, "public");

// ────────────────────────────────────────────────────────────────
// Config loader
// ────────────────────────────────────────────────────────────────
let config = {};
try {
  const cfgText = await fs.readFile(CONFIG_PATH, "utf8");
  config = JSON.parse(cfgText);
  console.log("Loaded config.json");
} catch {
  console.warn("config.json not found or invalid; using defaults.");
  config = {
    siteTitle: "The Fold Within Earth",
    baseUrl: "",
  };
}

// ────────────────────────────────────────────────────────────────
// Utilities
// ────────────────────────────────────────────────────────────────
async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const res = path.resolve(dir, entry.name);
      return entry.isDirectory() ? walk(res) : res;
    })
  );
  return Array.prototype.concat(...files);
}

function parseFrontMatter(text) {
  if (!text.startsWith("---")) return { meta: {}, body: text };
  const end = text.indexOf("---", 3);
  if (end === -1) return { meta: {}, body: text };
  const yamlText = text.slice(3, end).trim();
  const body = text.slice(end + 3).trim();
  let meta = {};
  try {
    meta = yaml.load(yamlText) || {};
  } catch (err) {
    console.error("YAML parse error:", err);
  }
  return { meta, body };
}

// ────────────────────────────────────────────────────────────────
// Build Posts
// ────────────────────────────────────────────────────────────────
async function buildPosts() {
  const mdFiles = (await walk(CONTENT_DIR)).filter((f) => f.endsWith(".md"));
  console.log(`Found ${mdFiles.length} markdown files.`);

  const postsPromises = mdFiles.map(async (file) => {
    try {
      const text = await fs.readFile(file, "utf8");
      const { meta, body } = parseFrontMatter(text);
      if (meta.status === "draft") return null;

      const html = marked.parse(body);
      const slug =
        meta.slug ||
        path.basename(file, ".md").replace(/\s+/g, "-").toLowerCase();

      const relPath = path.relative(CONTENT_DIR, file);
      const section = relPath.split(path.sep)[0] || "general";

      return {
        title: meta.title || slug,
        date: meta.date || new Date().toISOString().slice(0, 10),
        excerpt: meta.excerpt || body.slice(0, 200),
        tags: meta.tags || [],
        section,
        slug,
        cover: meta.cover || "",
        html,
      };
    } catch (err) {
      console.error(`Error reading ${file}:`, err);
      return null;
    }
  });

  const postObjects = await Promise.all(postsPromises);
  const posts = postObjects.filter(Boolean);
  posts.sort((a, b) => b.date.localeCompare(a.date));
  console.log(`Processed ${posts.length} posts.`);
  return posts;
}

// ────────────────────────────────────────────────────────────────
// Copy Helpers
// ────────────────────────────────────────────────────────────────
async function copyDir(src, dest) {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) await copyDir(srcPath, destPath);
    else await fs.copyFile(srcPath, destPath);
  }
}

// ────────────────────────────────────────────────────────────────
// Main Build
// ────────────────────────────────────────────────────────────────
async function main() {
  const posts = await buildPosts();

  // Reset public dir
  await fs.rm(PUBLIC_DIR, { recursive: true, force: true });
  await fs.mkdir(PUBLIC_DIR, { recursive: true });

  // Copy static assets
  const staticFiles = [
    "index.html",
    "styles.css",
    "app.js",
    "render.js",
    "sanitize.js",
    "util.js",
    "mud.js",
  ];

  for (const f of staticFiles) {
    try {
      await fs.copyFile(path.join(__dirname, f), path.join(PUBLIC_DIR, f));
    } catch {
      console.warn(`⚠️ Skipped missing static file: ${f}`);
    }
  }

  // Copy content for direct linking
  await copyDir(CONTENT_DIR, path.join(PUBLIC_DIR, "content"));

  // Write index.json
  await fs.writeFile(
    path.join(PUBLIC_DIR, "index.json"),
    JSON.stringify(posts, null, 2),
    "utf8"
  );

  // Write search.json
  const searchData = posts.map((p) => ({
    title: p.title,
    excerpt: p.excerpt,
    tags: p.tags.join(" "),
    section: p.section,
    slug: p.slug,
  }));
  await fs.writeFile(
    path.join(PUBLIC_DIR, "search.json"),
    JSON.stringify(searchData, null, 2),
    "utf8"
  );

  console.log("✅ Build complete. Files written to /public.");
}

// ────────────────────────────────────────────────────────────────
await main().catch((err) => {
  console.error("Build failed:", err);
  process.exit(1);
});
