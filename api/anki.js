const { generateAnkiDeck } = require('./_lib/anki');

module.exports = async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

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
};
