const pdfParse = require('pdf-parse');

// Vercel automatically parses multipart form data
// But for base64 encoded files sent as JSON, we handle it here
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { file, filename } = req.body;

    if (!file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    // File is sent as base64
    const buffer = Buffer.from(file, 'base64');

    // Parse PDF
    const data = await pdfParse(buffer);

    // Extract title from filename
    const title = filename
      ? decodeURIComponent(filename.replace('.pdf', '').replace(/-|_/g, ' '))
      : 'PDF Document';

    res.json({
      title: title,
      content: data.text,
      excerpt: data.text.substring(0, 200) + '...',
      byline: null,
      siteName: 'Uploaded PDF',
      length: data.text.length,
      pageCount: data.numpages,
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: error.message || 'Failed to process PDF' });
  }
};
