#!/usr/bin/env node
import { promises as fs } from "fs";
import path from "path";
import pdf from "pdf-parse";

const ROOT = "public";
const OUT = path.join(ROOT, "index.json");
const EXCERPT_LENGTH = 500;
const MAX_HEAD_BYTES = 64 * 1024;

function dateFromName(name) {
  const m = name.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? new Date(m[0]).getTime() : null;
}

async function readHead(abs, fullForExcerpt = false) {
  const fh = await fs.open(abs, "r");
  const bufSize = fullForExcerpt ? await fs.stat(abs).then(st => Math.min(st.size, EXCERPT_LENGTH * 2)) : MAX_HEAD_BYTES;
  const buf = Buffer.alloc(bufSize);
  const { bytesRead } = await fh.read(buf, 0, bufSize, 0);
  await fh.close();
  return buf.slice(0, bytesRead).toString("utf8");
}

function parseTitle(raw, ext) {
  if (ext === ".md") return raw.match(/^\s*#\s+(.+?)\s*$/m)?.[1].trim();
  if (ext === ".html") return raw.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1].trim();
  return null;
}

function extractExcerpt(raw, ext) {
  // Trim headers/metadata for cleaner excerpts
  if (ext === ".md") raw = raw.replace(/^#.*\n?/, '').trim();
  if (ext === ".html") raw = raw.replace(/<head>.*<\/head>/is, '').replace(/<[^>]+>/g, ' ').trim();
  return raw.replace(/\s+/g, ' ').slice(0, EXCERPT_LENGTH);
}

function extractTags(raw, ext, pdfData = null) {
  let tags = [];
  if (ext === ".md") {
    const match = raw.match(/^\s*tags:\s*(.+)$/im);
    if (match) tags = match[1].split(',').map(t => t.trim().toLowerCase());
  } else if (ext === ".html") {
    const match = raw.match(/<meta\s+name="keywords"\s+content="([^"]+)"/i);
    if (match) tags = match[1].split(',').map(t => t.trim().toLowerCase());
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
    if (![".md", ".html", ".pdf"].includes(ext) || e.name === "index.html") continue;
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
    const excerpt = extractExcerpt(raw, ext);
    const tags = extractTags(raw, ext, pdfData);

    flat.push({
      type: "file",
      name: e.name,
      title,
      path: rel,
      ext,
      pinned: rel.startsWith("pinned/"),
      mtime,
      excerpt,
      tags
    });
  }
  return flat;
}

async function detectSections() {
  const topEntries = await fs.readdir(ROOT, { withFileTypes: true });
  const sections = [];
  for (const e of topEntries) {
    if (!e.isDirectory() || e.name.startsWith(".")) continue;
    const indexPath = path.join(ROOT, e.name, "index.html");
    let isStatic = false;
    try {
      await fs.access(indexPath);
      isStatic = true;
    } catch {}
    // Check if dynamic (has content files) - but since flat collects them, infer from flat later
    sections.push({ name: e.name, isStatic });
  }
  return sections.sort((a, b) => a.name.localeCompare(b.name)); // Alpha sort
}

(async () => {
  try {
    const flat = await collectFiles();
    const sections = await detectSections();
    // Filter sections to those with content or static
    const activeSections = sections.filter(s => s.isStatic || flat.some(f => f.path.split("/")[0] === s.name));
    const allTags = [...new Set(flat.flatMap(f => f.tags))].sort();
    await fs.writeFile(OUT, JSON.stringify({ flat, sections: activeSections, tags: allTags }, null, 2));
    console.log(`index.json built: ${flat.length} files, ${activeSections.length} sections (${activeSections.filter(s => s.isStatic).length} static), ${allTags.length} tags.`);
  } catch (e) {
    console.error("Build failed:", e);
    process.exit(1);
  }
})();