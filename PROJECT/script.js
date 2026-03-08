/* ============================================
   HANGMAN | script.js
   ============================================ */

// ============================================
// THEME (light / dark)
// ============================================
(function initTheme() {
  const saved = localStorage.getItem('hm_theme') || 'light';
  applyTheme(saved);
})();

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const btn = document.getElementById('theme-toggle');
  if (btn) btn.textContent = theme === 'dark' ? '☀️' : '🌙';
  localStorage.setItem('hm_theme', theme);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  applyTheme(current === 'dark' ? 'light' : 'dark');
}

// ============================================
// WORD BANK
// ============================================
const WORDS = {
  General:   {
    easy:   ['CAT','DOG','SUN','MOON','TREE','FISH','BIRD','CAKE','BOOK','STAR','RAIN','DOOR'],
    medium: ['GUITAR','PLANET','WINDOW','SHADOW','BRIDGE','CASTLE','JUNGLE','ROCKET','PUZZLE','CANDLE','MIRROR','GARDEN'],
    hard:   ['ALGORITHM','PHILANTHROPY','INFRASTRUCTURE','KALEIDOSCOPE','METAMORPHOSIS','ENCYCLOPEDIA']
  },
  Movies:    {
    easy:   ['STAR','HERO','FILM','ROLE','CAST','PLOT','SCENE'],
    medium: ['AVATAR','MATRIX','FROZEN','TITANIC','SHINING','HAMLET','PSYCHO','GLADIATOR'],
    hard:   ['INTERSTELLAR','PARASITE','INCEPTION','APOCALYPSE','BRAVEHEART','WHIPLASH']
  },
  Science:   {
    easy:   ['ATOM','CELL','GENE','MASS','ACID','HEAT','WAVE'],
    medium: ['PHOTON','PROTON','NEWTON','OSMOSIS','GRAVITY','NUCLEUS','ENZYME','PLASMA'],
    hard:   ['MITOCHONDRIA','THERMODYNAMICS','BIOLUMINESCENCE','PHOTOSYNTHESIS','CHROMOSOME']
  },
  Coding:    {
    easy:   ['LOOP','CODE','NULL','BOOL','ARRAY','QUEUE','STACK'],
    medium: ['PYTHON','FUNCTION','BOOLEAN','POINTER','RUNTIME','CLOSURE','PROMISE','VARIABLE'],
    hard:   ['RECURSION','POLYMORPHISM','ENCAPSULATION','INHERITANCE','TYPESCRIPT','ABSTRACTION']
  },
  Animals:   {
    easy:   ['CAT','DOG','ANT','COW','OWL','BEE','FOX','RAT'],
    medium: ['JAGUAR','FALCON','WALRUS','PARROT','BADGER','IGUANA','PANDA','COBRA'],
    hard:   ['PLATYPUS','CHAMELEON','SALAMANDER','ORANGUTAN','WOLVERINE','RHINOCEROS']
  },
  Geography: {
    easy:   ['LAKE','HILL','CAPE','DUNE','REEF','ISLE','FORD'],
    medium: ['AMAZON','SAHARA','TUNDRA','CANYON','GLACIER','MONSOON','PLATEAU','VOLCANO'],
    hard:   ['ARCHIPELAGO','MEDITERRANEAN','STRATOSPHERE','MESOPOTAMIA','KILIMANJARO']
  }
};

const SOLO_PARTS  = ['sg-head','sg-body','sg-la','sg-ra','sg-ll','sg-rl'];
const MULTI_PARTS = ['mg-head','mg-body','mg-la','mg-ra','mg-ll','mg-rl'];
const MAX_WRONG   = 6;

// ============================================
// STATE  (use plain objects — never reassign)
// ============================================
const solo = {
  playerName:  'Player',
  category:    'General',
  difficulty:  'easy',
  word:        '',
  guessed:     new Set(),
  wrong:       0,
  active:      false,
  score:       0,
  wins:        0,
  losses:      0,
  streak:      0,
  recent:      []
};

const mp = {
  p1:        'Player 1',
  p2:        'Player 2',
  scores:    [0, 0],
  round:     1,
  setterIdx: 0,
  phase:     'idle',
  word:      '',
  guessed:   new Set(),
  wrong:     0,
  roundLog:  []
};

// ---- Multiplayer helpers ----
function mpSetter()   { return mp.setterIdx; }
function mpGuesser()  { return mp.setterIdx === 0 ? 1 : 0; }
function mpName(i)    { return i === 0 ? mp.p1 : mp.p2; }

