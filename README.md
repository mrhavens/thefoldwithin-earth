# The Fold Within Earth - v2.3 Canonical Minimal Specification

This repository implements the eternal, Markdown-native MUD/blog/archive as per the blueprint.

## Setup
1. `npm install` (generates package-lock.json)
2. `node tools/hash.js` to verify hashes; `node tools/hash.js fix` to update IDs if needed
3. `npm run lint` to validate all files
4. `npm run build` to generate /dist
5. Deploy to Cloudflare Pages (auto-build on push)

## Components
- **Atlas:** Content in /atlas/*.md (hashes verified)
- **foldlint:** Validation: `node tools/foldlint.js`
- **Build:** Generates static site: `npm run build`
- **Scribe:** Archiver daemon: `npm run scribe` (local only)
- **Witness:** P2P chat in browser (embedded in HTML, offline localStorage)

## Hash Management
- Each .md file includes a SHA-256 hash in its `id` field, computed over YAML front-matter (excluding `id`) + body.
- Run `node tools/hash.js` to check hashes; use `node tools/hash.js fix` to update incorrect IDs.
- Hashes exclude the `id` field to avoid circularity.
- After modifying `exits.to` fields, run `node tools/hash.js fix` to update affected hashes.

## Link Management
- `exits.to` fields in .md files must use full `id` values (e.g., `room:slug@sha256:hash`) or `kind:slug` (resolved automatically).
- Use inline strings for `exits.to` (no block scalars like `>-`) to ensure consistent hashing.
- Broken links (non-existent IDs) or invalid hashes in `exits.to` will fail the build. Ensure all referenced IDs exist in /atlas and match their file hashes.

For full spec, see /docs/primer.md.
