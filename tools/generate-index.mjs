import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.resolve(__dirname, "../public");
const ROOTS = ["pinned", "posts"];
const exts = [".html", ".md"];

async function walk(dir, base) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const nodes = [];
  for (const e of entries) {
    if (e.name.startsWith(".")) continue;
    const abs = path.join(dir, e.name);
    const rel = path.posix.join(base, e.name);
    const st = await fs.stat(abs);

    if (e.isDirectory()) {
      const children = await walk(abs, rel);
      nodes.push({ type: "dir", name: e.name, path: rel, children });
    } else {
      const ext = path.extname(e.name);
      if (!exts.includes(ext)) continue;
      nodes.push({
        type: "file",
        name: e.name,
        path: rel,
        ext,
        pinned: base.startsWith("pinned"),
        mtime: st.mtimeMs
      });
    }
  }
  return nodes;
}

async function buildIndex() {
  const tree = [];
  const flat = [];

  for (const root of ROOTS) {
    const abs = path.join(PUBLIC, root);
    try {
      const children = await walk(abs, root);
      const node = { type: "dir", name: root, path: root, children };
      tree.push(node);
      for (const c of children) flatten(c, flat);
    } catch {
      console.warn(`Skipping missing ${root}/`);
    }
  }

  const data = { generatedAt: Date.now(), tree, flat };
  await fs.writeFile(path.join(PUBLIC, "index.json"), JSON.stringify(data, null, 2));
  console.log("✅ index.json generated:", flat.length, "files.");
}

function flatten(node, arr) {
  if (node.type === "file") arr.push(node);
  else node.children.forEach(c => flatten(c, arr));
}

await buildIndex();