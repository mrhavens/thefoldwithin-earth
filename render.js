function renderPill(type, value, extra = '') {
  return `<span class="pill ${type}" ${extra}>${escapeHTML(value)}</span>`;
}

function renderCard(p, matches = []) {
  const coverStyle = p.cover ? `style="background-image:url(${p.cover}); background-size:cover;"` : '';
  let excerpt = p.excerpt;
  if (matches.length) {
    const terms = new Set(matches.flatMap(m => m.indices.map(i => excerpt.slice(i[0], i[1] + 1))));
    terms.forEach(t => {
      excerpt = excerpt.replace(new RegExp(escapeRegExp(t), 'gi'), `<mark>${t}</mark>`);
    });
  }
  const programPills = (p.programs || []).map(pr => renderPill('program', state.programTitles[pr] || pr)).join('');
  return `<article data-slug="${p.slug}" tabindex="0">
    <div class="thumb" ${coverStyle}></div>
    <h3>${escapeHTML(p.title)}</h3>
    ${renderPill('section', state.sectionTitles[p.section] || p.section)}
    ${programPills}
    <p class="date">${formatDate(p.date)}</p>
    <p>${excerpt}</p>
  </article>`;
}

function renderPager(currentPage, totalPages, baseParts, currentParams) {
  if (totalPages <= 1) return '';
  let buttons = '';
  if (currentPage > 1) buttons += `<button data-action="prev">Previous</button>`;
  buttons += `<span>Page ${currentPage} of ${totalPages}</span>`;
  if (currentPage < totalPages) buttons += `<button data-action="next">Next</button>`;
  return `<div class="pager">${buttons}</div>`;
}

function renderControls(sort, baseParts, currentParams) {
  return `<div class="controls">
    <label for="sort-select">Sort by:</label>
    <select id="sort-select">
      <option value="desc" ${sort === 'desc' ? 'selected' : ''}>Newest First</option>
      <option value="asc" ${sort === 'asc' ? 'selected' : ''}>Oldest First</option>
    </select>
  </div>`;
}

function renderFilters(availableTags, activeTags, baseParts, currentParams) {
  const tagPills = availableTags.sort().map(t => `<span class="pill tag${activeTags.includes(t) ? ' active' : ''}" data-tag="${t}">${escapeHTML(t)}</span>`).join('');
  return `<div class="filters">
    <h4>Filter by Tag</h4>
    <div class="tag-cloud">${tagPills}</div>
  </div>`;
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
