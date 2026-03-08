/* =============================================
   HANGMAN — Word Duel Arena | script.js
   ============================================= */

// =============================================
// WORD BANK
// =============================================
const WORDS = {
  General: {
    easy:   ['CAT','DOG','SUN','MOON','TREE','FISH','BIRD','CAKE','BOOK','STAR'],
    medium: ['GUITAR','PLANET','WINDOW','SHADOW','BRIDGE','CASTLE','JUNGLE','ROCKET','PUZZLE','CANDLE'],
    hard:   ['ALGORITHM','JAVASCRIPT','PHILANTHROPY','INFRASTRUCTURE','KALEIDOSCOPE','METAMORPHOSIS']
  },
  Movies: {
    easy:   ['STAR','HERO','FILM','ROLE','CAST'],
    medium: ['AVATAR','MATRIX','FROZEN','JAWS','TITANIC','SHINING','HAMLET','PSYCHO'],
    hard:   ['INTERSTELLAR','PARASITE','INCEPTION','SCHINDLERSLST','GLADIATOR','APOCALYPSE']
  },
  Science: {
    easy:   ['ATOM','CELL','GENE','MASS','ACID'],
    medium: ['PHOTON','PROTON','NEWTON','OSMOSIS','GRAVITY','NUCLEUS','ENZYME','PLASMA'],
    hard:   ['MITOCHONDRIA','THERMODYNAMICS','BIOLUMINESCENCE','PHOTOSYNTHESIS','CHROMOSOME']
  },
  Coding: {
    easy:   ['LOOP','CODE','NULL','BOOL','ARRAY'],
    medium: ['PYTHON','FUNCTION','BOOLEAN','POINTER','RUNTIME','CLOSURE','PROMISE'],
    hard:   ['RECURSION','ALGORITHM','POLYMORPHISM','ENCAPSULATION','INHERITANCE','TYPESCRIPT']
  },
  Animals: {
    easy:   ['CAT','DOG','ANT','COW','OWL','BEE'],
    medium: ['JAGUAR','FALCON','WALRUS','PYTHON','PARROT','BADGER','IGUANA'],
    hard:   ['PLATYPUS','CHAMELEON','SALAMANDER','ORANGUTAN','WOLVERINE','RHINOCEROS']
  },
  Geography: {
    easy:   ['LAKE','HILL','CAPE','DUNE','REEF'],
    medium: ['AMAZON','SAHARA','TUNDRA','CANYON','GLACIER','MONSOON','PLATEAU'],
    hard:   ['ARCHIPELAGO','MEDITERRANEAN','STRATOSPHERE','MESOPOTAMIA','KILIMANJARO']
  }
};

// IDs of the hangman SVG body-part elements, in reveal order
const HANGMAN_PARTS = ['h-head', 'h-body', 'h-la', 'h-ra', 'h-ll', 'h-rl'];
const MAX_WRONG = 6;

// =============================================
// GAME STATE
// =============================================
let state = {
  mode:          'solo',
  category:      'General',
  difficulty:    'easy',
  word:          '',
  guessed:       new Set(),
  wrongGuesses:  0,
  gameActive:    false,
  p1name:        'Player',
  p2name:        'Player 2',
  currentPlayer: 0,
  scores:        [0, 0],
  sessionWins:   0,
  sessionLosses: 0,
  streak:        0,
  recentGames:   []
};

// =============================================
// LOCAL STORAGE HELPERS
// =============================================
function loadStorage(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}

function saveStorage(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}

// =============================================
// NAVIGATION
// =============================================
function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-links a').forEach(a => a.classList.remove('active'));
  document.getElementById('page-' + id).classList.add('active');
  document.getElementById('nav-' + id).classList.add('active');

  if (id === 'leaderboard') renderLeaderboard();
  if (id === 'forum')       renderForum();
  if (id === 'home')        updateHomeStats();
}

// =============================================
// SETTINGS CONTROLS
// =============================================
function setMode(mode, btn) {
  state.mode = mode;
  document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('mp-setup').classList.toggle('visible', mode === 'multi');
}

