// DOM Elements
const urlInput = document.getElementById('urlInput');
const processBtn = document.getElementById('processBtn');
const btnText = processBtn.querySelector('.btn-text');
const btnLoading = processBtn.querySelector('.btn-loading');
const errorMessage = document.getElementById('errorMessage');
const resultsSection = document.getElementById('resultsSection');
const articleTitle = document.getElementById('articleTitle');
const articleMeta = document.getElementById('articleMeta');
const tabs = document.querySelectorAll('.tab');
const tabPanels = document.querySelectorAll('.tab-panel');
const exportAnkiBtn = document.getElementById('exportAnkiBtn');

// Store processed data
let currentData = {
  title: '',
  notes: '',
  flashcards: [],
  questions: [],
};

// Initialize
function init() {
  processBtn.addEventListener('click', handleProcess);
  urlInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleProcess();
  });

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });

  document.querySelectorAll('.copy-btn').forEach((btn) => {
    btn.addEventListener('click', () => handleCopy(btn.dataset.copy));
  });

  exportAnkiBtn.addEventListener('click', handleAnkiExport);
}

// Main processing function
async function handleProcess() {
  const url = urlInput.value.trim();

  if (!url) {
    showError('Please enter a URL');
    return;
  }

  if (!isValidUrl(url)) {
    showError('Please enter a valid URL');
    return;
  }

  setLoading(true);
  hideError();

  try {
    // Step 1: Extract content
    const extractResponse = await fetch('/api/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });

    if (!extractResponse.ok) {
      const error = await extractResponse.json();
      throw new Error(error.error || 'Failed to extract content');
    }

    const extracted = await extractResponse.json();

    // Step 2: Process with AI
    const processResponse = await fetch('/api/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: extracted.content,
        title: extracted.title,
      }),
    });

    if (!processResponse.ok) {
      const error = await processResponse.json();
      throw new Error(error.error || 'Failed to process content');
    }

    const processed = await processResponse.json();

    // Store data and display results
    currentData = {
      title: extracted.title,
      siteName: extracted.siteName,
      notes: processed.notes,
      flashcards: processed.flashcards,
      questions: processed.questions,
    };

    displayResults();
  } catch (error) {
    showError(error.message);
  } finally {
    setLoading(false);
  }
}

// Display results
function displayResults() {
  articleTitle.textContent = currentData.title;
  articleMeta.textContent = currentData.siteName || '';

  // Render notes (parse markdown-ish format)
  document.getElementById('notesContent').innerHTML = renderNotes(currentData.notes);

  // Render flashcards
  const flashcardsHtml = currentData.flashcards
    .map(
      (card) => `
      <div class="flashcard">
        <div class="flashcard-front">${escapeHtml(card.front)}</div>
        <div class="flashcard-back">${escapeHtml(card.back)}</div>
      </div>
    `
    )
    .join('');
  document.getElementById('flashcardsContent').innerHTML = flashcardsHtml;

  // Render questions
  const questionsHtml = currentData.questions
    .map(
      (q) => `
      <div class="question-item">
        <div class="question-text">${escapeHtml(q.question)}</div>
        ${q.hint ? `<div class="question-hint">${escapeHtml(q.hint)}</div>` : ''}
      </div>
    `
    )
    .join('');
  document.getElementById('questionsContent').innerHTML = questionsHtml;

  resultsSection.classList.remove('hidden');
  switchTab('notes');
}

// Render markdown-style notes to HTML
function renderNotes(notes) {
  const lines = notes.split('\n');
  let html = '';
  let listStack = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Count leading dashes or indentation to determine nesting
    const match = line.match(/^(\s*)-\s+(.+)$/);
    if (match) {
      const indent = match[1].length;
      const content = match[2];
      const level = Math.floor(indent / 2);

      // Close lists that are deeper than current
      while (listStack.length > level + 1) {
        html += '</ul>';
        listStack.pop();
      }

      // Open new lists as needed
      while (listStack.length <= level) {
        html += '<ul>';
        listStack.push(level);
      }

      html += `<li>${escapeHtml(content)}</li>`;
    } else if (trimmed.startsWith('#')) {
      // Handle headers
      const headerMatch = trimmed.match(/^(#+)\s+(.+)$/);
      if (headerMatch) {
        const level = Math.min(headerMatch[1].length, 4);
        const text = headerMatch[2];

        // Close any open lists
        while (listStack.length > 0) {
          html += '</ul>';
          listStack.pop();
        }

        html += `<h${level + 2}>${escapeHtml(text)}</h${level + 2}>`;
      }
    } else {
      // Close any open lists for plain text
      while (listStack.length > 0) {
        html += '</ul>';
        listStack.pop();
      }
      html += `<p>${escapeHtml(trimmed)}</p>`;
    }
  }

  // Close remaining lists
  while (listStack.length > 0) {
    html += '</ul>';
    listStack.pop();
  }

  return html || '<p>No notes generated</p>';
}

// Tab switching
function switchTab(tabName) {
  tabs.forEach((tab) => {
    tab.classList.toggle('active', tab.dataset.tab === tabName);
  });

  tabPanels.forEach((panel) => {
    panel.classList.toggle('hidden', panel.id !== `${tabName}Tab`);
    panel.classList.toggle('active', panel.id === `${tabName}Tab`);
  });
}

// Copy functionality
async function handleCopy(type) {
  let text = '';

  switch (type) {
    case 'notes':
      text = currentData.notes;
      break;
    case 'flashcards':
      text = currentData.flashcards.map((c) => `Q: ${c.front}\nA: ${c.back}`).join('\n\n');
      break;
    case 'questions':
      text = currentData.questions.map((q) => `${q.question}\n(Hint: ${q.hint})`).join('\n\n');
      break;
  }

  try {
    await navigator.clipboard.writeText(text);
    const btn = document.querySelector(`[data-copy="${type}"]`);
    const originalText = btn.textContent;
    btn.textContent = 'Copied!';
    setTimeout(() => (btn.textContent = originalText), 2000);
  } catch {
    showError('Failed to copy to clipboard');
  }
}

// Anki export
async function handleAnkiExport() {
  if (!currentData.flashcards.length) {
    showError('No flashcards to export');
    return;
  }

  try {
    const response = await fetch('/api/anki', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        flashcards: currentData.flashcards,
        deckName: currentData.title || 'Study Optimizer Deck',
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to generate Anki deck');
    }

    // Download the file
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${sanitizeFilename(currentData.title || 'deck')}.apkg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (error) {
    showError(error.message);
  }
}

// Utility functions
function setLoading(loading) {
  processBtn.disabled = loading;
  btnText.classList.toggle('hidden', loading);
  btnLoading.classList.toggle('hidden', !loading);
}

function showError(message) {
  errorMessage.textContent = message;
  errorMessage.classList.remove('hidden');
}

function hideError() {
  errorMessage.classList.add('hidden');
}

function isValidUrl(string) {
  try {
    const url = new URL(string);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function sanitizeFilename(name) {
  return name.replace(/[^a-z0-9]/gi, '_').substring(0, 50);
}

// Start the app
init();
