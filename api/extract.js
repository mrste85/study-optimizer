const { extractContent } = require('./_lib/extractor');

module.exports = async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    const content = await extractContent(url);
    res.json(content);
  } catch (error) {
    console.error('Extraction error:', error);
    res.status(500).json({ error: error.message || 'Failed to extract content' });
  }
};