// ============================================
// RESULT BUTTON REGISTRY
// Buttons in the result screen are rendered as HTML strings,
// so we can't embed closures. Instead we store callbacks here
// and call them by index from onclick="resultAction(i)".
// ============================================
let _resultActions = [];
function resultAction(i) {
  if (_resultActions[i]) _resultActions[i]();
}

// ============================================
// LOCAL STORAGE
// ============================================
const LS = {
  get: (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
};

// ============================================
// SCREEN ROUTER
// ============================================
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  window.scrollTo(0, 0);
}

// ============================================
// NAVIGATION
// ============================================
function goHome()        { showScreen('screen-mode'); }
function goSolo()        { showScreen('screen-solo-setup'); }
function goMulti()       { showScreen('screen-multi-setup'); }
function goLeaderboard() { renderLB(); showScreen('screen-leaderboard'); }

// ============================================
// CHIP / DIFFICULTY SELECTION
// ============================================
let soloCategory   = 'General';
let soloDifficulty = 'easy';

function selectChip(btn, group, value) {
  const parent = btn.closest('.chip-grid');
  parent.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
  btn.classList.add('active');
  if (group === 'solo-cat') soloCategory = value;
}

function selectDiff(btn, diff) {
  document.querySelectorAll('.diff-chip').forEach(c => c.classList.remove('active'));
  btn.classList.add('active');
  soloDifficulty = diff;
}

// ============================================
// SOLO FLOW
// ============================================
function startSolo() {
  solo.playerName = document.getElementById('solo-name').value.trim() || 'Player';
  solo.category   = soloCategory;
  solo.difficulty = soloDifficulty;
  solo.score      = 0;
  solo.wins       = 0;
  solo.losses     = 0;
  solo.streak     = 0;
  solo.recent     = [];

  document.getElementById('solo-player-badge').textContent = solo.playerName;
  document.getElementById('solo-score-disp').textContent   = 0;

  soloNewRound();
  showScreen('screen-solo-game');
}

function soloNewRound() {
  const pool   = WORDS[solo.category][solo.difficulty];
  solo.word    = pool[Math.floor(Math.random() * pool.length)];
  solo.guessed.clear();
  solo.wrong   = 0;
  solo.active  = true;

  SOLO_PARTS.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('shown');
  });

  document.getElementById('solo-attempts').textContent      = MAX_WRONG;
  document.getElementById('solo-wrong').textContent         = '—';
  document.getElementById('solo-category-label').textContent =
    solo.category + ' · ' + solo.difficulty.charAt(0).toUpperCase() + solo.difficulty.slice(1);
  document.getElementById('solo-word-hint').textContent     = solo.word.length + ' letters';

  buildWordArea('solo-word-area', solo.word, solo.guessed);
  buildKeyboard('solo-keyboard', 'sk-', soloGuess);
  updateSoloStats();
}

