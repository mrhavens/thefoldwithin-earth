# The Fold Within — Static Site


### Adding Tags
Tags are embedded in the files themselves during content creation. The system supports comma-separated lists for simplicity and portability. No special setup is needed—add them as follows based on file type:

- **Markdown (.md Files)**: Include a line like `Tags: foo, bar` anywhere in the file (case-insensitive). Example:
  ```
  # My Post Title

  Tags: technology, ai, future

  Content starts here...
  ```
  This is extracted via regex matching in the build script.

- **HTML (.html Files)**: Use the standard `<meta>` tag in the `<head>`, e.g., `<meta name="keywords" content="foo, bar">`. Example:
  ```
  <html>
  <head>
    <title>My Page</title>
    <meta name="keywords" content="technology, ai, future">
  </head>
  <body>Content...</body>
  </html>
  ```
  This leverages HTML semantics for broad compatibility.

- **PDF (.pdf Files)**: Set the document's metadata "Subject" field to a comma-separated list (e.g., "technology, ai, future") using your PDF editor (like Adobe Acrobat or online tools). This is pulled from PDF metadata during indexing—no text extraction needed for tags specifically.

If no tags are found, the file gets an empty array (no errors). Tags are normalized to lowercase and trimmed for consistency. This approach is elegant because it uses existing file standards, avoiding clutter while allowing retroactive addition to old content.

### Indexing Tags
Indexing happens automatically during the Cloudflare build process via the `tools/generate-index.mjs` script. It's a zero-touch, build-time operation:

1. **Collection**: As the script recursively crawls `/public` directories (skipping dots and static-only files), it calls `extractTags(raw, ext, pdfData)` for each eligible file (.md, .html, .pdf, excluding index.html).
   - Raw content (head or full for PDFs) is parsed.
   - Tags are split, trimmed, lowercased, and stored in the file's manifest entry (e.g., `{ ..., tags: ["technology", "ai"] }`).

2. **Aggregation**: After collecting all files into `flat`, unique tags are deduplicated and sorted alphabetically into `index.json.tags` (e.g., `["ai", "future", "technology"]`).

3. **Output**: The full `index.json` includes `flat` (with per-file tags) and `tags` (global unique list). Example snippet:
   ```
   {
     "flat": [{ ..., "tags": ["ai", "future"] }, ...],
     "sections": [...],
     "tags": ["ai", "future", "technology"]
   }
   ```

This manifest is rebuilt on every GitHub push/Cloudflare deploy, ensuring tags reflect the latest filesystem. No database or runtime overhead—it's static JSON.

### Usage in the Site
Once indexed:
- The client (`public/app.js`) populates `<select id="tagSelect" multiple>` from `indexData.tags`.
- Filtering in `renderList()` uses array methods: Posts match if they contain *all* selected tags (AND logic for precision; e.g., every selected tag must be present).
- Combines seamlessly with section/sort/search for powerful queries, all client-side for instant results.

If a file lacks tags, it's still indexed but won't match tag filters. For coherence, tags are optional— the site works fine without them. If you need OR logic or more (e.g., nested tags), we can extend in v2.6.

This system is elegant: Minimal intrusion, standards-based, automated, and scalable for personal sites. If this refers to a different context (e.g., Git tags or SEO), provide more details!
