#!/usr/bin/env node
import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../public");
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
  if (ext === ".md") return raw.match(/^\s*#\s+(.+?)\s*$/m)?.[1]?.trim();
  if (ext === ".html")
    return raw.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim();
  return null;
}

async function walk(relBase = "") {
  const abs = path.join(ROOT, relBase);
  const entries = await fs.readdir(abs, { withFileTypes: true });
  const dir = {
    type: "dir",
    name: path.posix.basename(relBase) || "",
    path: relBase,
    children: [],
  };

  for (const e of entries) {
    if (e.name.startsWith(".")) continue; // skip hidden
    const rel = path.posix.join(relBase, e.name);
    const absPath = path.join(ROOT, rel);

    if (e.isDirectory()) {
      const top = rel.split("/")[0];
      if (STATIC_TOPLEVEL.has(top)) continue;
      dir.children.push(await walk(rel));
      continue;
    }

    const ext = path.posix.extname(e.name).toLowerCase();
    if (![".md", ".html"].includes(ext)) continue;

    const st = await fs.stat(absPath);
    let title = e.name;
    try {
      const raw = await readHead(absPath);
      title = parseTitle(raw, ext) || e.name;
    } catch {
      /* ignore parse errors */
    }

    const mtime = dateFromName(e.name) ?? st.mtimeMs;
    dir.children.push({
      type: "file",
      name: e.name,
      title,
      path: rel,
      ext,
      pinned: rel.startsWith("pinned/"),
      mtime,
    });
  }

  // sort newest first by mtime
  dir.children.sort((a, b) => (b.mtime ?? 0) - (a.mtime ?? 0));
  return dir;
}

(async () => {
  try {
    const tree = await walk();
    const flat = [];
    (function flatten(n) {
      for (const c of n.children) {
        if (c.type === "file") flat.push(c);
        else flatten(c);
      }
    })(tree);
    const sections = [...new Set(flat.map((f) => f.path.split("/")[0]))];
    await fs.writeFile(
      OUT,
      JSON.stringify({ tree: tree.children, flat, sections }, null, 2)
    );
    console.log(
      `✅ index.json built with ${flat.length} files across ${sections.length} sections.`
    );
  } catch (e) {
    console.error("❌ Build failed:", e);
    process.exit(1);
  }
})();