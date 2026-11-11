'use strict';

// Three fixed lists; each session randomly pairs each list with one strategy.
const WORD_LISTS = [
  ['lantern', 'apple', 'hammer', 'rabbit', 'pillow', 'mountain'],
  ['bottle', 'guitar', 'candle', 'turtle', 'window', 'carrot'],
  ['basket', ' dolphin', 'button', 'bridge', 'lemon', 'blanket']
].map(list => list.map(word => word.trim()));

const STRATEGIES = [
  {
    id: 'maintenance_rehearsal',
    name: 'Maintenance rehearsal',
    instruction: 'Repeat the word silently to yourself over and over while it is on the screen. Focus on keeping the word active in your mind. Do not create a story or picture.'
  },
  {
    id: 'self_reference',
    name: 'Self-reference',
    instruction: 'Think about how the word relates to you personally. For example, ask yourself whether you own it, use it, like it, or have an experience involving it.'
  },
  {
    id: 'mental_imagery',
    name: 'Mental imagery',
    instruction: 'Create a clear mental picture of the object named by the word. Imagine its appearance, color, shape, and details.'
  }
];

// Optional accepted variants and typo tolerance help avoid penalizing harmless spelling slips.
const ACCEPTED_VARIANTS = {
  dolphin: ['dolphin'],
  mountain: ['mountain'],
  pillow: ['pillow'],
  lantern: ['lantern'],
  rabbit: ['rabbit', 'bunny'],
  guitar: ['guitar'],
  carrot: ['carrot'],
  blanket: ['blanket', 'comforter'],
  basket: ['basket'],
  button: ['button'],
  bridge: ['bridge'],
  lemon: ['lemon'],
  bottle: ['bottle'],
  candle: ['candle'],
  turtle: ['turtle'],
  window: ['window'],
  apple: ['apple'],
  hammer: ['hammer']
};

