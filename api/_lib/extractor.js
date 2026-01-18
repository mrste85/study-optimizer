const { Readability } = require('@mozilla/readability');
const { JSDOM } = require('jsdom');

async function extractContent(url) {
  // Validate URL
  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error('Invalid URL format');
  }

  // Fetch the page
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; StudyOptimizer/1.0)',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();

  // Parse with JSDOM
  const dom = new JSDOM(html, { url });
  const document = dom.window.document;

  // Extract with Readability
  const reader = new Readability(document);
  const article = reader.parse();

  if (!article) {
    throw new Error('Could not extract content from this page. It may not be an article.');
  }

  return {
    title: article.title || 'Untitled',
    content: article.textContent,
    excerpt: article.excerpt,
    byline: article.byline,
    siteName: article.siteName,
    length: article.length,
  };
}

module.exports = { extractContent };
