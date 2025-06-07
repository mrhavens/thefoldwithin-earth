import fs from 'fs';
import path from 'path';
import { marked } from 'marked';

const postsDir = './posts';
const outputFile = './posts.js';

const files = fs.readdirSync(postsDir).filter(f => f.endsWith('.md'));

const posts = files.map(file => {
  const filepath = path.join(postsDir, file);
  const raw = fs.readFileSync(filepath, 'utf-8');
  const html = marked.parse(raw);
  return { file, content: html };
});

const output = `document.getElementById("content").innerHTML = \`${posts.map(p => `<article>${p.content}</article>`).join("")}\`;`;

fs.writeFileSync(outputFile, output);
console.log("✅ Blog built to posts.js");
