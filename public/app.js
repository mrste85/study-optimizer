// DOM Elements
const urlInput = document.getElementById('urlInput');
const fileInput = document.getElementById('fileInput');
const textInput = document.getElementById('textInput');
const textTitleInput = document.getElementById('textTitleInput');
const fileUploadLabel = document.querySelector('.file-upload-label');
const fileUploadText = document.getElementById('fileUploadText');
const processBtn = document.getElementById('processBtn');
const btnText = processBtn.querySelector('.btn-text');
const btnLoading = processBtn.querySelector('.btn-loading');
const errorMessage = document.getElementById('errorMessage');
const resultsSection = document.getElementById('resultsSection');
const articleTitle = document.getElementById('articleTitle');
const articleMeta = document.getElementById('articleMeta');
const tabs = document.querySelectorAll('.tab');
const tabPanels = document.querySelectorAll('.tab-panel');
const inputTabs = document.querySelectorAll('.input-tab');
const inputPanels = document.querySelectorAll('.input-panel');
const exportAnkiBtn = document.getElementById('exportAnkiBtn');

// Current input mode
let currentInputMode = 'url';
let selectedFile = null;

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

  // Input tab switching
  inputTabs.forEach((tab) => {
    tab.addEventListener('click', () => switchInputMode(tab.dataset.input));
  });

  // Output tab switching
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });

  // Copy buttons
  document.querySelectorAll('.copy-btn').forEach((btn) => {
    btn.addEventListener('click', () => handleCopy(btn.dataset.copy));
  });

  // File upload handling
  fileInput.addEventListener('change', handleFileSelect);

  // Drag and drop
  fileUploadLabel.addEventListener('dragover', (e) => {
    e.preventDefault();
    fileUploadLabel.classList.add('drag-over');
  });
  fileUploadLabel.addEventListener('dragleave', () => {
    fileUploadLabel.classList.remove('drag-over');
  });
  fileUploadLabel.addEventListener('drop', (e) => {
    e.preventDefault();
    fileUploadLabel.classList.remove('drag-over');
    const files = e.dataTransfer.files;
    if (files.length > 0 && files[0].type === 'application/pdf') {
      selectedFile = files[0];
      updateFileUploadUI();
    }
  });

  exportAnkiBtn.addEventListener('click', handleAnkiExport);
}

// Switch input mode (URL, File, Text)
function switchInputMode(mode) {
  currentInputMode = mode;

  inputTabs.forEach((tab) => {
    tab.classList.toggle('active', tab.dataset.input === mode);
  });

  document.getElementById('urlInputPanel').classList.toggle('hidden', mode !== 'url');
  document.getElementById('urlInputPanel').classList.toggle('active', mode === 'url');
  document.getElementById('fileInputPanel').classList.toggle('hidden', mode !== 'file');
  document.getElementById('fileInputPanel').classList.toggle('active', mode === 'file');
  document.getElementById('textInputPanel').classList.toggle('hidden', mode !== 'text');
  document.getElementById('textInputPanel').classList.toggle('active', mode === 'text');

  hideError();
}

// Handle file selection
function handleFileSelect(e) {
  const file = e.target.files[0];
  if (file && file.type === 'application/pdf') {
    selectedFile = file;
    updateFileUploadUI();
  }
}

function updateFileUploadUI() {
  if (selectedFile) {
    fileUploadText.textContent = selectedFile.name;
    fileUploadLabel.classList.add('has-file');
  } else {
    fileUploadText.textContent = 'Choose PDF file or drag & drop';
    fileUploadLabel.classList.remove('has-file');
  }
}

// Main processing function
async function handleProcess() {
  hideError();

  let extracted;

  try {
    if (currentInputMode === 'url') {
      extracted = await processUrl();
    } else if (currentInputMode === 'file') {
      extracted = await processFile();
    } else if (currentInputMode === 'text') {
      extracted = processText();
    }

    if (!extracted) return;

    setLoading(true);

    // Process with AI
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

// Process URL input
async function processUrl() {
  const url = urlInput.value.trim();

  if (!url) {
    showError('Please enter a URL');
    return null;
  }

  if (!isValidUrl(url)) {
    showError('Please enter a valid URL');
    return null;
  }

  setLoading(true);

  const extractResponse = await fetch('/api/extract', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });

  if (!extractResponse.ok) {
    const error = await extractResponse.json();
    throw new Error(error.error || 'Failed to extract content');
  }

  return await extractResponse.json();
}

// Process file upload
async function processFile() {
  if (!selectedFile) {
    showError('Please select a PDF file');
    return null;
  }

  setLoading(true);

  // Read file as base64
  const base64 = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(selectedFile);
  });

  const uploadResponse = await fetch('/api/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      file: base64,
      filename: selectedFile.name,
    }),
  });

  if (!uploadResponse.ok) {
    const error = await uploadResponse.json();
    throw new Error(error.error || 'Failed to process PDF');
  }

  return await uploadResponse.json();
}

// Process text input
function processText() {
  const text = textInput.value.trim();
  const title = textTitleInput.value.trim() || 'Pasted Content';

  if (!text) {
    showError('Please enter some text');
    return null;
  }

  if (text.length < 100) {
    showError('Please enter more content (at least 100 characters)');
    return null;
  }

  return {
    title: title,
    content: text,
    siteName: 'Pasted Text',
  };
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
