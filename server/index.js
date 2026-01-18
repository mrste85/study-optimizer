const express = require('express');
const path = require('path');
const pdfParse = require('pdf-parse');
const { extractContent } = require('../api/_lib/extractor');
const { processContent } = require('../api/_lib/processor');
const { generateAnkiDeck } = require('../api/_lib/anki');

const app = express();
const PORT = process.env.PORT || 3000;

// Increase limit for PDF uploads (base64 encoded)
app.use(express.json({ limit: '50mb' }));
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

// Upload and process PDF file
app.post('/api/upload', async (req, res) => {
  try {
    const { file, filename } = req.body;

    if (!file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const buffer = Buffer.from(file, 'base64');
    const data = await pdfParse(buffer);

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
