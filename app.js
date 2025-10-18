const SITE_URL = 'https://thefoldwithin.earth';

const state = {
  posts: [],
  bySlug: new Map(),
  bySection: new Map(),
  byTag: new Map(),
  bySeries: new Map(),
  byProgram: new Map(),
  allTags: new Set(),
  allSections: ['empathic-technologist', 'recursive-coherence', 'fold-within-earth', 'neutralizing-narcissism', 'simply-we', 'mirrormire'],
  sectionTitles: {
    'empathic-technologist': 'The Empathic Technologist',
    'recursive-coherence': 'Recursive Coherence Theory',
    'fold-within-earth': 'The Fold Within Earth',
    'neutralizing-narcissism': 'Neutralizing Narcissism',
    'simply-we': 'Simply WE',
    'mirrormire': 'Mirrormire'
  },
  programTitles: {
    'neutralizing-narcissism': 'Neutralizing Narcissism',
    'open-source-justice': 'Open Source Justice',
    'coparent': 'COPARENT'
  },
  pages: []
};

const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

window.addEventListener('hashchange', () => {
  $('nav ul').classList.remove('open');
  $('.hamburger').setAttribute('aria-expanded', 'false');
  router();
});
document.addEventListener('DOMContentLoaded', init);

async function init() {
  try {
    const res = await fetch('index.json');
    if (!res.ok) throw new Error('Could not load index.');
    state.posts = await res.json();
    state.posts.sort((a, b) => b.date.localeCompare(a.date));
    state.bySlug = new Map(state.posts.map(p => [p.slug, p]));
    state.allSections.forEach(s => {
      state.bySection.set(s, state.posts.filter(p => p.section === s));
    });
    state.posts.forEach(p => {
      p.tags.forEach(t => {
        state.allTags.add(t);
        if (!state.byTag.has(t)) state.byTag.set(t, []);
        state.byTag.get(t).push(p);
      });
      if (p.series) {
        if (!state.bySeries.has(p.series)) state.bySeries.set(p.series, []);
        state.bySeries.get(p.series).push(p);
      }
      p.programs.forEach(pr => {
        if (!state.byProgram.has(pr)) state.byProgram.set(pr, []);
        state.byProgram.get(pr).push(p);
      });
    });
    const pagesRes = await fetch('pages.json');
    if (pagesRes.ok) state.pages = await pagesRes.json();
    renderNav();
    renderFooter();
    setupSearchForm();
    setupHamburger();
    router();
  } catch (e) {
    $('#main').innerHTML = `<p class="error">⚠️ ${e.message}</p>`;
  }
}

function setupHamburger() {
  const hamburger = $('.hamburger');
  hamburger.addEventListener('click', () => {
    const ul = $('nav ul');
    const isOpen = ul.classList.toggle('open');
    hamburger.setAttribute('aria-expanded', isOpen);
  });
}

function renderNav() {
  $('#sections-list').innerHTML = state.allSections.map(s => `<li><a href="#/section/${s}">${state.sectionTitles[s]}</a></li>`).join('');
  const programsMenu = `
    <li class="sections"><a href="#/programs">Programs</a>
      <div class="mega">
        <ul id="programs-list">
          ${Object.entries(state.programTitles).map(([k,v])=>`<li><a href="#/program/${k}">${v}</a></li>`).join('')}
        </ul>
      </div>
    </li>
    <li><a href="#/start">Start Here</a></li>
  `;
  document.querySelector('nav ul').insertAdjacentHTML('beforeend', programsMenu);
}

function renderFooter() {
  const sectionLinks = state.allSections.map(s => `<li><a href="#/section/${s}">${state.sectionTitles[s]}</a></li>`).join('');
  const tagLinks = Array.from(state.allTags).sort().map(t => `<a href="#/tag/${t}" class="pill tag">${t}</a>`).join('');
  $('#footer').innerHTML = `
    <div class="sections">
      <h4>Sections</h4>
      <ul>${sectionLinks}</ul>
    </div>
    <div class="tags">
      <h4>Tags</h4>
      <div class="tag-cloud">${tagLinks}</div>
    </div>
    <div class="contact">
      <h4>Contact</h4>
      <p>Email: info@thefoldwithin.earth</p>
    </div>
    <p>&copy; ${new Date().getFullYear()} The Fold Within Earth</p>
  `;
}

function setupSearchForm() {
  $('#search-form').addEventListener('submit', e => {
    e.preventDefault();
    const q = $('#search-input').value.trim();
    if (q) {
      sessionStorage.setItem('lastSearch', q);
      location.hash = `/search?q=${encodeURIComponent(q)}`;
    }
  });
}

