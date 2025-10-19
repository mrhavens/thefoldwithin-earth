import fs from 'fs/promises';
import path from 'path';
import matter from 'gray-matter';
import yaml from 'js-yaml';
import md from 'markdown-it';
import sanitizer from 'markdown-it-sanitizer';
import crypto from 'crypto';
import nacl from 'tweetnacl';
import { validate, detectCycles } from './foldlint.js';

const mdParser = md().use(sanitizer);

// Collect files async, deterministic sort
async function collectFiles(dir) {
  let files = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  entries.sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files = [...files, ...(await collectFiles(fullPath))];
    } else if (entry.name.endsWith('.md')) {
      files.push(fullPath);
    }
  }
  return files;
}

// Generate HTML
function generateHTML(meta, bodyHtml, exits) {
  return `
<!DOCTYPE html>
<html>
<head>
  <title>${meta.title}</title>
  <link rel="stylesheet" href="/styles.css">
  <script src="/witness.js"></script>
  <meta name="description" content="${meta.summary}">
</head>
<body>
  <div class="room">
    <h1>${meta.title}</h1>
    ${bodyHtml}
    <div class="exits">
      ${exits.map(exit => `<a href="/${exit.to.replace(':', '_').split('@')[0]}.html">${exit.label}</a>`).join('')}
    </div>
    <div id="chat"></div>
    <input id="msg"><button id="send">Send</button>
  </div>
  <script>witness.connect('${meta.id}');</script>
</body>
</html>
  `;
}

// Canonical hash (exclude id from frontmatter)
function canonicalHash(meta, body) {
  const metaClone = { ...meta };
  delete metaClone.id; // Exclude id to avoid circularity
  const frontYaml = yaml.dump(metaClone, { noRefs: true }).trim();
  const content = frontYaml + '\n' + body.trim();
  const lines = content.split('\n');
  const trimmedLines = lines.map(line => line.replace(/\s+$/, ''));
  const normalized = trimmedLines.join('\n');
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

// Build
async function build() {
  const atlasDir = path.join(process.cwd(), 'atlas');
  const distDir = path.join(process.cwd(), 'dist');
  await fs.mkdir(distDir, { recursive: true });

  const files = await collectFiles(atlasDir);

  // Validate all
  for (const file of files) {
    await validate(file);
    console.log(`Validated: ${file}`);
  }

  // Build graph
  const graph = {};
  const idToFile = {};
  const slugToId = {};
  for (const file of files) {
    const content = await fs.readFile(file, 'utf8');
    const { data: meta } = matter(content);
    graph[meta.id] = meta.exits ? meta.exits.map(e => e.to) : [];
    idToFile[meta.id] = file;
    slugToId[meta.id.split('@')[0]] = meta.id; // Map kind:slug to full id
  }

  // Check broken links and cycles
  Object.keys(graph).forEach(id => {
    graph[id].forEach(to => {
      let resolvedTo = to;
      if (!graph[to] && slugToId[to]) {
        resolvedTo = slugToId[to]; // Resolve kind:slug to full id
      }
      if (!graph[resolvedTo]) {
        console.error(`Available IDs: ${Object.keys(graph).join(', ')}`);
        throw new Error(`Broken link: ${to} from ${id}`);
      }
    });
  });
  detectCycles(graph); // Throws if cycle

  // Generate HTML
  const buildManifest = { files: [] };
  for (const file of files) {
    const content = await fs.readFile(file, 'utf8');
    const { data: meta, content: body } = matter(content);

    // Hash verify
    const computed = canonicalHash(meta, body);
    const idHash = meta.id.split('@sha256:')[1];
    if (computed !== idHash) throw new Error(`Hash mismatch in ${file}: computed=${computed}, expected=${idHash}`);

    const bodyHtml = mdParser.render(body);
    const html = generateHTML(meta, bodyHtml, meta.exits || []);

    const slug = meta.id.split(':')[1].split('@')[0];
    const outPath = path.join(distDir, `${slug}.html`);
    await fs.writeFile(outPath, html);
    buildManifest.files.push({ path: outPath, hash: crypto.createHash('sha256').update(html).digest('hex') });
  }

  // Copy public
  await fs.cp(path.join(process.cwd(), 'public'), distDir, { recursive: true });

  // Sitemap stub
  await fs.writeFile(path.join(distDir, 'sitemap.xml'), '<xml>Stub</xml>');

  // Write build manifest
  await fs.writeFile(path.join(distDir, 'manifest.json'), JSON.stringify(buildManifest));

  console.log('Build complete.');
}

build().catch(console.error);
