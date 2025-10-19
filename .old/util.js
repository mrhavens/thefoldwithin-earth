function slugify(s) {
  return s.toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').replace(/-+/g, '-');
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-US', {year: 'numeric', month: 'long', day: 'numeric'});
}

function getQueryParams() {
  const hash = location.hash.slice(1);
  const [path, queryString] = hash.split('?');
  const params = new URLSearchParams(queryString);
  return {path, parts: path.split('/').filter(Boolean), params};
}

function updateHash(baseParts, newParams = {}) {
  const base = baseParts.join('/');
  const searchParams = new URLSearchParams();
  Object.entries(newParams).forEach(([key, value]) => {
    if (value !== undefined && value !== '') searchParams.set(key, value);
  });
  const query = searchParams.toString();
  location.hash = `/${base}${query ? '?' + query : ''}`;
}
