/**
 * generate-index.mjs (v2.0.0)
 * Scans /public/{pinned,posts} for .html/.md files, emits public/index.json
 * Deterministic, POSIX paths, reverse-chron default ordering handled client-side.
 */

import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.resolve(__dirname, "../public");
const ROOTS = ["pinned", "posts"];
const ALLOWED = new Set([".html", ".md"]);
const MAX_TITLE_BYTES = 64 * 1024;

const posix = path.posix;

async function statSafe(p) { try { return await fs.stat(p); } catch { return null; } }
function isHidden(rel) { return /(^|\/)\./.test(rel); } // hide dotfiles/dirs
function toPosix(rel) { return rel.split(path.sep).join("/"); }

async function readFirstChunk(abs) {
  const fh = await fs.open(abs, "r");
  const { size } = await fh.stat();
  const len = Math.min(MAX_TITLE_BYTES, size);
  const buf = Buffer.alloc(len);
  await fh.read(buf, 0, len, 0);
  await fh.close();
  return buf.toString("utf8");
}

function parseTitleFromHTML(raw) {
  const m = raw.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? m[1].trim() : null;
}

function parseTitleFromMD(raw) {
  const m = raw.match(/^\s*#\s+(.+)\s*$/m);
  return m ? m[1].trim() : null;
}

async function walkDir(absRoot, relRoot) {
  const st = await statSafe(absRoot);
  const node = {
    type: "dir",
    name: path.basename(absRoot),
    path: "/" + toPosix(relRoot),
    mtime: st ? st.mtimeMs : 0,
    children: []
  };
  if (!st?.isDirectory()) return node;

  const entries = await fs.readdir(absRoot, { withFileTypes: true });
  entries.sort((a, b) => a.name.localeCompare(b.name));

  for (const e of entries) {
    const abs = path.join(absRoot, e.name);
    const rel = toPosix(path.join(relRoot, e.name));
    if (isHidden(rel)) continue;

    if (e.isDirectory()) {
      node.children.push(await walkDir(abs, rel));
    } else {
      const ext = path.extname(e.name).toLowerCase();
      if (!ALLOWED.has(ext)) continue;
      const stFile = await statSafe(abs);
      const raw = await readFirstChunk(abs);
      let title = (ext === ".html") ? parseTitleFromHTML(raw) : parseTitleFromMD(raw);
      title = title || e.name;

      node.children.push({
        type: "file",
        name: e.name,
        ext,
        title,
        path: "/" + rel,
        mtime: stFile ? stFile.mtimeMs : 0,
        size: stFile ? stFile.size : 0,
        pinned: rel.startsWith("pinned/")
      });
    }
  }

  return node;
}

function flatten(node, out = []) {
  if (node.type === "file") { out.push(node); return out; }
  for (const c of node.children || []) flatten(c, out);
  return out;
}

async function main() {
  const index = {
    generatedAt: new Date().toISOString(),
    tree: { type: "dir", name: "/", path: "/", mtime: Date.now(), children: [] },
    flat: []
  };

  for (const root of ROOTS) {
    const abs = path.join(PUBLIC_DIR, root);
    const st = await statSafe(abs);
    if (!st?.isDirectory()) {
      console.warn(`warning: /public/${root} missing — skipping`);
      continue;
    }
    const node = await walkDir(abs, root);
    node.name = root;
    node.path = "/" + root;
    index.tree.children.push(node);
  }

  // Flatten in the order roots were added
  for (const child of index.tree.children) flatten(child, index.flat);

  const outPath = path.join(PUBLIC_DIR, "index.json");
  await fs.writeFile(outPath, JSON.stringify(index, null, 2));
  console.log(`wrote ${posix.relative(PUBLIC_DIR, outPath)} with ${index.flat.length} files.`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});