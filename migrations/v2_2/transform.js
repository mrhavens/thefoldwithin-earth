// Migration from v2.2 to v2.3: Add migration_hash if missing
import crypto from 'crypto';

export default function transform(meta, content) {
  if (!meta.migration_hash) {
    const hash = crypto.createHash('sha256').update(JSON.stringify(meta) + content).digest('hex');
    meta.migration_hash = hash;
  }
  return meta;
};