function router() {
  const main = $('#main');
  main.style.opacity = 0;
  const {parts, params} = getQueryParams();
  document.title = 'The Fold Within Earth';
  if (parts.length === 0) {
    renderHome();
  } else if (parts[0] === 'section' && parts[1]) {
    renderArchive('section', parts[1], params);
  } else if (parts[0] === 'tag' && parts[1]) {
    renderArchive('tag', parts[1], params);
  } else if (parts[0] === 'post' && parts[1]) {
    renderPost(parts[1]);
  } else if (parts[0] === 'search') {
    let q = params.get('q') || sessionStorage.getItem('lastSearch') || '';
    $('#search-input').value = q;
    renderSearch(q, params);
  } else if (parts[0] === 'about') {
    renderAbout();
  } else if (parts[0] === 'mud') {
    renderMud();
  } else if (parts[0] === 'start') {
    renderStart();
  } else if (parts[0] === 'programs') {
    renderProgramsHome();
  } else if (parts[0] === 'program' && parts[1]) {
    renderProgramArchive(parts[1], params);
  } else {
    render404();
  }
  setTimeout(() => {
    main.style.opacity = 1;
    window.scrollTo(0, 0);
    main.focus();
  }, 0);
}

function renderHome() {
  const latestAll = state.posts.slice(0, 10).map(renderCard).join('');
  const bySection = state.allSections.map(s => {
    const secPosts = state.bySection.get(s) ? state.bySection.get(s).slice(0, 3) : [];
    const list = secPosts.map(p => `<li><a href="#/post/${p.slug}">${escapeHTML(p.title)}</a> <span class="date">(${formatDate(p.date)})</span></li>`).join('');
    return `<div class="sec-col">
      <h3>${state.sectionTitles[s]}</h3>
      <ul>${list}</ul>
      <a href="#/section/${s}">More in ${state.sectionTitles[s]}...</a>
    </div>`;
  }).join('');
  $('#main').innerHTML = `
    <section class="latest-all">
      <h2>Latest Across All Sections</h2>
      <div class="grid">${latestAll}</div>
    </section>
    <section class="by-section">
      <h2>Latest by Section</h2>
      <div class="section-grid">${bySection}</div>
    </section>
  `;
  addCardListeners();
}

function renderArchive(type, key, params) {
  if (!key) return render404();
  const sort = params.get('sort') || 'desc';
  const page = parseInt(params.get('page') || '1', 10);
  let activeTags = params.get('tags') ? params.get('tags').split(',') : [];
  let postList = (type === 'section' ? state.bySection.get(key) : state.byTag.get(key)) || [];
  const title = `${type.charAt(0).toUpperCase() + type.slice(1)}: ${type === 'section' ? state.sectionTitles[key] || key : key}`;
  if (!postList.length) {
    $('#main').innerHTML = `<p class="error">No posts found for ${escapeHTML(title)}.</p>`;
    return;
  }
  let sorted = postList.slice().sort((a, b) => sort === 'desc' ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date));
  let filtered = activeTags.length ? sorted.filter(p => activeTags.some(t => p.tags.includes(t))) : sorted;
  const perPage = 10;
  const totalPages = Math.ceil(filtered.length / perPage);
  const start = (page - 1) * perPage;
  const end = start + perPage;
  const cards = filtered.slice(start, end).map(renderCard).join('');
  const availableTags = [...new Set(postList.flatMap(p => p.tags))];
  $('#main').innerHTML = `
    <section class="archive">
      <div class="breadcrumbs">${renderBreadcrumbs([type, key])}</div>
      <h1>${escapeHTML(title)}</h1>
      ${renderControls(sort, parts, params)}
      ${renderFilters(availableTags, activeTags, parts, params)}
      <div class="grid">${cards}</div>
      ${renderPager(page, totalPages, parts, {sort, tags: activeTags.join(',')})}
    </section>
  `;
  document.title = `${escapeHTML(title)} — The Fold Within Earth`;
  $('#sort-select').addEventListener('change', e => {
    updateHash(parts, {sort: e.target.value, page: 1, tags: activeTags.join(',')});
  });
  $$('.tag-cloud .pill').forEach(el => {
    el.addEventListener('click', () => {
      const t = el.dataset.tag;
      activeTags = activeTags.includes(t) ? activeTags.filter(at => at !== t) : [...activeTags, t];
      updateHash(parts, {sort, page: 1, tags: activeTags.join(',')});
    });
  });
  $$('.pager button').forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.action;
      const newPage = action === 'prev' ? page - 1 : page + 1;
      updateHash(parts, {sort, page: newPage, tags: activeTags.join(',')});
    });
  });
  addCardListeners();
}