const WORD_SECONDS = 3;
const DISTRACTOR_SECONDS = 30;
const $ = id => document.getElementById(id);
const welcome = $('welcome');
const stage = $('stage');
const results = $('results');
const stageContent = $('stage-content');
let session = null;
let timers = [];
let distractorStart = null;
let distractorEnd = null;

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
function clearTimers() { timers.forEach(clearTimeout); timers = []; }
function schedule(fn, ms) { const id = setTimeout(fn, ms); timers.push(id); return id; }
function showStage(label, progress, html) {
  $('stage-label').textContent = label;
  $('progress-label').textContent = progress;
  $('progress-bar').style.width = progress;
  stageContent.innerHTML = html;
}
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}
function csvCell(value) {
  const s = String(value ?? '');
  return '"' + s.replace(/"/g, '""') + '"';
}
function downloadCsv(filename, headers, rows) {
  const csv = [headers, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}
function normalize(text) {
  return String(text).toLowerCase().normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/-/g, ' ').trim().replace(/\s+/g, ' ');
}
function levenshtein(a, b) {
  const row = Array.from({length: b.length + 1}, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0]; row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const old = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = old;
    }
  }
  return row[b.length];
}
function matchesWord(typed, target) {
  const candidate = normalize(typed);
  const variants = ACCEPTED_VARIANTS[target] || [target];
  return variants.some(variant => {
    const v = normalize(variant);
    return candidate === v || (v.length >= 5 && candidate.length >= 4 && levenshtein(candidate, v) <= 1);
  });
}
function makeSession() {
  const strategies = shuffle(STRATEGIES);
  const lists = shuffle(WORD_LISTS);
  const blocks = strategies.map((strategy, i) => ({
    strategy, list: lists[i], blockOrder: i + 1
  }));
  const trials = [];
  blocks.forEach((block, bi) => block.list.forEach((word, wi) => {
    trials.push({
      session_id: session.sessionId,
      participant_code: session.participantCode,
      block_order: bi + 1,
      strategy: block.strategy.name,
      strategy_id: block.strategy.id,
      list_id: WORD_LISTS.findIndex(list => list.includes(word)) + 1,
      word_order_in_block: wi + 1,
      word,
      recalled: false,
      matched_response: ''
    });
  }));
  session.blocks = blocks;
  session.trials = trials;
}
function begin() {
  clearTimers();
  const now = new Date();
  session = {
    sessionId: 'S' + now.toISOString().replace(/[-:.TZ]/g, '').slice(0, 14) + '-' + Math.random().toString(36).slice(2, 7),
    participantCode: $('participant-id').value.trim(),
    startedAt: now.toISOString(),
    userAgent: navigator.userAgent
  };
  makeSession();
  welcome.classList.add('hidden'); results.classList.add('hidden'); stage.classList.remove('hidden');
  runBlock(0);
}
function runBlock(index) {
  clearTimers();
  if (index >= session.blocks.length) return startDistractor();
  const block = session.blocks[index];
  showStage(`Encoding block ${index + 1} of 3`, `${Math.round(index / 3 * 100)}%`,
    `<h2>${escapeHtml(block.strategy.name)}</h2>
     <p class="instruction">${escapeHtml(block.strategy.instruction)}</p>
     <p>There are six words in this block. Each word will appear for ${WORD_SECONDS} seconds.</p>
     <div class="center"><button id="ready-button" class="primary">I'm ready</button></div>`);
  $('ready-button').addEventListener('click', () => presentWord(index, 0));
}
function presentWord(blockIndex, wordIndex) {
  const block = session.blocks[blockIndex];
  if (wordIndex >= block.list.length) return runBlock(blockIndex + 1);
  const overall = blockIndex * 6 + wordIndex;
  showStage(`Encoding block ${blockIndex + 1} of 3`, `${Math.round((overall + 1) / 18 * 100)}%`,
    `<div class="center instruction">Word ${wordIndex + 1} of 6</div>
     <div class="word-display">${escapeHtml(block.list[wordIndex])}</div>
     <div class="timer" id="word-timer">3</div>`);
  let remaining = WORD_SECONDS;
  const tick = () => {
    remaining--;
    const el = $('word-timer');
    if (el) el.textContent = remaining > 0 ? remaining : ' ';
    if (remaining > 0) schedule(tick, 1000);
    else presentWord(blockIndex, wordIndex + 1);
  };
  schedule(tick, 1000);
}
function startDistractor() {
  clearTimers();
  const startNumber = Math.floor(100 + Math.random() * 900);
  session.distractorStartNumber = startNumber;
  distractorStart = Date.now();
  showStage('Distractor task', '100%',
    `<h2>Count backward by 3</h2>
     <p>Starting from the number below, repeatedly subtract 3. Type each next number and press Enter. Continue until the timer reaches zero.</p>
     <div class="counting-number">${startNumber}</div>
     <p class="timer" id="distractor-timer">${DISTRACTOR_SECONDS} seconds remaining</p>
     <label class="field-label" for="count-input">Your next number</label>
     <input id="count-input" type="number" inputmode="numeric" autocomplete="off" placeholder="Enter ${startNumber - 3}">
     <p id="count-feedback" class="feedback" aria-live="polite"></p>
     <p class="small-note">Correct entries: <span id="count-correct">0</span></p>`);
  let expected = startNumber - 3;
  let correct = 0;
  const input = $('count-input');
  input.focus();
  input.addEventListener('keydown', event => {
    if (event.key !== 'Enter' || !input.value.trim()) return;
    const answer = Number(input.value);
    if (answer === expected) {
      correct++; expected -= 3;
      $('count-feedback').textContent = 'Correct — keep going.';
      $('count-correct').textContent = correct;
    } else {
      $('count-feedback').textContent = 'Try subtracting 3 from the previous number.';
    }
    input.value = '';
    input.placeholder = `Next: ${expected}`;
  });
  const deadline = Date.now() + DISTRACTOR_SECONDS * 1000;
  const update = () => {
    const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
    const el = $('distractor-timer');
    if (el) el.textContent = `${remaining} seconds remaining`;
    if (remaining > 0) schedule(update, 200);
    else {
      distractorEnd = Date.now();
      session.distractorDurationMs = distractorEnd - distractorStart;
      session.distractorCorrectCount = correct;
      startRecall();
    }
  };
  update();
}
function startRecall() {
  clearTimers();
  showStage('Free recall', '100%',
    `<h2>Recall the words</h2>
     <p>Type as many of the 18 words you studied as you can remember, in any order. Separate words with commas, spaces, or line breaks. You do not need to remember which strategy was used.</p>
     <textarea id="recall-input" class="recall-box" rows="7" placeholder="Enter the words you remember..."></textarea>
     <div class="center"><button id="submit-recall" class="primary">Submit recall</button></div>`);
  $('submit-recall').addEventListener('click', finishRecall);
}
function finishRecall() {
  const raw = $('recall-input').value;
  const responses = normalize(raw).split(/\s+/).filter(Boolean);
  const used = new Set();
  const uniqueResponses = [...new Set(responses)];
  session.trials.forEach(trial => {
    const variants = ACCEPTED_VARIANTS[trial.word] || [trial.word];
    const match = uniqueResponses.find((response, i) =>
      !used.has(response) && matchesWord(response, trial.word));
    if (match) {
      trial.recalled = true;
      trial.matched_response = match;
      used.add(match);
    }
  });
  session.recallText = raw;
  session.completedAt = new Date().toISOString();
  session.totalRecalled = session.trials.filter(t => t.recalled).length;
  session.resultsByStrategy = STRATEGIES.map(strategy => {
    const subset = session.trials.filter(t => t.strategy_id === strategy.id);
    return { name: strategy.name, recalled: subset.filter(t => t.recalled).length, total: subset.length };
  });
  showResults();
}
function showResults() {
  stage.classList.add('hidden'); results.classList.remove('hidden');
  $('result-intro').textContent = `You recalled ${session.totalRecalled} of 18 studied words.`;
  const rows = session.resultsByStrategy.map(item =>
    `<tr><td>${escapeHtml(item.name)}</td><td>${item.recalled} / ${item.total}</td><td>${Math.round(item.recalled / item.total * 100)}%</td></tr>`
  ).join('');
  const bars = session.resultsByStrategy.map(item => {
    const percentage = Math.round(item.recalled / item.total * 100);
    return `<div class="score-item">
      <div class="score-heading"><span>${escapeHtml(item.name)}</span><strong>${item.recalled} of ${item.total} (${percentage}%)</strong></div>
      <div class="score-track" role="img" aria-label="${escapeHtml(item.name)}: ${item.recalled} of ${item.total} words recalled">
        <div class="score-fill" style="width: ${percentage}%"></div>
      </div>
    </div>`;
  }).join('');
  $('result-table').innerHTML = `
    <h3>Recall by encoding strategy</h3>
    <div class="score-chart">${bars}</div>
    <table><thead><tr><th>Encoding strategy</th><th>Words recalled</th><th>Accuracy</th></tr></thead><tbody>${rows}</tbody></table>`;
}
function downloadSummary() {
  const row = [
    session.sessionId, session.participantCode, session.startedAt, session.completedAt,
    session.totalRecalled, session.resultsByStrategy.find(x => x.name === 'Maintenance rehearsal').recalled,
    session.resultsByStrategy.find(x => x.name === 'Self-reference').recalled,
    session.resultsByStrategy.find(x => x.name === 'Mental imagery').recalled,
    session.distractorStartNumber, session.distractorDurationMs, session.distractorCorrectCount
  ];
  downloadCsv(`memory_summary_${session.sessionId}.csv`,
    ['session_id','participant_code','started_at','completed_at','total_recalled','maintenance_rehearsal_recalled','self_reference_recalled','mental_imagery_recalled','distractor_start_number','distractor_duration_ms','distractor_correct_count'], [row]);
}
function downloadTrials() {
  const rows = session.trials.map(t => [
    t.session_id, t.participant_code, t.block_order, t.strategy, t.strategy_id,
    t.list_id, t.word_order_in_block, t.word, t.recalled, t.matched_response
  ]);
  downloadCsv(`memory_trials_${session.sessionId}.csv`,
    ['session_id','participant_code','block_order','strategy','strategy_id','list_id','word_order_in_block','word','recalled','matched_response'], rows);
}
function restart() {
  clearTimers(); session = null;
  results.classList.add('hidden'); stage.classList.add('hidden'); welcome.classList.remove('hidden');
  $('participant-id').value = '';
}
$('start-button').addEventListener('click', begin);
$('summary-download').addEventListener('click', downloadSummary);
$('trials-download').addEventListener('click', downloadTrials);
$('restart-button').addEventListener('click', restart);
