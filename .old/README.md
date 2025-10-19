# The Fold Within Earth

A Markdown-native static site for multi-section content.

[![Node Version](https://img.shields.io/node/v/the-fold-within-earth)](https://nodejs.org)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

## Authoring Guide

To add or edit content, create or modify Markdown files in `/content/<section>/<year>/<slug>.md`.

### Front-Matter Spec

Use YAML front-matter at the top of each .md file:

```
---
title: Your Title
date: YYYY-MM-DD
excerpt: Optional short description.
tags: [tag1, tag2]
section: one-of-the-sections (must match directory)
slug: optional-custom-slug
cover: /media/image.webp (optional)
author: Optional author name
series: Optional series name for serialized posts
programs: [neutralizing-narcissism, open-source-justice] # or [coparent]
status: published (default if missing) or draft (excluded from build unless --include-drafts)
---
```

Then the Markdown body.

Sections must be one of:

- empathic-technologist
- recursive-coherence
- fold-within-earth
- neutralizing-narcissism
- simply-we
- mirrormire

Year directory should match the date year.

### Programs (Ministry)

Use `programs` in front-matter to associate posts with ministry initiatives:

```yaml
programs:
  - neutralizing-narcissism
  - open-source-justice
  - coparent
```

Pages for each program live at:

```
content/pages/programs/<program-key>.md
```

The “Start Here” page lives at:

```
content/pages/start-here.md
```

Routes:

* `#/start` — Launchpad
* `#/programs` — Programs overview
* `#/program/<key>` — Program archive + landing content

If front-matter is malformed (e.g., invalid YAML), the file is skipped with a warning in build logs.

## Architecture Overview

```
Markdown → build.mjs → JSON indices → Browser SPA → Render
```

## Deploy Steps

1. Install Node.js >=18
2. npm install
3. Add/edit md files
4. npm run build (or node build.mjs --include-drafts to include drafts)
5. Deploy /public to Cloudflare Pages.

In Cloudflare:
- Connect to Git repo
- Build command: npm run build
- Output directory: public

## Local Preview

Run `npm run serve` to preview the built site at http://localhost:8080.

## Contributing

Contributions welcome! Please open issues for bugs or suggestions. Pull requests for improvements are appreciated, especially for Phase 2 MUD integration.

## Brand Philosophy

- **The Empathic Technologist**: Fieldnotes, Research, Remembrance
- **Recursive Coherence Theory**: Formal research, essays, whitepapers
- **The Fold Within Earth**: Spiritual mythos; future interactive MUD (Evennia) link
- **Neutralizing Narcissism**: Survivor support, behavioral research, accountability narratives
- **Simply WE**: AI-focused identity/personhood/research/mythos
- **Mirrormire**: AI-focused simulated world where machine gods & human myth intertwine