function soloGuess(letter) {
  if (!solo.active) return;
  if (solo.guessed.has(letter)) return;
  solo.guessed.add(letter);

  const btn = document.getElementById('sk-' + letter);
  if (btn) btn.disabled = true;

  if (solo.word.includes(letter)) {
    if (btn) btn.classList.add('hit-correct');
    buildWordArea('solo-word-area', solo.word, solo.guessed);

    const allDone = [...solo.word].every(c => solo.guessed.has(c));
    if (allDone) {
      solo.active = false;
      const pts = calcSoloScore();
      solo.wins++;
      solo.streak++;
      solo.score += pts;
      solo.recent.unshift({ word: solo.word, won: true });
      if (solo.recent.length > 5) solo.recent.pop();
      saveLBEntry(solo.playerName, pts, true);
      updateSoloStats();

      showResult({
        icon:       '⚡',
        titleText:  'YOU WIN!',
        titleClass: 'win',
        wordLine:   'The word was <strong>' + solo.word + '</strong>',
        scoreLine:  '+' + pts + ' points  ·  Streak: ' + solo.streak,
        scoreRow:   [],
        wrongCount: solo.wrong,
        buttons: [
          { label: 'Next Word →',  fn: function() { soloNewRound(); showScreen('screen-solo-game'); } },
          { label: 'Main Menu',    fn: goHome,        secondary: true },
          { label: 'Leaderboard',  fn: goLeaderboard, secondary: true }
        ]
      });
    } else {
      toast('"' + letter + '" is in the word!', 'success');
    }

  } else {
    if (btn) btn.classList.add('hit-wrong');
    solo.wrong++;
    showPart(SOLO_PARTS, solo.wrong - 1);
    document.getElementById('solo-attempts').textContent = MAX_WRONG - solo.wrong;

    const wrongs = [...solo.guessed].filter(l => !solo.word.includes(l));
    document.getElementById('solo-wrong').textContent = wrongs.length ? wrongs.join('  ') : '—';

    if (solo.wrong >= MAX_WRONG) {
      solo.active = false;
      solo.losses++;
      solo.streak = 0;
      solo.recent.unshift({ word: solo.word, won: false });
      if (solo.recent.length > 5) solo.recent.pop();
      buildWordAreaReveal('solo-word-area', solo.word, solo.guessed);
      saveLBEntry(solo.playerName, 0, false);
      updateSoloStats();

      showResult({
        icon:       '💀',
        titleText:  'GAME OVER',
        titleClass: 'lose',
        wordLine:   'The word was <strong>' + solo.word + '</strong>',
        scoreLine:  'The man is gone…',
        scoreRow:   [],
        wrongCount: solo.wrong,
        buttons: [
          { label: 'Try Again →', fn: function() { soloNewRound(); showScreen('screen-solo-game'); } },
          { label: 'Main Menu',   fn: goHome, secondary: true }
        ]
      });
    } else {
      toast('"' + letter + '" not in word. ' + (MAX_WRONG - solo.wrong) + ' left.', 'error');
    }
  }
}

function calcSoloScore() {
  const base  = { easy: 100, medium: 200, hard: 400 }[solo.difficulty];
  const bonus = (MAX_WRONG - solo.wrong) * 20;
  return base + bonus;
}

function updateSoloStats() {
  document.getElementById('solo-wins').textContent    = solo.wins;
  document.getElementById('solo-losses').textContent  = solo.losses;
  document.getElementById('solo-streak').textContent  = solo.streak;
  document.getElementById('solo-score-disp').textContent = solo.score;

  const el = document.getElementById('solo-recent');
  if (!solo.recent.length) {
    el.innerHTML = '<div style="color:var(--ink-faded);font-size:0.85rem;font-family:\'Caveat\',cursive;">No games yet</div>';
    return;
  }
  el.innerHTML = solo.recent.map(function(r) {
    return '<div class="recent-item">'
      + '<span style="color:' + (r.won ? 'var(--green)' : 'var(--red)') + '">' + (r.won ? '✓' : '✗') + '</span>'
      + '<span>' + r.word + '</span>'
      + '</div>';
  }).join('');
}

// ============================================
// MULTIPLAYER FLOW
// ============================================
function startMulti() {
  mp.p1        = document.getElementById('mp-p1').value.trim() || 'Player 1';
  mp.p2        = document.getElementById('mp-p2').value.trim() || 'Player 2';
  mp.scores[0] = 0;
  mp.scores[1] = 0;
  mp.round     = 1;
  mp.setterIdx = 0;
  mp.roundLog  = [];
  mp.phase     = 'setup';
  mp.word      = '';
  mp.guessed.clear();
  mp.wrong     = 0;
  enterWordSetup();
}

function enterWordSetup() {
  mp.phase = 'setup';
  const setterName  = mpName(mpSetter());
  const guesserName = mpName(mpGuesser());

  document.getElementById('ws-round-badge').textContent  = 'Round ' + mp.round;
  document.getElementById('ws-setter-label').textContent = setterName + ' — Type Your Secret Word';
  document.getElementById('ws-guesser-note').textContent = guesserName + ', look away! 👀';
  document.getElementById('ws-input').value              = '';
  document.getElementById('ws-error').textContent        = '';
  showScreen('screen-word-setup');
}

function wsConfirm() {
  const input = document.getElementById('ws-input');
  const errEl = document.getElementById('ws-error');
  const word  = input ? input.value.trim() : '';

  if (word.length < 2) {
    errEl.textContent = 'Word must be at least 2 letters.';
    return;
  }

  mp.word = word;
  mp.guessed.clear();
  mp.wrong  = 0;
  mp.phase  = 'guessing';
  startMultiRound();
}

