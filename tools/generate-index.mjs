#!/usr/bin/env node
import { promises as fs } from "fs";
import path from "path";
import pdf from "pdf-parse";

const ROOT = "public";
const OUT = path.join(ROOT, "index.json");
const STATIC_TOPLEVEL = new Set(["about", "contact", "legal"]);
const MAX_BYTES = 64 * 1024;

function dateFromName(name) {
  const m = name.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? new Date(m[0]).getTime() : null;
}

async function readHead(abs) {
  const fh = await fs.open(abs, "r");
  const buf = Buffer.alloc(MAX_BYTES);
  const { bytesRead } = await fh.read(buf, 0, MAX_BYTES, 0);
  await fh.close();
  return buf.slice(0, bytesRead).toString("utf8");
}

function parseTitle(raw, ext) {
  if (ext === ".md") return raw.match(/^\s*#\s+(.+?)\s*$/m)?.[1].trim();
  if (ext === ".html") return raw.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1].trim();
  return null;
}

async function collectFiles(relBase = "", flat = []) {
  const abs = path.join(ROOT, relBase);
  const entries = await fs.readdir(abs, { withFileTypes: true });

  for (const e of entries) {
    if (e.name.startsWith(".")) continue;
    const rel = path.posix.join(relBase, e.name);
    const absPath = path.join(ROOT, rel);
    if (e.isDirectory()) {
      const top = rel.split("/")[0];
      if (STATIC_TOPLEVEL.has(top)) continue;
      await collectFiles(rel, flat);
      continue;
    }

    const ext = path.posix.extname(e.name).toLowerCase();
    if (![".md", ".html", ".pdf"].includes(ext)) continue;
    const st = await fs.stat(absPath);
    let title;
    if (ext === ".pdf") {
      const buffer = await fs.readFile(absPath);
      const pdfData = await pdf(buffer);
      title = pdfData.info.Title || e.name.replace(/\.pdf$/, "").trim();
    } else {
      const raw = await readHead(absPath);
      title = parseTitle(raw, ext) || e.name.replace(new RegExp(`\\${ext}$`), "").trim();
    }
    const mtime = dateFromName(e.name) ?? st.mtimeMs;

    flat.push({
      type: "file",
      name: e.name,
      title,
      path: rel,
      ext,
      pinned: rel.startsWith("pinned/"),
      mtime
    });
  }
  return flat;
}

(async () => {
  try {
    const flat = await collectFiles();
    const sections = [...new Set(flat.map(f => f.path.split("/")[0]))];
    await fs.writeFile(OUT, JSON.stringify({ flat, sections }, null, 2));
    console.log(`index.json built with ${flat.length} files across ${sections.length} sections.`);
  } catch (e) {
    console.error("Build failed:", e);
    process.exit(1);
  }
})();