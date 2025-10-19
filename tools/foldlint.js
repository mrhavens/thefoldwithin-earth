import fs from 'fs/promises';
import path from 'path';
import matter from 'gray-matter';
import yaml from 'js-yaml';
import crypto from 'crypto';
import nacl from 'tweetnacl';

// Error codes
const ERRORS = {
  S001: 'Missing field',
  S002: 'Invalid type',
  G001: 'Broken exit',
  G002: 'Circular link',
  H001: 'Hash mismatch',
  V001: 'Spec version unsupported',
  M001: 'Migration checksum fail',
  Sig001: 'Signature invalid',
  V002: 'Unquoted spec_version; quote recommended',
  Y001: 'Block scalar in exits.to; use inline string',
  G003: 'Invalid exit hash'
};

// Canonical hash (exclude id from frontmatter)
function canonicalHash(meta, body) {
  const metaClone = { ...meta };
  delete metaClone.id; // Exclude id to avoid circularity
  const frontYaml = yaml.dump(metaClone, { noRefs: true, lineWidth: -1 }).trim();
  const content = frontYaml + '\n' + body.trim();
  const lines = content.split('\n');
  const trimmedLines = lines.map(line => line.replace(/\s+$/, ''));
  const normalized = trimmedLines.join('\n');
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

// DFS cycle detection
function detectCycles(graph) {
  const visited = new Set();
  const recStack = new Set();

  function dfs(node) {
    visited.add(node);
    recStack.add(node);
    for (const neighbor of graph[node] || []) {
      if (!visited.has(neighbor)) {
        if (dfs(neighbor)) return true;
      } else if (recStack.has(neighbor)) {
        return true; // Cycle
      }
    }
    recStack.delete(node);
    return false;
  }

  for (const node in graph) {
    if (!visited.has(node) && dfs(node)) {
      throw new Error(ERRORS.G002);
    }
  }
}

// Validate async
async function validate(file, idToFile = {}) {
  const content = await fs.readFile(file, 'utf8');
  const { data: meta, content: body } = matter(content);

  // Required fields
  const required = ['spec_version', 'id', 'title', 'author', 'date', 'kind', 'medium', 'summary'];
  required.forEach(field => {
    if (!meta[field]) throw new Error(`${ERRORS.S001}: ${field}`);
  });

  // Enums
  const specVersion = String(meta.spec_version);
  if (specVersion !== '2.3') {
    throw new Error(`${ERRORS.V001}: found ${specVersion}`);
  }
  if (typeof meta.spec_version !== 'string') {
    console.warn(`${ERRORS.V002}: ${file} (parsed as ${typeof meta.spec_version}: ${meta.spec_version})`);
  }
  if (!['room', 'post', 'artifact'].includes(meta.kind)) throw new Error(`${ERRORS.S002}: kind`);
  if (!['textual', 'graphical', 'interactive'].includes(meta.medium)) throw new Error(`${ERRORS.S002}: medium`);

  // Check exits.to for block scalars
  if (meta.exits) {
    meta.exits.forEach((exit, i) => {
      if (typeof exit.to === 'string' && exit.to.includes('\n')) {
        console.warn(`${ERRORS.Y001}: ${file} at exits[${i}].to`);
      }
    });
  }

  // Hash verify
  const computed = canonicalHash(meta, body);
  const idHash = meta.id.split('@sha256:')[1];
  if (computed !== idHash) throw new Error(`${ERRORS.H001}: computed=${computed}, expected=${idHash}`);

  // Validate exit hashes
  if (meta.exits && idToFile) {
    meta.exits.forEach((exit, i) => {
      const to = exit.to;
      if (to.includes('@sha256:') && idToFile[to]) {
        const targetContent = fs.readFileSync(idToFile[to], 'utf8');
        const targetMeta = matter(targetContent).data;
        const targetComputed = canonicalHash(targetMeta, matter(targetContent).content);
        const targetIdHash = to.split('@sha256:')[1];
        if (targetComputed !== targetIdHash) {
          throw new Error(`${ERRORS.G003}: Invalid hash in exits[${i}].to=${to} in ${file}`);
        }
      }
    });
  }

  // Migration if <2.3 (e.g., v2.2)
  if (specVersion === '2.2') {
    const transform = (await import('../migrations/v2_2/transform.js')).default;
    meta = transform(meta, body);
    const migHash = crypto.createHash('sha256').update(JSON.stringify(meta) + body).digest('hex');
    if (meta.migration_hash !== migHash) throw new Error(`${ERRORS.M001}: computed=${migHash}`);
  }

  // Signature verify
  const rel = path.relative(path.join(process.cwd(), 'atlas'), file).replace(/[\\/]/g, '_');
  const sigFile = path.join(process.cwd(), 'signatures', rel + '.sig');
  try {
    await fs.access(sigFile);
    const sigContent = await fs.readFile(sigFile, 'utf8');
    const sig = Buffer.from(sigContent.split(':')[1].trim(), 'hex');
    const pubKey = Buffer.from('example_pubkey_hex', 'hex'); // Annex for real keys
    const message = Buffer.from(content);
    const valid = nacl.sign.detached.verify(message, sig, pubKey);
    if (!valid) throw new Error(`${ERRORS.Sig001}: ${sigFile}`);
  } catch {
    return; // Skip if missing
  }

  // Append report to jsonl
  const report = { file, status: 'valid', timestamp: new Date().toISOString() };
  await fs.appendFile('foldlint.jsonl', JSON.stringify(report) + '\n');
}

export { validate, detectCycles };
