# Primer for The Fold Within Earth

## 5-Min Overview
The Fold is a static Markdown blog that becomes a P2P MUD when JS is enabled. Content in /atlas, built to /dist.

## 30-Min Deep Dive
- Schema: YAML front-matter in .md.
- Validation: foldlint.js checks schema, graphs, hashes, signatures.
- Build: Generates HTML with links, sanitizes Markdown.
- Witness: Ephemeral chat via WebRTC, offline localStorage.
- Scribe: Appends deltas atomically.

For full canon, refer to blueprint.