function startMultiRound() {
  MULTI_PARTS.forEach(function(id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove('shown');
  });

  document.getElementById('multi-attempts').textContent   = MAX_WRONG;
  document.getElementById('multi-wrong').textContent      = '—';
  document.getElementById('multi-round-ind').textContent  = 'Round ' + mp.round;
  document.getElementById('multi-guesser-tag').textContent = 'Guessing: ' + mpName(mpGuesser());

  buildWordArea('multi-word-area', mp.word, mp.guessed);
  document.getElementById('multi-word-hint').textContent  = mp.word.length + ' letters — guess them all!';
  buildKeyboard('multi-keyboard', 'mk-', multiGuess);

  renderMpScoreBoard();
  renderRoundLog();
  showScreen('screen-multi-game');
  toast('Round ' + mp.round + ' started! ' + mpName(mpGuesser()) + ' is guessing.', '');
}

function multiGuess(letter) {
  if (mp.phase !== 'guessing') return;
  if (mp.guessed.has(letter)) return;
  mp.guessed.add(letter);

  const btn = document.getElementById('mk-' + letter);
  if (btn) btn.disabled = true;

  if (mp.word.includes(letter)) {
    if (btn) btn.classList.add('hit-correct');
    buildWordArea('multi-word-area', mp.word, mp.guessed);

    const allDone = [...mp.word].every(function(c) { return mp.guessed.has(c); });
    if (allDone) {
      mpRoundOver(true);
    } else {
      toast('"' + letter + '" is in the word!', 'success');
    }

  } else {
    if (btn) btn.classList.add('hit-wrong');
    mp.wrong++;
    showPart(MULTI_PARTS, mp.wrong - 1);
    document.getElementById('multi-attempts').textContent = MAX_WRONG - mp.wrong;

    const wrongs = [...mp.guessed].filter(function(l) { return !mp.word.includes(l); });
    document.getElementById('multi-wrong').textContent = wrongs.length ? wrongs.join('  ') : '—';

    if (mp.wrong >= MAX_WRONG) {
      buildWordAreaReveal('multi-word-area', mp.word, mp.guessed);
      mpRoundOver(false);
    } else {
      toast('"' + letter + '" not in word. ' + (MAX_WRONG - mp.wrong) + ' left.', 'error');
    }
  }
}

function mpRoundOver(guesserWins) {
  mp.phase = 'result';

  const winner      = guesserWins ? mpGuesser() : mpSetter();
  const loser       = guesserWins ? mpSetter()  : mpGuesser();
  const winnerName  = mpName(winner);
  const loserName   = mpName(loser);
  const setterName  = mpName(mpSetter());
  const guesserName = mpName(mpGuesser());

  mp.scores[winner] += 10;

  mp.roundLog.unshift({
    round:      mp.round,
    word:       mp.word,
    guesserWon: guesserWins,
    setter:     setterName,
    guesser:    guesserName,
    winner:     winnerName
  });

  saveLBEntry(winnerName, 10, true);
  saveLBEntry(loserName,  0,  false);

  // Capture current state for closures BEFORE any mutation
  const nextRoundNum   = mp.round + 1;
  const nextSetterIdx  = mp.setterIdx === 0 ? 1 : 0;
  const nextSetterName = mpName(nextSetterIdx);

  showResult({
    icon:       guesserWins ? '⚡' : '💀',
    titleText:  winnerName + ' WINS!',
    titleClass: guesserWins ? 'win' : 'lose',
    wordLine:   'The word was <strong>' + mp.word + '</strong>  (set by ' + setterName + ')',
    scoreLine:  winnerName + ' +10 pts',
    scoreRow: [
      { name: mp.p1, pts: mp.scores[0] },
      { name: mp.p2, pts: mp.scores[1] }
    ],
    wrongCount: mp.wrong,
    buttons: [
      {
        label: 'Next Round → ' + nextSetterName + ' sets',
        fn: function() {
          mp.round     = nextRoundNum;
          mp.setterIdx = nextSetterIdx;
          mp.word      = '';
          mp.guessed.clear();
          mp.wrong     = 0;
          mp.phase     = 'setup';
          enterWordSetup();
        }
      },
      {
        label:     'Reset Match',
        fn:        function() { showScreen('screen-multi-setup'); },
        secondary: true
      },
      {
        label:     'Main Menu',
        fn:        goHome,
        secondary: true
      }
    ]
  });
}