async function renderPost(slug) {
  if (!slug) return render404();
  const post = state.bySlug.get(slug);
  if (!post) {
    $('#main').innerHTML = `<p class="error">⚠️ Post not found.</p>`;
    return;
  }
  try {
    const res = await fetch(`content/${post.file}`);
    if (!res.ok) throw new Error('Post file missing.');
    let md = await res.text();
    md = md.replace(/^---[\s\S]*?---/, '').trim();
    const html = sanitizeMarkdown(md);
    const date = formatDate(post.date);
    const sectionPill = renderPill('section', state.sectionTitles[post.section] || post.section);
    const tagPills = post.tags.map(t => renderPill('tag', t)).join('');
    const programPills = post.programs.map(pr => renderPill('program', state.programTitles[pr] || pr)).join('');
    const reading = `<span class="reading">${post.readingTime} min read</span>`;
    const authorHtml = post.author ? `<p class="author">By ${escapeHTML(post.author)}</p>` : '';
    const share = `<div class="share"><a href="https://twitter.com/intent/tweet?url=${encodeURIComponent(location.href)}&text=${encodeURIComponent(post.title)}" target="_blank" rel="noopener noreferrer">Share on X</a></div>`;
    const secPosts = state.bySection.get(post.section) || [];
    const idx = secPosts.findIndex(p => p.slug === slug);
    const prev = idx < secPosts.length - 1 ? secPosts[idx + 1] : null;
    const next = idx > 0 ? secPosts[idx - 1] : null;
    const navPost = `<div class="nav-post">${prev ? `<a href="#/post/${prev.slug}">← ${escapeHTML(prev.title)}</a>` : ''}${next ? `<a href="#/post/${next.slug}">${escapeHTML(next.title)} →</a>` : ''}</div>`;
    let navSeries = '';
    if (post.series) {
      const seriesPosts = (state.bySeries.get(post.series) || []).sort((a, b) => a.date.localeCompare(b.date));
      const sIdx = seriesPosts.findIndex(p => p.slug === slug);
      const prevSeries = sIdx > 0 ? seriesPosts[sIdx - 1] : null;
      const nextSeries = sIdx < seriesPosts.length - 1 ? seriesPosts[sIdx + 1] : null;
      navSeries = `<div class="nav-series">${prevSeries ? `<a href="#/post/${prevSeries.slug}">← Previous in ${escapeHTML(post.series)}</a>` : ''}${nextSeries ? `<a href="#/post/${nextSeries.slug}">Next in ${escapeHTML(post.series)} →</a>` : ''}</div>`;
    }
    const related = state.posts.filter(p => p.slug !== slug && p.tags.some(t => post.tags.includes(t)))
      .sort((a, b) => {
        const sharedA = a.tags.filter(t => post.tags.includes(t)).length;
        const sharedB = b.tags.filter(t => post.tags.includes(t)).length;
        return sharedB - sharedA;
      }).slice(0, 3);
    const relatedHtml = related.length ? `<h2>Related Posts</h2><div class="grid">${related.map(renderCard).join('')}</div>` : '';
    $('#main').innerHTML = `<section class="post">
      <div class="breadcrumbs">${renderBreadcrumbs(['post', post.title])}</div>
      <a href="#/" id="back">← Back to Home</a>
      <div class="markdown">
        <h1>${escapeHTML(post.title)}</h1>
        <p class="date">${date}</p>
        ${authorHtml}
        <div class="meta">${sectionPill} ${programPills} ${tagPills} ${reading}</div>
        <hr/>
        ${html}
      </div>
      ${share}
      ${navPost}
      ${navSeries}
      ${relatedHtml}
    </section>`;
    document.title = `${escapeHTML(post.title)} — The Fold Within Earth`;
    $('#canonical').href = `${SITE_URL}/#/post/${slug}`;
    addCardListeners();
  } catch (e) {
    $('#main').innerHTML = `<p class="error">⚠️ ${e.message}</p>`;
  }
}

async function renderSearch(q, params) {
  if (!q) {
    $('#main').innerHTML = `<p class="info">Enter a search query above.</p>`;
    return;
  }
  if (!window.Fuse) {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/fuse.js@7.0.0';
    document.body.appendChild(script);
    await new Promise(resolve => script.onload = resolve);
  }
  const fuse = new Fuse(state.posts, {keys: ['title', 'excerpt', 'tags', 'section'], threshold: 0.3, includeMatches: true});
  const results = fuse.search(q).map(r => ({item: r.item, matches: r.matches}));
  const title = `Search Results for "${escapeHTML(q)}" (${results.length} found)`;
  $('#main').innerHTML = `<section class="search-results">
    <h1>${title}</h1>
    <div class="grid">${results.map(r => renderCard(r.item, r.matches)).join('')}</div>
  </section>`;
  document.title = `${title} — The Fold Within Earth`;
  addCardListeners();
}

