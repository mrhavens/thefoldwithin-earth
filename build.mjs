import fs from 'fs/promises';
import path from 'path/posix';
import yaml from 'js-yaml';
import crypto from 'crypto';

const CONTENT_DIR = './content';
const PUBLIC_DIR = './public';
const CACHE_FILE = './.buildcache.json';
const CONFIG_FILE = './config.json';
const includeDrafts = process.argv.includes('--include-drafts');

let config = {};
try {
  config = JSON.parse(await fs.readFile(CONFIG_FILE, 'utf8'));
} catch (e) {
  console.warn('config.json not found or invalid; using defaults.');
  config = {
    siteTitle: 'The Fold Within Earth',
    siteDescription: 'Uncovering the Recursive Real.',
    siteUrl: 'https://thefoldwithin.earth',
    defaultAuthor: 'Mark Randall Havens',
    analyticsId: ''
  };
}

async function getAllFiles(dir, fileList = []) {
  const files = await fs.readdir(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = await fs.stat(fullPath);
    if (stat.isDirectory()) {
      await getAllFiles(fullPath, fileList);
    } else if (file.endsWith('.md') && !file.startsWith('_')) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

function slugify(s) {
  return s.toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').replace(/-+/g, '-');
}

function parseFrontMatter(src) {
  const m = src.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!m) return {fm: {}, body: src};
  let fm;
  try {
    fm = yaml.load(m[1]);
  } catch (e) {
    console.warn('Invalid front matter:', e.message);
    return {fm: {}, body: src};
  }
  const body = src.slice(m[0].length).trim();
  return {fm, body};
}

function firstParagraph(t) {
  const p = t.replace(/\r/g, '').split(/\n{2,}/).find(x => x.replace(/\s/g, '').length > 0);
  return p ? p.replace(/\n/g, ' ').trim() : '';
}

function toISODate(s, f) {
  const d = s ? new Date(s) : null;
  return d && !isNaN(d) ? d : f;
}

function escapeXML(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

async function main() {
  let cache = {};
  try {
    const cacheData = await fs.readFile(CACHE_FILE, 'utf8');
    cache = JSON.parse(cacheData);
  } catch {}

  await fs.rm(PUBLIC_DIR, {recursive: true, force: true});
  await fs.mkdir(PUBLIC_DIR, {recursive: true});

  const allFiles = await getAllFiles(CONTENT_DIR);

  let draftCount = 0;
  const newCache = {};
  const postsPromises = allFiles.map(async (full) => {
    const relPath = path.relative(CONTENT_DIR, full).replace(/\\/g, '/');
    const stat = await fs.stat(full);
    const mtime = stat.mtimeMs;
    const raw = await fs.readFile(full, 'utf8');
    const contentHash = crypto.createHash('md5').update(raw).digest('hex');
    if (cache[relPath] && cache[relPath].mtime === mtime && cache[relPath].hash === contentHash) {
      return cache[relPath].post;
    }
    const parts = relPath.split('/');
    if (parts.length !== 3 && !relPath.startsWith('pages/')) return null;
    const section = parts[0];
    const year = parts[1];
    const file = parts[2];
    const {fm, body} = parseFrontMatter(raw);
    if (!fm.section || fm.section !== section) {
      console.warn(`⚠️ [${relPath}] Section mismatch or missing.`);
      return null;
    }
    if (!includeDrafts && fm.status === 'draft') {
      draftCount++;
      return null;
    }
    const title = fm.title || file.replace('.md', '').replace(/-/g, ' ');
    let slug = fm.slug || slugify(title);
    // Check for slug collisions
    const existingSlugs = new Set(posts.map(p => p.slug));
    let counter = 1;
    while (existingSlugs.has(slug)) {
      slug = `${slug}-${++counter}`;
    }
    const dateStr = fm.date || `${year}-01-01`;
    const dateObj = toISODate(dateStr, stat.mtime);
    const dateISO = dateObj.toISOString().split('T')[0];
    let excerpt = fm.excerpt || firstParagraph(body);
    if (excerpt.length > 200) excerpt = excerpt.slice(0, 200) + '…';
    const words = body.split(/\s+/).length;
    const readingTime = Math.ceil(words / 200);
    const tags = Array.isArray(fm.tags) ? fm.tags : (fm.tags ? [fm.tags] : []);
    const cover = fm.cover;
    const author = fm.author || config.defaultAuthor;
    const series = fm.series;
    const programs = Array.isArray(fm.programs) ? fm.programs : (fm.programs ? [fm.programs] : []);
    const id = crypto.createHash('md5').update(relPath).digest('hex');
    const post = {title, date: dateISO, excerpt, tags, section, slug, readingTime, cover, author, series, programs, id, file: relPath};
    newCache[relPath] = {mtime, hash: contentHash, post};
    return post;
  });

  let posts = (await Promise.all(postsPromises)).filter(Boolean);
  posts.sort((a, b) => new Date(b.date) - new Date(a.date));

  // Copy static files
  const filesToCopy = ['index.html', 'styles.css', 'util.js', 'sanitize.js', 'render.js', 'app.js', 'mud.js', 'config.json'];
  await Promise.all(filesToCopy.map(f => fs.copyFile(f, path.join(PUBLIC_DIR, f))));

  // Copy content dir
  async function copyDir(src, dest) {
    await fs.mkdir(dest, {recursive: true});
    const entries = await fs.readdir(src, {withFileTypes: true});
    await Promise.all(entries.map(entry => {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      return entry.isDirectory() ? copyDir(srcPath, destPath) : fs.copyFile(srcPath, destPath);
    }));
  }
  await copyDir(CONTENT_DIR, path.join(PUBLIC_DIR, 'content'));

  await fs.writeFile(path.join(PUBLIC_DIR, 'index.json'), JSON.stringify(posts, null, 2));

  const searchData = posts.map(p => ({title: p.title, excerpt: p.excerpt, tags: p.tags.join(' '), section: p.section, slug: p.slug}));
  await fs.writeFile(path.join(PUBLIC_DIR, 'search.json'), JSON.stringify(searchData, null, 2));

  async function getPages(dir){
    const out = [];
    const entries = await fs.readdir(dir, { withFileTypes: true }).catch(()=>[]);
    for (const e of entries) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) {
        out.push(...await getPages(p));
      } else if (e.name.endsWith('.md')) {
        const raw = await fs.readFile(p, 'utf8');
        const { fm, body } = parseFrontMatter(raw);
        if (fm?.status === 'draft' && !includeDrafts) continue;
        const rel = path.relative(CONTENT_DIR, p).replace(/\\/g,'/');
        const title = fm?.title || e.name.replace('.md','');
        const slug = (fm?.key || slugify(title));
        const excerpt = (fm?.excerpt || firstParagraph(body)).slice(0,200) + (firstParagraph(body).length>200?'…':'');
        out.push({ title, slug, excerpt, file: rel, type: 'page' });
      }
    }
    return out;
  }

  const pages = await getPages(path.join(CONTENT_DIR, 'pages'));
  await fs.writeFile(path.join(PUBLIC_DIR, 'pages.json'), JSON.stringify(pages, null, 2));

  const allSections = [...new Set(posts.map(p => p.section))];
  const today = new Date().toISOString().split('T')[0];
  const sitemapHome = `<url><loc>${escapeXML(config.siteUrl)}</loc><lastmod>${today}</lastmod></url>`;
  const sitemapSections = allSections.map(s => `<url><loc>${escapeXML(`${config.siteUrl}/#/section/${s}`)}</loc><lastmod>${today}</lastmod></url>`).join('');
  const sitemapPosts = posts.map(p => `<url><loc>${escapeXML(`${config.siteUrl}/#/post/${p.slug}`)}</loc><lastmod>${p.date}</lastmod></url>`).join('');
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${sitemapHome}${sitemapSections}${sitemapPosts}</urlset>`;
  await fs.writeFile(path.join(PUBLIC_DIR, 'sitemap.xml'), sitemap);

  const rssItems = posts.map(p => {
    let item = `<item><title>${escapeXML(p.title)}</title><link>${escapeXML(`${config.siteUrl}/#/post/${p.slug}`)}</link><guid>${escapeXML(`${config.siteUrl}/#/post/${p.slug}`)}</guid><pubDate>${new Date(p.date).toUTCString()}</pubDate><description>${escapeXML(p.excerpt)}</description>`;
    if (p.author) item += `<author>${escapeXML(p.author)}</author>`;
    item += `<content:encoded><![CDATA[<p>${escapeXML(p.excerpt)}</p><p>Reading time: ${p.readingTime} min</p>]]></content:encoded>`;
    if (p.cover) item += `<enclosure url="${escapeXML(`${config.siteUrl}${p.cover}`)}" type="image/webp" />`;
    item += `</item>`;
    return item;
  }).join('');
  const rss = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/"><channel><title>${escapeXML(config.siteTitle)}</title><link>${escapeXML(config.siteUrl)}</link><description>${escapeXML(config.siteDescription)}</description><lastBuildDate>${new Date().toUTCString()}</lastBuildDate>${rssItems}</channel></rss>`;
  await fs.writeFile(path.join(PUBLIC_DIR, 'rss.xml'), rss);

  await fs.writeFile(CACHE_FILE, JSON.stringify(newCache));
  console.log(`✅ Built ${posts.length} posts`);
  if (includeDrafts) console.log(`Included ${draftCount} draft(s)`);
}

main().catch(console.error);
