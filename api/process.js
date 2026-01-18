const { processContent } = require('./_lib/processor');

module.exports = async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { content, title } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }

    const result = await processContent(content, title);
    res.json(result);
  } catch (error) {
    console.error('Processing error:', error);
    res.status(500).json({ error: error.message || 'Failed to process content' });
  }
};