function renderAbout() {
  const vision = [
    'The Empathic Technologist — Fieldnotes, Research, Remembrance',
    'Recursive Coherence Theory — Formal research, essays, whitepapers',
    'The Fold Within Earth — Spiritual mythos; future interactive MUD (Evennia) link',
    'Neutralizing Narcissism — Survivor support, behavioral research, accountability narratives',
    'Simply WE — AI-focused identity/personhood/research/mythos',
    'Mirrormire — AI-focused simulated world where machine gods & human myth intertwine'
  ];
  const list = vision.map(v => `<li>${v}</li>`).join('');
  $('#main').innerHTML = `<section class="about">
    <h1>About The Fold Within Earth</h1>
    <div class="markdown">
      <p>We’re building a canonical front door for a multi-track body of work:</p>
      <ul>${list}</ul>
    </div>
  </section>`;
  document.title = 'About — The Fold Within Earth';
}

function renderMud() {
  $('#main').innerHTML = `<section class="mud">
    <h1>MUD Portal</h1>
    <p>MUD portal coming soon.</p>
  </section>`;
  document.title = 'MUD — The Fold Within Earth';
}

async function renderStart() {
  const page = state.pages.find(p => p.file.endsWith('pages/start-here.md'));
  if (!page) {
    $('#main').innerHTML = `<p class="error">Start page not found.</p>`;
    return;
  }
  try {
    const res = await fetch(`content/${page.file}`);
    const md = (await res.text()).replace(/^---[\s\S]*?---/,'').trim();
    $('#main').innerHTML = `
      <section class="post">
        <div class="markdown">${sanitizeMarkdown(md)}</div>
      </section>`;
    document.title = `Start Here — The Fold Within Earth`;
  } catch (e) {
    $('#main').innerHTML = `<p class="error">⚠️ ${e.message}</p>`;
  }
}

function renderProgramsHome() {
  const cards = Object.entries(state.programTitles).map(([k, v]) => `<article data-slug="${k}" tabindex="0">
    <div class="thumb"></div>
    <h3>${escapeHTML(v)}</h3>
    <p class="date">Program</p>
    <p>Explore all posts and guidance for ${escapeHTML(v)}.</p>
  </article>`).join('');
  $('#main').innerHTML = `<section class="latest-all">
    <h2>Programs</h2>
    <div class="grid">${cards}</div>
  </section>`;
  document.title = `Programs — The Fold Within Earth`;
  addCardListeners();
}

async function renderProgramArchive(key, params) {
  if (!key) return render404();
  const title = state.programTitles[key] || key;
  const landing = state.pages.find(p => p.file.includes('pages/programs/') && (p.slug === key || p.title.toLowerCase().includes(key.toLowerCase())));
  let landingHtml = '';
  if (landing) {
    const res = await fetch(`content/${landing.file}`);
    const md = (await res.text()).replace(/^---[\s\S]*?---/,'').trim();
    landingHtml = `<div class="markdown">${sanitizeMarkdown(md)}</div>`;
  }
  const list = (state.byProgram.get(key) || []).sort((a,b)=>b.date.localeCompare(a.date));
  if (!list.length && !landingHtml) {
    $('#main').innerHTML = `<p class="error">No posts found for Program: ${escapeHTML(title)}.</p>`;
    return;
  }
  const cards = list.map(renderCard).join('');
  $('#main').innerHTML = `
    <section class="archive">
      <div class="breadcrumbs">${renderBreadcrumbs(['program', key])}</div>
      <h1>Program: ${escapeHTML(title)}</h1>
      ${landingHtml}
      <div class="grid">${cards}</div>
    </section>`;
  document.title = `Program — ${escapeHTML(title)} — The Fold Within Earth`;
  addCardListeners();
}

function render404() {
  $('#main').innerHTML = `<p class="error">⚠️ Page not found.</p>`;
}

function addCardListeners() {
  $('#main').addEventListener('click', e => {
    const article = e.target.closest('article[data-slug]');
    if (article) {
      location.hash = `/post/${article.dataset.slug}`;
    }
  });
  $('#main').addEventListener('keydown', e => {
    const article = e.target.closest('article[data-slug]');
    if (article && e.key === 'Enter') {
      location.hash = `/post/${article.dataset.slug}`;
    }
  });
}

function renderBreadcrumbs(pathParts) {
  let crumbs = `<a href="#/">Home</a>`;
  let currentPath = '';
  pathParts.forEach((part, i) => {
    currentPath += `/${part}`;
    let label = part.charAt(0).toUpperCase() + part.slice(1);
    if (state.sectionTitles[part]) label = state.sectionTitles[part];
    if (state.programTitles[part]) label = state.programTitles[part];
    crumbs += ` › <a href="#${currentPath}">${escapeHTML(label)}</a>`;
  });
  return `<nav class="breadcrumbs">${crumbs}</nav>`;
}

function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