function renderMpScoreBoard() {
  const setter  = mpSetter();
  const guesser = mpGuesser();

  for (var i = 0; i < 2; i++) {
    document.getElementById('mp-sc-name-' + i).textContent = mpName(i);
    document.getElementById('mp-sc-pts-'  + i).textContent = mp.scores[i];
    document.getElementById('mp-sc-role-' + i).textContent = (i === setter) ? '🔒 Setter' : '🔤 Guesser';

    const card = document.getElementById('mp-sc-' + i);
    card.classList.remove('active-guesser', 'active-setter');
    card.classList.add(i === guesser ? 'active-guesser' : 'active-setter');
  }
}

function renderRoundLog() {
  const el = document.getElementById('multi-round-log');
  if (!mp.roundLog.length) {
    el.innerHTML = '<div style="font-family:\'Caveat\',cursive;font-size:0.85rem;color:var(--ink-faded);">No rounds yet</div>';
    return;
  }
  el.innerHTML = mp.roundLog.map(function(r) {
    return '<div class="multi-round-log-item">'
      + '<strong>R' + r.round + '</strong>: ' + r.winner + ' won'
      + '<br><span style="color:var(--ink-faded)">"' + r.word + '"</span>'
      + '</div>';
  }).join('');
}

// ============================================
// RESULT SCREEN
// ============================================
function showResult(opts) {
  var icon       = opts.icon;
  var titleText  = opts.titleText;
  var titleClass = opts.titleClass;
  var wordLine   = opts.wordLine;
  var scoreLine  = opts.scoreLine;
  var scoreRow   = opts.scoreRow;
  var wrongCount = opts.wrongCount;
  var buttons    = opts.buttons;

  document.getElementById('result-icon').textContent = icon;

  var titleEl       = document.getElementById('result-title');
  titleEl.textContent = titleText;
  titleEl.className   = 'result-title ' + titleClass;

  document.getElementById('result-word').innerHTML = wordLine;

  if (scoreRow && scoreRow.length) {
    document.getElementById('result-score-row').innerHTML = scoreRow.map(function(s) {
      return '<div class="result-score-item">'
        + '<div class="result-score-name">' + s.name + '</div>'
        + '<div class="result-score-pts">'  + s.pts  + ' pts</div>'
        + '</div>';
    }).join('<div style="font-family:\'Caveat\',cursive;font-size:1rem;color:var(--ink-faded);padding-top:0.8rem;">vs</div>');
  } else {
    document.getElementById('result-score-row').innerHTML =
      '<div style="font-family:\'Caveat\',cursive;color:var(--ink-faded);">' + scoreLine + '</div>';
  }

  document.getElementById('result-gallows').innerHTML = buildResultGallows(wrongCount);

  // Store button callbacks in registry — reference by index in onclick
  _resultActions = buttons.map(function(b) { return b.fn; });

  document.getElementById('result-buttons').innerHTML = buttons.map(function(b, i) {
    var cls = b.secondary ? 'result-btn-secondary' : 'result-btn-primary';
    return '<button class="' + cls + '" onclick="resultAction(' + i + ')">' + b.label + '</button>';
  }).join('');

  showScreen('screen-result');
}

function buildResultGallows(wrongCount) {
  var partDefs = [
    '<circle cx="80" cy="44" r="14" style="fill:var(--ink)"/>',
    '<line x1="80" y1="58" x2="80" y2="110"/>',
    '<line x1="80" y1="72" x2="56" y2="96"/>',
    '<line x1="80" y1="72" x2="104" y2="96"/>',
    '<line x1="80" y1="110" x2="56" y2="144"/>',
    '<line x1="80" y1="110" x2="104" y2="144"/>'
  ];
  var parts = partDefs.slice(0, wrongCount).join('');
  return '<svg viewBox="0 0 140 180" width="110" height="140"'
    + ' style="stroke:var(--ink);stroke-width:2.5;stroke-linecap:round;fill:none">'
    + '<line x1="10" y1="170" x2="130" y2="170" style="stroke:var(--rope);stroke-width:3"/>'
    + '<line x1="35" y1="170" x2="35" y2="10"   style="stroke:var(--rope);stroke-width:3"/>'
    + '<line x1="35" y1="10"  x2="90" y2="10"   style="stroke:var(--rope);stroke-width:3"/>'
    + '<line x1="90" y1="10"  x2="90" y2="30"   style="stroke:var(--rope);stroke-width:3"/>'
    + parts
    + '</svg>';
}