function setCategory(cat, btn) {
  state.category = cat;
  document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

function setDiff(diff, btn) {
  state.difficulty = diff;
  document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

// =============================================
// CORE GAME LOGIC
// =============================================

/** Pick a random word and reset all game state */
function startGame() {
  const wordPool = WORDS[state.category][state.difficulty];
  state.word          = wordPool[Math.floor(Math.random() * wordPool.length)];
  state.guessed       = new Set();
  state.wrongGuesses  = 0;
  state.gameActive    = true;
  state.currentPlayer = 0;

  if (state.mode === 'multi') {
    state.p1name = document.getElementById('p1name').value.trim() || 'Player 1';
    state.p2name = document.getElementById('p2name').value.trim() || 'Player 2';
    state.scores = [0, 0];
  }

  renderAll();
  document.getElementById('game-overlay').classList.remove('show');
  showToast('▷ Game started! Guess the word.', '');
}

/** Handle a letter-button click or keyboard press */
function guessLetter(letter) {
  if (!state.gameActive) { showToast('Start a new game first!', 'error'); return; }
  if (state.guessed.has(letter)) return;

  state.guessed.add(letter);
  const btn = document.getElementById('btn-' + letter);

  if (state.word.includes(letter)) {
    btn.classList.add('correct');
    checkWin();
  } else {
    btn.classList.add('wrong');
    state.wrongGuesses++;
    showHangmanPart(state.wrongGuesses - 1);
    document.getElementById('attempts-left').textContent = MAX_WRONG - state.wrongGuesses;
    updateWrongLetters();
    if (state.wrongGuesses >= MAX_WRONG) triggerLoss();
  }

  btn.disabled = true;
  renderWordDisplay();
}

/** Check whether all letters have been revealed */
function checkWin() {
  const allRevealed = [...state.word].every(c => state.guessed.has(c));
  if (allRevealed) triggerWin();
}

/** Player wins */
function triggerWin() {
  state.gameActive = false;
  const score = calculateScore();

  if (state.mode === 'multi') {
    state.scores[state.currentPlayer] += score;
  }

  state.sessionWins++;
  state.streak++;
  updateSessionStats();
  saveScore(
    state.mode === 'multi' ? [state.p1name, state.p2name][state.currentPlayer] : 'Player',
    score,
    true
  );
  addRecentGame(state.word, true, score);

  document.getElementById('overlay-status').className = 'overlay-status win';
  document.getElementById('overlay-status').textContent = '⚡ YOU WIN!';
  document.getElementById('overlay-word').textContent   = state.word;
  document.getElementById('overlay-score-msg').textContent = `+${score} points earned!`;
  document.getElementById('game-overlay').classList.add('show');
  updateScoreCards();
  updateSideStats();
}

/** Player loses */
function triggerLoss() {
  state.gameActive   = false;
  state.sessionLosses++;
  state.streak       = 0;
  updateSessionStats();
  addRecentGame(state.word, false, 0);

  // Reveal the full word
  [...state.word].forEach(l => state.guessed.add(l));
  renderWordDisplay();

  document.getElementById('overlay-status').className = 'overlay-status lose';
  document.getElementById('overlay-status').textContent = '☠ GAME OVER';
  document.getElementById('overlay-word').textContent   = state.word;
  document.getElementById('overlay-score-msg').textContent = 'Better luck next time!';
  document.getElementById('game-overlay').classList.add('show');
  updateSideStats();
}

/** Points = base difficulty score + bonus for each remaining attempt */
function calculateScore() {
  const base  = { easy: 100, medium: 200, hard: 400 }[state.difficulty];
  const bonus = (MAX_WRONG - state.wrongGuesses) * 20;
  return base + bonus;
}

/** Close the result overlay and start a fresh game */
function closeOverlayAndRestart() {
  document.getElementById('game-overlay').classList.remove('show');
  startGame();
}

// =============================================
// RENDER FUNCTIONS
// =============================================

/** Full render after a new game starts */
function renderAll() {
  buildAlphabet();
  renderWordDisplay();
  resetHangman();
  updateWrongLetters();
  updateScoreCards();
  updateSideStats();
  document.getElementById('word-category-hint').textContent = `Category: ${state.category}`;
  document.getElementById('attempts-left').textContent      = MAX_WRONG;
  document.getElementById('word-hint').textContent =
    `${state.word.length} letters • ${state.category} • ${state.difficulty.charAt(0).toUpperCase() + state.difficulty.slice(1)}`;
}

/** Build the A–Z clickable alphabet grid */
function buildAlphabet() {
  const grid = document.getElementById('alphabet-grid');
  grid.innerHTML = '';
  for (let i = 65; i <= 90; i++) {
    const letter = String.fromCharCode(i);
    const btn    = document.createElement('button');
    btn.className = 'letter-btn';
    btn.id        = 'btn-' + letter;
    btn.textContent = letter;
    btn.onclick   = () => guessLetter(letter);
    grid.appendChild(btn);
  }
}

/** Render hidden / revealed letter slots */
function renderWordDisplay() {
  const display = document.getElementById('word-display');
  display.innerHTML = '';
  [...state.word].forEach(char => {
    const slot = document.createElement('div');
    if (char === ' ') {
      slot.className = 'letter-slot space';
    } else {
      const revealed = state.guessed.has(char);
      slot.className   = 'letter-slot' + (revealed ? ' revealed' : '');
      slot.textContent = revealed ? char : '';
    }
    display.appendChild(slot);
  });
}

/** Hide all hangman body parts */
function resetHangman() {
  HANGMAN_PARTS.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('shown');
  });
}

