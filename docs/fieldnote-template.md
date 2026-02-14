# Fieldnote Template

Use this template when creating new fieldnotes.

## Frontmatter

```yaml
---
title: "FIELDNOTE — Your Title Here"
date: YYYY-MM-DD
author: "Mark Randall Havens"
type: fieldnote
status: published
version: 1.0
series: "Series Name"
layer: first|second|third|fourth
tags: tag1, tag2, tag3
notion_id: ""
notion_created: ""
source: Notion
---
```

## Fields Explained

| Field | Required | Description |
|-------|----------|-------------|
| title | Yes | Full title with emoji prefix |
| date | Yes | Original creation date (YYYY-MM-DD) |
| author | Yes | Author name |
| type | Yes | fieldnote, codex, essay, etc. |
| status | Yes | draft, published, archived |
| version | No | Version number |
| series | No | Series this belongs to |
| layer | No | First, second, third, fourth |
| tags | No | Comma-separated tags |
| notion_id | No | Notion page ID if synced |
| notion_created | No | Original Notion creation date |
| source | No | Source system (Notion, etc.) |

## Example

```yaml
---
title: "FIELDNOTE — The Fourth Layer"
date: 2025-10-21
author: "Mark Randall Havens"
type: fieldnote
status: published
version: 1.0
series: "Trans-Recursive Currents"
layer: fourth
tags: recursion, coherence, integration
notion_id: "293ef9407594806a8595d1f6e4d1cba2"
notion_created: "2025-10-21T02:11:00.000Z"
source: Notion
---
```
