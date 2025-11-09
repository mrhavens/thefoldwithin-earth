#!/usr/bin/env node
import { promises as fs } from "fs";
import path from "path";
import pdf from "pdf-parse";

const ROOT = "public";
const OUT = path.join(ROOT, "index.json");
const EXCERPT_LENGTH = 400;

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

async function collectFiles(relBase = "", flat = []) {
  const abs = path.join(ROOT, relBase);
  const entries = await fs.readdir(abs, { withFileTypes: true });

  for (const e of entries) {
    if (e.name.startsWith(".")) continue;
    const rel = path.posix.join(relBase, e.name);
    const absPath = path.join(ROOT, rel);
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

    const mtime = dateFromName(e.name) ?? st.mtimeMs;
    const baseName = e.name.slice(0, e.name.lastIndexOf('.')).toLowerCase();

    flat.push({
      type: "file",
      name: e.name,
      title,
      path: rel,
      ext,
      mtime,
      excerpt: extractExcerpt(raw, ext),
      tags: extractTags(raw, ext, pdfData),
      isIndex: baseName === "index",
      isPinned: baseName === "pinned"
    });
  }
  return flat;
}

(async () => {
  try {
    const flat = await collectFiles();
    // Only include sections with non-index files
    const sections = [...new Set(flat.filter(f => !f.isIndex).map(f => f.path.split("/")[0]))].sort();
    const allTags = [...new Set(flat.flatMap(f => f.tags))].sort();
    await fs.writeFile(OUT, JSON.stringify({ flat, sections, tags: allTags }, null, 2));
    console.log(`index.json built: ${flat.length} files, ${sections.length} sections, ${allTags.length} tags.`);
  } catch (e) {
    console.error("Build failed:", e);
    process.exit(1);
  }
})();