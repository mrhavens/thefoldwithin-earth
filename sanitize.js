DOMPurify.setConfig({ FORBID_TAGS: ['form', 'input', 'button', 'iframe', 'object'], FORBID_ATTR: ['onerror','onload','onclick','onmouseover','onfocus','srcdoc'], ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i });

function sanitizeMarkdown(md) {
  const html = marked.parse(md);
  return DOMPurify.sanitize(html);
}
