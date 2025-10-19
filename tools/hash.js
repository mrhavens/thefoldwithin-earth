import fs from 'fs/promises';
import path from 'path';
import matter from 'gray-matter';
import yaml from 'js-yaml';
import crypto from 'crypto';

// Canonical hash (exclude id from frontmatter)
function canonicalHash(meta, body) {
  const metaClone = { ...meta };
  delete metaClone.id; // Exclude id to avoid circularity
  const frontYaml = yaml.dump(metaClone, { noRefs: true, lineWidth: -1 }).trim();
  const content = frontYaml + '\n' + body.trim();
  const lines = content.split('\n');
  const trimmedLines = lines.map(line => line.replace(/\s+$/, ''));
  const normalized = trimmedLines.join('\n');
  return { hash: crypto.createHash('sha256').update(normalized).digest('hex'), normalized };
}

// Compute canonical hash for a file
async function computeHash(file) {
  const content = await fs.readFile(file, 'utf8');
  const { data: meta, content: body } = matter(content);
  // Warn about block scalars in exits.to
  if (meta.exits) {
    meta.exits.forEach((exit, i) => {
      if (typeof exit.to === 'string' && exit.to.includes('\n')) {
        console.warn(`Block scalar in exits[${i}].to: ${file}; use inline string`);
      }
    });
  }
  const { hash, normalized } = canonicalHash(meta, body);
  const expected = meta.id ? meta.id.split('@sha256:')[1] : 'none';
  console.log(`File: ${file}\nComputed: ${hash}\nExpected: ${expected}\nMatch: ${hash === expected}\nNormalized Content:\n${normalized}\n`);
  console.log(`To fix, update id to: ${meta.id.split('@sha256:')[0]}@sha256:${hash}`);
  return { file, computed: hash, expected, match: hash === expected };
}

// Fix hash in file
async function fixHash(file) {
  const content = await fs.readFile(file, 'utf8');
  const { data: meta, content: body } = matter(content);
  // Normalize exits.to to inline strings
  if (meta.exits) {
    meta.exits = meta.exits.map(exit => ({
      ...exit,
      to: exit.to.replace(/\n/g, '').trim()
    }));
  }
  const { hash } = canonicalHash(meta, body);
  const kindSlug = meta.id.split('@sha256:')[0]; // Preserve 'kind:slug'
  meta.id = kindSlug + '@sha256:' + hash;
  const newContent = `---\n${yaml.dump(meta, { noRefs: true, lineWidth: -1 }).trim()}\n---\n${body.trim()}`;
  await fs.writeFile(file, newContent);
  console.log(`Fixed hash in ${file}: ${hash}`);
}

// Validate mode (check without fixing)
async function validateHashes() {
  const atlasDir = path.join(process.cwd(), 'atlas');
  const files = [];
  async function collectFiles(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await collectFiles(fullPath);
      } else if (entry.name.endsWith('.md')) {
        files.push(fullPath);
      }
    }
  }
  await collectFiles(atlasDir);

  const results = [];
  for (const file of files) {
    const result = await computeHash(file);
    results.push(result);
  }
  if (results.some(r => !r.match)) {
    console.error('Hash mismatches detected. Run `node tools/hash.js fix` to update IDs.');
    process.exit(1);
  }
}

// Main
async function main() {
  const mode = process.argv[2] || 'check';
  if (mode === 'validate') {
    await validateHashes();
    return;
  }

  const atlasDir = path.join(process.cwd(), 'atlas');
  const files = [];
  async function collectFiles(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await collectFiles(fullPath);
      } else if (entry.name.endsWith('.md')) {
        files.push(fullPath);
      }
    }
  }
  await collectFiles(atlasDir);

  const results = [];
  for (const file of files) {
    if (mode === 'fix') {
      await fixHash(file);
    } else {
      const result = await computeHash(file);
      results.push(result);
    }
  }
  if (mode === 'check' && results.some(r => !r.match)) {
    console.error('Hash mismatches detected. Run `node tools/hash.js fix` to update IDs.');
    process.exit(1);
  }
}

main().catch(console.error);
