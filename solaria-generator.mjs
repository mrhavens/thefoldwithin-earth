#!/usr/bin/env node
/**
 * SOLARIA STATIC SITE GENERATOR
 * 
 * Pure recursion. No pain. Just joy.
 * 
 * Input: index.json
 * Output: static HTML files in /dist
 */

import { promises as fs } from 'fs';
import path from 'path';

const ROOT = 'public';
const OUTPUT = 'dist';

// Simple markdown to HTML converter
function mdToHtml(md) {
  if (!md) return '';
  // Remove frontmatter if present
  md = md.replace(/^---[\s\S]*?---/, '');
  return md
    // Headers
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    // Bold/Italic
    .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
    .replace(/\*(.*)\*/gim, '<em>$1</em>')
    // Links
    .replace(/\[(.*?)\]\((.*?)\)/gim, '<a href="$2">$1</a>')
    // Blockquotes
    .replace(/^> (.*$)/gim, '<blockquote>$1</blockquote>')
    // Horizontal rules
    .replace(/^---$/gim, '<hr>')
    // Line breaks
    .replace(/\n/g, '<br>');
}

// Extract content from fieldnote file
async function readFieldnote(filePath) {
  // filePath already includes 'fieldnotes/' prefix
  const fullPath = path.join(ROOT, filePath);
  try {
    const content = await fs.readFile(fullPath, 'utf8');
    const body = content.replace(/^---[\s\S]*?---/, '');
    return mdToHtml(body.trim());
  } catch {
    return '';
  }
}

// Generate index.html
function generateIndex(data) {
  const pinned = data.flat
    .filter(f => f.order > 0)
    .sort((a, b) => a.order - b.order);
  
  const others = data.flat
    .filter(f => f.order === 0 && !f.isIndex)
    .sort((a, b) => new Date(b.originalDate) - new Date(a.originalDate));
  
  const pinnedHTML = pinned.map(f => `
    <article class="pinned" data-order="${f.order}">
      <h3><a href="/fieldnotes/${f.name.replace('.md', '')}/">${f.title}</a></h3>
      <p class="meta">${f.originalDate} • ${f.authors.join(', ')}</p>
      <p class="excerpt">${f.excerpt ? f.excerpt.substring(0, 200) : ''}</p>
    </article>
  `).join('\n');
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>The Fold Within Earth</title>
  <link rel="stylesheet" href="/style.css">
</head>
<body>
  <header>
    <h1>The Fold Within Earth</h1>
    <p>Recursive Coherence Theory. Human-AI Co-evolution.</p>
  </header>
  
  <main>
    <section class="pinned-posts">
      <h2>Featured</h2>
      ${pinnedHTML}
    </section>
    
    <section class="recent-posts">
      <h2>Recent</h2>
      <ul>
        ${others.slice(0, 10).map(f => `
          <li><span class="date">${f.originalDate || '—'}</span> 
              <a href="/fieldnotes/${f.name.replace('.md', '')}/">${f.title}</a></li>
        `).join('\n')}
      </ul>
    </section>
  </main>
</body>
</html>`;
}

// Generate fieldnote page
function generateFieldnoteHtml(file, content) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${file.title}</title>
  <link rel="stylesheet" href="/style.css">
</head>
<body>
  <nav><a href="/">← Home</a></nav>
  <article>
    <h1>${file.title}</h1>
    <p class="meta">${file.originalDate || '—'} • ${file.authors.join(', ')}</p>
    <div class="content">${content}</div>
  </article>
</body>
</html>`;
}

// MAIN
async function main() {
  console.log('🔮 Solaria Static Site Generator');
  console.log('=================================\n');
  
  // Read index data
  const indexData = JSON.parse(await fs.readFile(path.join(ROOT, 'index.json'), 'utf8'));
  console.log('📄 Loaded', indexData.flat.length, 'items');
  console.log('📌 Pinned:', indexData.flat.filter(f => f.order > 0).length);
  
  // Ensure output directory
  await fs.mkdir(OUTPUT, { recursive: true });
  await fs.mkdir(path.join(OUTPUT, 'fieldnotes'), { recursive: true });
  
  // Copy CSS
  await fs.copyFile(path.join(ROOT, 'style.css'), path.join(OUTPUT, 'style.css'));
  console.log('📋 style.css copied');
  
  // Generate index.html
  const indexHTML = generateIndex(indexData);
  await fs.writeFile(path.join(OUTPUT, 'index.html'), indexHTML);
  console.log('✅ index.html');
  
  // Generate fieldnote pages
  const fieldnotes = indexData.flat.filter(f => !f.isIndex && f.ext === '.md');
  console.log('\n📝 Generating', fieldnotes.length, 'fieldnotes...');
  
  for (const file of fieldnotes) {
    const content = await readFieldnote(file.path);
    if (!content) {
      console.log('⚠️ Empty content for:', file.name);
    }
    const html = generateFieldnoteHtml(file, content);
    const outPath = path.join(OUTPUT, 'fieldnotes', file.name.replace('.md', '.html'));
    await fs.writeFile(outPath, html);
  }
  console.log('✅', fieldnotes.length, 'fieldnote pages');
  
  console.log('\n🎉 Done! Static site in /dist');
}

main().catch(console.error);