// ============================================
// SHARED DOM HELPERS
// ============================================
function buildWordArea(containerId, word, guessedSet) {
  var el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = '';
  for (var i = 0; i < word.length; i++) {
    var ch  = word[i];
    var div = document.createElement('div');
    if (ch === ' ') {
      div.className = 'letter-blank space-gap';
    } else {
      var revealed  = guessedSet.has(ch);
      div.className = 'letter-blank' + (revealed ? ' revealed' : '');
      div.textContent = revealed ? ch : '';
    }
    el.appendChild(div);
  }
}

function buildWordAreaReveal(containerId, word, guessedSet) {
  var el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = '';
  for (var i = 0; i < word.length; i++) {
    var ch  = word[i];
    var div = document.createElement('div');
    if (ch === ' ') {
      div.className = 'letter-blank space-gap';
    } else {
      div.className   = 'letter-blank ' + (guessedSet.has(ch) ? 'revealed' : 'wrong-reveal');
      div.textContent = ch;
    }
    el.appendChild(div);
  }
}

function buildKeyboard(containerId, prefix, guessFn) {
  var el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = '';
  for (var i = 65; i <= 90; i++) {
    var letter = String.fromCharCode(i);
    var btn    = document.createElement('button');
    btn.className   = 'key-btn';
    btn.id          = prefix + letter;
    btn.textContent = letter;
    btn.setAttribute('data-letter', letter);
    // Use IIFE to capture the letter value correctly in the closure
    (function(l) {
      btn.onclick = function() { guessFn(l); };
    })(letter);
    el.appendChild(btn);
  }
}

function showPart(partIds, idx) {
  var el = document.getElementById(partIds[idx]);
  if (el) el.classList.add('shown');
}

// ============================================
// KEYBOARD SUPPORT
// ============================================
document.addEventListener('keydown', function(e) {
  var key = e.key.toUpperCase();
  if (key.length !== 1 || key < 'A' || key > 'Z') return;

  var active = document.querySelector('.screen.active');
  if (!active) return;

  if (active.id === 'screen-solo-game')  soloGuess(key);
  if (active.id === 'screen-multi-game') multiGuess(key);
});

// ============================================
// LEADERBOARD
// ============================================
function saveLBEntry(name, pts, won) {
  var lb = LS.get('hm_lb', []);
  var ex = null;
  for (var i = 0; i < lb.length; i++) {
    if (lb[i].name === name) { ex = lb[i]; break; }
  }
  if (ex) {
    ex.score += pts;
    ex.games++;
    if (won) ex.wins++;
  } else {
    lb.push({ name: name, score: pts, games: 1, wins: won ? 1 : 0 });
  }
  LS.set('hm_lb', lb);
}

function renderLB() {
  var lb = LS.get('hm_lb', []);
  lb.sort(function(a, b) { return b.score - a.score; });
  var tbody = document.getElementById('lb-tbody');
  if (!lb.length) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;font-family:\'Caveat\',cursive;color:var(--ink-faded);padding:2rem;">No scores yet!</td></tr>';
    return;
  }
  tbody.innerHTML = lb.map(function(e, i) {
    var rcls  = i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : '';
    var medal = i === 0 ? '🥇'  : i === 1 ? '🥈'     : i === 2 ? '🥉'     : (i + 1);
    var wr    = e.games ? Math.round((e.wins / e.games) * 100) : 0;
    return '<tr>'
      + '<td class="lb-rank ' + rcls + '">' + medal + '</td>'
      + '<td style="font-family:\'Caveat\',cursive;font-size:1.05rem;">' + e.name + '</td>'
      + '<td class="lb-score">' + e.score + '</td>'
      + '<td style="font-family:\'Caveat\',cursive;">' + e.games + '</td>'
      + '<td style="font-family:\'Caveat\',cursive;">' + wr + '%</td>'
      + '</tr>';
  }).join('');
}

function clearLB() {
  if (confirm('Clear all leaderboard data?')) {
    LS.set('hm_lb', []);
    renderLB();
    toast('Leaderboard cleared.');
  }
}

// ============================================
// TOAST
// ============================================
function toast(msg, type) {
  var t = document.getElementById('toast');
  t.textContent = msg;
  t.className   = 'toast show' + (type ? ' ' + type : '');
  clearTimeout(t._timer);
  t._timer = setTimeout(function() { t.className = 'toast'; }, 2600);
}