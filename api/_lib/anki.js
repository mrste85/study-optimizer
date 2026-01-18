const initSqlJs = require('sql.js');

// Simple zip implementation for creating .apkg files
function createZip(files) {
  const entries = [];

  for (const [name, data] of Object.entries(files)) {
    const fileData = typeof data === 'string' ? Buffer.from(data) : data;
    entries.push({ name, data: fileData });
  }

  // Build ZIP file manually (simplified, uncompressed for compatibility)
  const chunks = [];
  const centralDirectory = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBuffer = Buffer.from(entry.name);
    const localHeader = Buffer.alloc(30 + nameBuffer.length);

    // Local file header signature
    localHeader.writeUInt32LE(0x04034b50, 0);
    // Version needed
    localHeader.writeUInt16LE(20, 4);
    // General purpose flags
    localHeader.writeUInt16LE(0, 6);
    // Compression method (0 = stored)
    localHeader.writeUInt16LE(0, 8);
    // Mod time/date
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0, 12);
    // CRC32
    const crc = crc32(entry.data);
    localHeader.writeUInt32LE(crc, 14);
    // Compressed size
    localHeader.writeUInt32LE(entry.data.length, 18);
    // Uncompressed size
    localHeader.writeUInt32LE(entry.data.length, 22);
    // Filename length
    localHeader.writeUInt16LE(nameBuffer.length, 26);
    // Extra field length
    localHeader.writeUInt16LE(0, 28);
    // Filename
    nameBuffer.copy(localHeader, 30);

    chunks.push(localHeader);
    chunks.push(entry.data);

    // Central directory entry
    const centralEntry = Buffer.alloc(46 + nameBuffer.length);
    centralEntry.writeUInt32LE(0x02014b50, 0);
    centralEntry.writeUInt16LE(20, 4);
    centralEntry.writeUInt16LE(20, 6);
    centralEntry.writeUInt16LE(0, 8);
    centralEntry.writeUInt16LE(0, 10);
    centralEntry.writeUInt16LE(0, 12);
    centralEntry.writeUInt16LE(0, 14);
    centralEntry.writeUInt32LE(crc, 16);
    centralEntry.writeUInt32LE(entry.data.length, 20);
    centralEntry.writeUInt32LE(entry.data.length, 24);
    centralEntry.writeUInt16LE(nameBuffer.length, 28);
    centralEntry.writeUInt16LE(0, 30);
    centralEntry.writeUInt16LE(0, 32);
    centralEntry.writeUInt16LE(0, 34);
    centralEntry.writeUInt16LE(0, 36);
    centralEntry.writeUInt32LE(0, 38);
    centralEntry.writeUInt32LE(offset, 42);
    nameBuffer.copy(centralEntry, 46);

    centralDirectory.push(centralEntry);
    offset += localHeader.length + entry.data.length;
  }

  const centralDirOffset = offset;
  let centralDirSize = 0;

  for (const entry of centralDirectory) {
    chunks.push(entry);
    centralDirSize += entry.length;
  }

  // End of central directory
  const endRecord = Buffer.alloc(22);
  endRecord.writeUInt32LE(0x06054b50, 0);
  endRecord.writeUInt16LE(0, 4);
  endRecord.writeUInt16LE(0, 6);
  endRecord.writeUInt16LE(entries.length, 8);
  endRecord.writeUInt16LE(entries.length, 10);
  endRecord.writeUInt32LE(centralDirSize, 12);
  endRecord.writeUInt32LE(centralDirOffset, 16);
  endRecord.writeUInt16LE(0, 20);

  chunks.push(endRecord);

  return Buffer.concat(chunks);
}

