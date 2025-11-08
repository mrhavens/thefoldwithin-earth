import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.resolve(__dirname, "../public");
const ROOTS  = ["pinned","posts"];
const ALLOWED = new Set([".md",".html"]);
const MAX_BYTES = 64 * 1024; // read head for title parse

// --- helpers ------------------------------------------------------
async function statSafe(p){ try{ return await fs.stat(p); }catch{ return null; } }

function posixJoin(...xs){ return path.posix.join(...xs); }

function dateFromName(name){
  const m = name.match(/^(\d{4}-\d{2}-\d{2})/);
  if (!m) return null;
  const d = new Date(m[1]); const t = d.getTime();
  return Number.isFinite(t) ? t : null;
}

async function readHead(abs){
  const fh = await fs.open(abs,"r");
  const buf = Buffer.alloc(MAX_BYTES);
  const { bytesRead } = await fh.read(buf, 0, MAX_BYTES, 0);
  await fh.close();
  return buf.slice(0, bytesRead).toString("utf8");
}

function parseTitle(raw, ext){
  if (ext===".md"){
    const m = raw.match(/^\s*#\s+(.+?)\s*$/m);
    if (m) return m[1].trim();
  } else if (ext===".html"){
    const m = raw.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (m) return m[1].trim();
  }
  return null;
}

// --- walker -------------------------------------------------------
async function walk(absDir, relBase){
  const out = [];
  const ents = await fs.readdir(absDir, { withFileTypes: true });
  for (const e of ents){
    if (e.name.startsWith(".")) continue;
    const abs = path.join(absDir, e.name);
    const rel = posixJoin(relBase, e.name);
    const st = await fs.stat(abs);

    if (e.isDirectory()){
      const children = await walk(abs, rel);
      out.push({ type:"dir", name:e.name, path:rel, children });
    } else {
      const ext = path.extname(e.name);
      if (!ALLOWED.has(ext)) continue;

      const raw = await readHead(abs);
      const title = parseTitle(raw, ext) || e.name;
      const dated = dateFromName(e.name);
      out.push({
        type:"file",
        name:e.name,
        title,
        path:rel,
        ext,
        pinned: relBase.startsWith("pinned"),
        mtime: dated ?? st.mtimeMs
      });
    }
  }
  return out;
}

function flatten(node, list){
  if (node.type==="file") list.push(node);
  else node.children.forEach(c=>flatten(c,list));
}

// --- build --------------------------------------------------------
async function build(){
  const tree = [];
  const flat = [];

  for (const root of ROOTS){
    const abs = path.join(PUBLIC, root);
    const st = await statSafe(abs);
    if (!st?.isDirectory()){
      console.warn(`Warning: skipping missing ${root}/`);
      continue;
    }
    const children = await walk(abs, root);
    const dirNode = { type:"dir", name:root, path:root, children };
    tree.push(dirNode);
    flatten(dirNode, flat);
  }

  const data = { generatedAt: Date.now(), tree, flat };
  const outPath = path.join(PUBLIC, "index.json");
  await fs.writeFile(outPath, JSON.stringify(data, null, 2));
  console.log(`✅ index.json generated (${flat.length} files)`);
}

await build();