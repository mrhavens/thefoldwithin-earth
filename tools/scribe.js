import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

// Daemon: Watch deltas.json, process atomically
async function processDeltas() {
  const deltaFile = path.join(process.cwd(), 'scribe/deltas.json');
  const auditFile = path.join(process.cwd(), 'scribe/audit.jsonl');
  const chainFile = path.join(process.cwd(), 'scribe/chain');

  // Guards
  await fs.mkdir(path.dirname(auditFile), { recursive: true });
  if (!(await fs.access(auditFile).catch(() => false))) await fs.writeFile(auditFile, '');
  if (!(await fs.access(chainFile).catch(() => false))) await fs.writeFile(chainFile, '');

  if (await fs.access(deltaFile).catch(() => false)) {
    const deltas = JSON.parse(await fs.readFile(deltaFile, 'utf8'));
    const tmpAudit = auditFile + `.tmp.${Date.now()}`;

    for (const delta of deltas) {
      // Validate clock (stub)
      if (!delta.clock) continue;

      // Append to tmp
      await fs.appendFile(tmpAudit, JSON.stringify(delta) + '\n');

      // Idempotent merge (hash check)
      const existingHash = crypto.createHash('sha256').update(JSON.stringify(delta)).digest('hex');
      const chainContent = await fs.readFile(chainFile, 'utf8');
      if (chainContent.includes(existingHash)) continue; // Idempotent skip

      // Append to chain
      await fs.appendFile(chainFile, existingHash + '\n');
    }

    // Promote atomic (after full batch)
    await fs.rename(tmpAudit, auditFile);

    await fs.unlink(deltaFile);
  }
}

setInterval(async () => await processDeltas(), 1000);
console.log('Scribe daemon running...');