/** Show the nth hangman body part */
function showHangmanPart(idx) {
  const el = document.getElementById(HANGMAN_PARTS[idx]);
  if (el) el.classList.add('shown');
}

/** Update the wrong-letters display on the right panel */
function updateWrongLetters() {
  const wrongs = [...state.guessed].filter(l => !state.word.includes(l));
  document.getElementById('wrong-letters').textContent = wrongs.length ? wrongs.join('  ') : '—';
}

/** Re-render the score card(s) in the left panel */
function updateScoreCards() {
  const cards = document.getElementById('score-cards');
  if (state.mode === 'solo') {
    cards.innerHTML = `
      <div class="score-card active-player" id="sc-p1">
        <span class="player-name">Player</span>
        <span class="player-score">${state.scores[0]}</span>
      </div>`;
    document.getElementById('turn-indicator').classList.remove('visible');
  } else {
    const p1 = state.p1name || 'Player 1';
    const p2 = state.p2name || 'Player 2';
    cards.innerHTML = `
      <div class="score-card ${state.currentPlayer === 0 ? 'active-player' : ''}">
        <span class="player-name">${p1}</span>
        <span class="player-score">${state.scores[0]}</span>
      </div>
      <div class="score-card ${state.currentPlayer === 1 ? 'active-player' : ''}">
        <span class="player-name">${p2}</span>
        <span class="player-score">${state.scores[1]}</span>
      </div>`;
    const ti = document.getElementById('turn-indicator');
    ti.classList.add('visible');
    ti.textContent = `${[p1, p2][state.currentPlayer]}'s Turn`;
  }
}

/** Update the right-panel W/L/Streak counters */
function updateSideStats() {
  document.getElementById('stat-win-disp').textContent    = state.sessionWins;
  document.getElementById('stat-lose-disp').textContent   = state.sessionLosses;
  document.getElementById('stat-streak-disp').textContent = state.streak;
  renderRecentGames();
}

function updateSessionStats() {
  document.getElementById('stat-win-disp').textContent    = state.sessionWins;
  document.getElementById('stat-lose-disp').textContent   = state.sessionLosses;
  document.getElementById('stat-streak-disp').textContent = state.streak;
}

/** Push a completed game into the recent-games list (max 5) */
function addRecentGame(word, won, score) {
  state.recentGames.unshift({ word, won, score });
  if (state.recentGames.length > 5) state.recentGames.pop();
  renderRecentGames();
}