// CRC32 implementation
function crc32(data) {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }

  let crc = 0xFFFFFFFF;
  for (let i = 0; i < data.length; i++) {
    crc = table[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function generateId() {
  return Date.now() + Math.floor(Math.random() * 1000);
}

async function generateAnkiDeck(flashcards, deckName) {
  const SQL = await initSqlJs();
  const db = new SQL.Database();

  // Create Anki schema
  db.run(`
    CREATE TABLE col (
      id INTEGER PRIMARY KEY,
      crt INTEGER NOT NULL,
      mod INTEGER NOT NULL,
      scm INTEGER NOT NULL,
      ver INTEGER NOT NULL,
      dty INTEGER NOT NULL,
      usn INTEGER NOT NULL,
      ls INTEGER NOT NULL,
      conf TEXT NOT NULL,
      models TEXT NOT NULL,
      decks TEXT NOT NULL,
      dconf TEXT NOT NULL,
      tags TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE notes (
      id INTEGER PRIMARY KEY,
      guid TEXT NOT NULL,
      mid INTEGER NOT NULL,
      mod INTEGER NOT NULL,
      usn INTEGER NOT NULL,
      tags TEXT NOT NULL,
      flds TEXT NOT NULL,
      sfld TEXT NOT NULL,
      csum INTEGER NOT NULL,
      flags INTEGER NOT NULL,
      data TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE cards (
      id INTEGER PRIMARY KEY,
      nid INTEGER NOT NULL,
      did INTEGER NOT NULL,
      ord INTEGER NOT NULL,
      mod INTEGER NOT NULL,
      usn INTEGER NOT NULL,
      type INTEGER NOT NULL,
      queue INTEGER NOT NULL,
      due INTEGER NOT NULL,
      ivl INTEGER NOT NULL,
      factor INTEGER NOT NULL,
      reps INTEGER NOT NULL,
      lapses INTEGER NOT NULL,
      left INTEGER NOT NULL,
      odue INTEGER NOT NULL,
      odid INTEGER NOT NULL,
      flags INTEGER NOT NULL,
      data TEXT NOT NULL
    )
  `);

  db.run(`CREATE TABLE revlog (id INTEGER PRIMARY KEY, cid INTEGER, usn INTEGER, ease INTEGER, ivl INTEGER, lastIvl INTEGER, factor INTEGER, time INTEGER, type INTEGER)`);
  db.run(`CREATE TABLE graves (usn INTEGER, oid INTEGER, type INTEGER)`);

  const now = Math.floor(Date.now() / 1000);
  const deckId = generateId();
  const modelId = generateId();

  const models = {
    [modelId]: {
      id: modelId,
      name: 'Basic',
      type: 0,
      mod: now,
      usn: -1,
      sortf: 0,
      did: deckId,
      tmpls: [{
        name: 'Card 1',
        ord: 0,
        qfmt: '{{Front}}',
        afmt: '{{FrontSide}}<hr id="answer">{{Back}}',
        bqfmt: '',
        bafmt: '',
        did: null,
        bfont: '',
        bsize: 0,
      }],
      flds: [
        { name: 'Front', ord: 0, sticky: false, rtl: false, font: 'Arial', size: 20, media: [] },
        { name: 'Back', ord: 1, sticky: false, rtl: false, font: 'Arial', size: 20, media: [] },
      ],
      css: '.card { font-family: arial; font-size: 20px; text-align: center; color: black; background-color: white; }',
      latexPre: '',
      latexPost: '',
      latexsvg: false,
      req: [[0, 'all', [0]]],
      tags: [],
      vers: [],
    },
  };

  const decks = {
    1: { id: 1, name: 'Default', mod: now, usn: -1, lrnToday: [0, 0], revToday: [0, 0], newToday: [0, 0], timeToday: [0, 0], collapsed: false, desc: '' },
    [deckId]: { id: deckId, name: deckName, mod: now, usn: -1, lrnToday: [0, 0], revToday: [0, 0], newToday: [0, 0], timeToday: [0, 0], collapsed: false, desc: '' },
  };

  const dconf = {
    1: { id: 1, name: 'Default', new: { delays: [1, 10], ints: [1, 4, 7], initialFactor: 2500, order: 1, perDay: 20 }, rev: { perDay: 200, ease4: 1.3, fuzz: 0.05, minSpace: 1, ivlFct: 1, maxIvl: 36500 }, lapse: { delays: [10], mult: 0, minInt: 1, leechFails: 8, leechAction: 0 }, maxTaken: 60, timer: 0, autoplay: true, replayq: true, mod: 0, usn: 0 },
  };

  const conf = { nextPos: 1, estTimes: true, activeDecks: [1], sortType: 'noteFld', timeLim: 0, sortBackwards: false, addToCur: true, curDeck: deckId, newSpread: 0, dueCounts: true, curModel: modelId, collapseTime: 1200 };

  db.run(
    `INSERT INTO col VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [1, now, now * 1000, now * 1000, 11, 0, 0, 0, JSON.stringify(conf), JSON.stringify(models), JSON.stringify(decks), JSON.stringify(dconf), '{}']
  );

  flashcards.forEach((card, index) => {
    const noteId = generateId() + index;
    const cardId = generateId() + index + 1000;
    const guid = Buffer.from(noteId.toString()).toString('base64').substring(0, 10);
    const flds = `${card.front}\x1f${card.back}`;
    const csum = card.front.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % 2147483647;

    db.run(
      `INSERT INTO notes VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [noteId, guid, modelId, now, -1, '', flds, card.front, csum, 0, '']
    );

    db.run(
      `INSERT INTO cards VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [cardId, noteId, deckId, 0, now, -1, 0, 0, index + 1, 0, 0, 0, 0, 0, 0, 0, 0, '']
    );
  });

  const dbData = db.export();
  db.close();

  const zipBuffer = createZip({
    'collection.anki2': Buffer.from(dbData),
    'media': '{}',
  });

  return zipBuffer;
}

module.exports = { generateAnkiDeck };
