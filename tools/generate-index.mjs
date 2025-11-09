// ΔFIELD: Node.js script to generate public/index.json from filesystem.
// Rationale: Async fs for efficiency; walks public/ excluding tools/ and index.json.
// Dependencies: fs/promises, path, gray-matter (for frontmatter parsing).
// Install: npm install gray-matter
// Usage: node tools/generate-index.mjs

import fs from 'fs/promises';
import path from 'path';
import matter from 'gray-matter';

const PUBLIC_DIR = path.join(process.cwd(), 'public');
const EXCLUDE_DIRS = ['tools'];
const INDEX_FILE = 'index.json';
const EXCERPT_LENGTH = 200;

// ΔRECURSION: Walk directory recursively, collect file metadata.
async function walk(dir, base = '') {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  let files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relPath = path.join(base, entry.name);
    if (entry.isDirectory()) {
      if (!EXCLUDE_DIRS.includes(entry.name)) {
        files = [...files, ...(await walk(fullPath, relPath))];
      }
    } else if (['.md', '.html'].includes(path.extname(entry.name))) {
      const stats = await fs.stat(fullPath);
      const content = await fs.readFile(fullPath, 'utf-8');
      const { data: frontmatter, content: body } = matter(content);
      const title = frontmatter.title || extractTitle(body) || entry.name.replace(/\.[^/.]+$/, '');
      const excerpt = extractExcerpt(body).slice(0, EXCERPT_LENGTH) + '...';
      const tags = frontmatter.tags || [];
      const isPinned = !!frontmatter.pinned;
      const isIndex = entry.name.startsWith('index.');
      files.push({
        path: relPath.replace(/\\/g, '/'), // Normalize to /
        title,
        tags,
        isIndex,
        isPinned,
        ctime: stats.birthtimeMs,
        mtime: stats.mtimeMs,
        ext: path.extname(entry.name),
        excerpt
      });
    }
  }
  return files;
}

// ΔTRUTH: Extract title from first # in MD or <title>/<h1> in HTML.
function extractTitle(content) {
  const mdMatch = content.match(/^#+\s*(.+)/m);
  if (mdMatch) return mdMatch[1].trim();
  const htmlMatch = content.match(/<title>(.+?)<\/title>|<h1>(.+?)<\/h1>/i);
  return htmlMatch ? (htmlMatch[1] || htmlMatch[2]).trim() : '';
}

// ΔTRUTH: Extract first non-empty paragraph.
function extractExcerpt(content) {
  const lines = content.split('\n').filter(line => line.trim());
  let excerpt = '';
  for (const line of lines) {
    if (!line.startsWith('#') && !line.startsWith('<')) {
      excerpt += line + ' ';
      if (excerpt.length > EXCERPT_LENGTH) break;
    }
  }
  return excerpt.trim();
}

// ΔRECURSION: Build hierarchies from paths.
function buildHierarchies(files) {
  const hierarchies = {};
  files.forEach(file => {
    const parts = file.path.split('/').slice(0, -1);
    for (let i = 0; i < parts.length; i++) {
      const parent = parts.slice(0, i).join('/') || null;
      const child = parts[i];
      if (parent) {
        if (!hierarchies[parent]) hierarchies[parent] = [];
        if (!hierarchies[parent].includes(child)) hierarchies[parent].push(child);
      } else {
        if (!hierarchies.root) hierarchies.root = [];
        if (!hierarchies.root.includes(child)) hierarchies.root.push(child);
      }
    }
  });
  delete hierarchies.root; // Focus on section-level
  Object.values(hierarchies).forEach(subs => subs.sort());
  return hierarchies;
}

// ΔFIELD: Main execution.
async function generateIndex() {
  const flat = await walk(PUBLIC_DIR);
  const sections = [...new Set(flat.map(f => f.path.split('/')[0]).filter(Boolean))].sort();
  const tags = [...new Set(flat.flatMap(f => f.tags))].sort();
  const hierarchies = buildHierarchies(flat);
  const indexData = { flat, sections, tags, hierarchies };
  await fs.writeFile(path.join(PUBLIC_DIR, INDEX_FILE), JSON.stringify(indexData, null, 2));
  console.log('index.json generated.');
}

generateIndex().catch(console.error);