/** Render the last-5-games list in the right panel */
function renderRecentGames() {
  const el = document.getElementById('recent-games');
  if (!state.recentGames.length) {
    el.innerHTML = '<div class="empty-state" style="padding:1rem;">No games yet</div>';
    return;
  }
  el.innerHTML = state.recentGames.map(g => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:0.4rem 0;border-bottom:1px solid var(--border);">
      <span style="color:${g.won ? 'var(--correct)' : 'var(--wrong)'};">${g.won ? '✓' : '✗'}</span>
      <span style="font-family:'Space Mono',monospace;font-size:0.68rem;color:var(--text);letter-spacing:0.05em;">${g.word}</span>
      <span style="font-family:'Bebas Neue',sans-serif;font-size:1rem;color:var(--accent);">+${g.score}</span>
    </div>`).join('');
}

// =============================================
// LEADERBOARD
// =============================================

/** Persist a player's score to localStorage */
function saveScore(name, score, won) {
  let lb       = loadStorage('hangman_lb', []);
  const existing = lb.find(e => e.name === name);
  if (existing) {
    existing.score += score;
    existing.games++;
    if (won) existing.wins++;
  } else {
    lb.push({ name, score, games: 1, wins: won ? 1 : 0 });
  }
  saveStorage('hangman_lb', lb);

  // Update global stats (games played, wins, unique players)
  let stats = loadStorage('hangman_stats', { games: 0, wins: 0, players: 0 });
  stats.games++;
  if (won) stats.wins++;
  const names = loadStorage('hangman_players', []);
  if (!names.includes(name)) {
    names.push(name);
    saveStorage('hangman_players', names);
    stats.players = names.length;
  }
  saveStorage('hangman_stats', stats);
}

/** Render the full leaderboard table */
function renderLeaderboard() {
  let lb = loadStorage('hangman_lb', []);
  lb.sort((a, b) => b.score - a.score);
  const tbody = document.getElementById('lb-body');

  if (!lb.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No scores yet. Play some games!</td></tr>';
    return;
  }

  tbody.innerHTML = lb.map((e, i) => {
    const rankClass = i === 0 ? 'lb-rank-1' : i === 1 ? 'lb-rank-2' : i === 2 ? 'lb-rank-3' : '';
    const medal     = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1;
    const wr        = e.games ? Math.round((e.wins / e.games) * 100) : 0;
    const badge     = e.score >= 1000
      ? '<span class="lb-badge badge-legend">Legend</span>'
      : e.score >= 400
        ? '<span class="lb-badge badge-pro">Pro</span>'
        : '<span class="lb-badge badge-novice">Novice</span>';
    return `
      <tr>
        <td class="lb-rank ${rankClass}">${medal}</td>
        <td class="lb-name">${e.name}</td>
        <td class="lb-score">${e.score}</td>
        <td style="font-family:'Space Mono',monospace;font-size:0.75rem;">${e.games}</td>
        <td style="font-family:'Space Mono',monospace;font-size:0.75rem;">${wr}%</td>
        <td>${badge}</td>
      </tr>`;
  }).join('');
}

/** Wipe all leaderboard data from localStorage */
function clearLeaderboard() {
  if (confirm('Clear all leaderboard data?')) {
    saveStorage('hangman_lb', []);
    saveStorage('hangman_stats', { games: 0, wins: 0, players: 0 });
    saveStorage('hangman_players', []);
    renderLeaderboard();
    updateHomeStats();
    showToast('Leaderboard cleared.', '');
  }
}

/** Populate the home-page stats counters */
function updateHomeStats() {
  const stats = loadStorage('hangman_stats', { games: 0, wins: 0, players: 0 });
  document.getElementById('stat-games').textContent   = stats.games;
  document.getElementById('stat-wins').textContent    = stats.wins;
  document.getElementById('stat-players').textContent = stats.players;
}

// =============================================
// FORUM
// =============================================

/** Submit a new forum post */
function submitPost() {
  const author  = document.getElementById('forum-author').value.trim()  || 'Anonymous';
  const topic   = document.getElementById('forum-topic').value.trim()   || 'General';
  const message = document.getElementById('forum-message').value.trim();
  if (!message) { showToast('Please write a message.', 'error'); return; }

  let posts = loadStorage('hangman_forum', []);
  posts.unshift({ author, topic, message, time: Date.now() });
  if (posts.length > 50) posts.pop();
  saveStorage('hangman_forum', posts);

  document.getElementById('forum-message').value = '';
  renderForum();
  showToast('Post submitted!', 'success');
}

/** Render all forum posts */
function renderForum() {
  const posts     = loadStorage('hangman_forum', []);
  const container = document.getElementById('forum-posts');

  document.getElementById('forum-empty').style.display = posts.length ? 'none' : 'block';

  // Remove old post elements (keep the empty-state div)
  container.querySelectorAll('.forum-post').forEach(e => e.remove());

  posts.forEach(p => {
    const el       = document.createElement('div');
    el.className   = 'forum-post';
    const initials = p.author.slice(0, 2).toUpperCase();
    const timeStr  = new Date(p.time).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
    el.innerHTML = `
      <div class="post-header">
        <div class="post-avatar">${initials}</div>
        <div class="post-meta">
          <div class="post-author">${p.author}</div>
          <div class="post-time">${timeStr}</div>
        </div>
        <span class="post-tag">${p.topic}</span>
      </div>
      <div class="post-body">${p.message.replace(/</g, '&lt;')}</div>`;
    container.appendChild(el);
  });
}

// =============================================
// TOAST NOTIFICATION
// =============================================
function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className   = 'toast show' + (type ? ' ' + type : '');
  setTimeout(() => { t.className = 'toast'; }, 2800);
}

// =============================================
// KEYBOARD SUPPORT
// =============================================
document.addEventListener('keydown', e => {
  const key = e.key.toUpperCase();
  if (key.length === 1 && key >= 'A' && key <= 'Z') guessLetter(key);
  if (e.key === 'Enter' && !state.gameActive) startGame();
});

// =============================================
// INITIALISATION
// =============================================
buildAlphabet();
renderWordDisplay();
updateHomeStats();
updateSideStats();

// Seed starter forum posts if the forum is empty
const _existingPosts = loadStorage('hangman_forum', []);
if (!_existingPosts.length) {
  saveStorage('hangman_forum', [
    {
      author:  'WordMaster',
      topic:   'Strategy',
      message: 'My tip: Always guess vowels first — A, E, I, O, U. Then go for S, T, R, N. Saves so many attempts!',
      time:    Date.now() - 86400000
    },
    {
      author:  'CodeNerd',
      topic:   'Coding Words',
      message: 'The Coding category is brutal on Hard. ENCAPSULATION had me sweating! Anyone beat it without hints?',
      time:    Date.now() - 43200000
    },
    {
      author:  'GameDev',
      topic:   'Tip',
      message: 'Use the keyboard shortcuts! Much faster than clicking. Try to get a rhythm going on your guesses.',
      time:    Date.now() - 7200000
    }
  ]);
}
renderForum();