const express = require('express');
const path = require('path');
const { extractContent } = require('../api/_lib/extractor');
const { processContent } = require('../api/_lib/processor');
const { generateAnkiDeck } = require('../api/_lib/anki');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Extract content from URL
app.post('/api/extract', async (req, res) => {
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
});

// Process content with Claude
app.post('/api/process', async (req, res) => {
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
});

// Generate Anki deck
app.post('/api/anki', async (req, res) => {
  try {
    const { flashcards, deckName } = req.body;

    if (!flashcards || !Array.isArray(flashcards)) {
      return res.status(400).json({ error: 'Flashcards array is required' });
    }

    const deckBuffer = await generateAnkiDeck(flashcards, deckName || 'Study Optimizer Deck');

    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${deckName || 'deck'}.apkg"`);
    res.send(deckBuffer);
  } catch (error) {
    console.error('Anki export error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate Anki deck' });
  }
});

app.listen(PORT, () => {
  console.log(`Study Optimizer running at http://localhost:${PORT}`);
});
