const { Readability } = require('@mozilla/readability');
const { JSDOM } = require('jsdom');
const pdfParse = require('pdf-parse');

function isPdfUrl(url, contentType) {
  const urlLower = url.toLowerCase();
  if (urlLower.endsWith('.pdf')) return true;
  if (contentType && contentType.includes('application/pdf')) return true;
  return false;
}

async function extractFromPdf(buffer, url) {
  const data = await pdfParse(buffer);

  // Extract filename from URL for title
  const urlPath = new URL(url).pathname;
  const filename = urlPath.split('/').pop() || 'PDF Document';
  const title = decodeURIComponent(filename.replace('.pdf', '').replace(/-|_/g, ' '));

  return {
    title: title,
    content: data.text,
    excerpt: data.text.substring(0, 200) + '...',
    byline: null,
    siteName: new URL(url).hostname,
    length: data.text.length,
    pageCount: data.numpages,
  };
}

async function extractFromHtml(html, url) {
  const dom = new JSDOM(html, { url });
  const document = dom.window.document;

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

async function extractContent(url) {
  // Validate URL
  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error('Invalid URL format');
  }

  // Fetch the resource
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; StudyOptimizer/1.0)',
      'Accept': 'text/html,application/xhtml+xml,application/xml,application/pdf;q=0.9,*/*;q=0.8',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
  }

  const contentType = response.headers.get('content-type') || '';

  // Check if it's a PDF
  if (isPdfUrl(url, contentType)) {
    const buffer = Buffer.from(await response.arrayBuffer());
    return extractFromPdf(buffer, url);
  }

  // Otherwise treat as HTML
  const html = await response.text();
  return extractFromHtml(html, url);
}

module.exports = { extractContent };
