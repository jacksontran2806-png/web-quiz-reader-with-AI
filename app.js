// ── State ─────────────────────────────────────────────────────────────────────
let questions   = [];
let currentIdx  = 0;
let score       = 0;
let selected    = null;
let answered    = false;

// ── DOM refs ──────────────────────────────────────────────────────────────────
const app          = document.getElementById('app');
const screens      = { welcome:  document.getElementById('screen-welcome'),
                        question: document.getElementById('screen-question'),
                        results:  document.getElementById('screen-results') };

const convertBtn   = document.getElementById('convert-btn');
const convertStatus= document.getElementById('convert-status');
const pasteInput   = document.getElementById('paste-input');
const loadFileBtn  = document.getElementById('load-file-btn');
const fileInput    = document.getElementById('file-input');

const qTitle       = document.getElementById('q-title');
const qScore       = document.getElementById('q-score');
const qText        = document.getElementById('q-text');
const optionsWrap  = document.getElementById('options-wrap');
const feedback     = document.getElementById('feedback');
const submitBtn    = document.getElementById('submit-btn');
const nextBtn      = document.getElementById('next-btn');
const progressFill = document.getElementById('progress-fill');

const gradeText    = document.getElementById('grade-text');
const scoreDisplay = document.getElementById('score-display');
const pctDisplay   = document.getElementById('pct-display');
const scoreCard    = document.getElementById('score-card');
const playAgainBtn = document.getElementById('play-again-btn');
const newFileBtn   = document.getElementById('new-file-btn');

// ── Splash → App ──────────────────────────────────────────────────────────────
setTimeout(() => app.classList.remove('hidden'), 2300);

// ── Screen switching ──────────────────────────────────────────────────────────
function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.remove('active'));
  screens[name].classList.add('active');
}

// ── Parse ─────────────────────────────────────────────────────────────────────
function parseQuestions(text) {
  const blocks = text.split(/\n\s*\n/).map(b => b.trim()).filter(Boolean);
  const qs = [];
  for (const block of blocks) {
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) continue;
    const lastLine = lines[lines.length - 1];
    if (lastLine.startsWith('YESNO:')) {
      qs.push({ question: lines[0], type: 'yesno', answer: lastLine.replace('YESNO:', '').trim() });
    } else if (lastLine.startsWith('MULTI:')) {
      qs.push({ question: lines[0], type: 'multi', options: lines.slice(1, 5), answer: lastLine.replace('MULTI:', '').trim().toUpperCase() });
    } else {
      if (lines.length < 6) continue;
      qs.push({ question: lines[0], type: 'multi', options: lines.slice(1, 5), answer: lines[5].toUpperCase() });
    }
  }
  return qs;
}

function validateQuestions(qs) {
  const valid = ['A','B','C','D'];
  for (let i = 0; i < qs.length; i++) {
    if (qs[i].type === 'multi' && !valid.includes(qs[i].answer))
      return `Question ${i+1}: answer "${qs[i].answer}" is not A/B/C/D.`;
    if (qs[i].type === 'multi' && qs[i].options.length !== 4)
      return `Question ${i+1}: must have exactly 4 options.`;
  }
  return null;
}

// ── AI Conversion ─────────────────────────────────────────────────────────────
convertBtn.addEventListener('click', async () => {
  const raw = pasteInput.value.trim();
  if (!raw) { convertStatus.textContent = 'Please paste some questions first.'; return; }
  convertBtn.disabled = true;
  convertStatus.textContent = '✨ Converting with AI...';
  try {
    const res  = await fetch('/api/convert', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: raw }) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Conversion failed');
    const qs  = parseQuestions(data.result);
    if (!qs.length) throw new Error('No valid questions found after conversion.');
    const err = validateQuestions(qs);
    if (err) throw new Error(err);
    questions = qs;
    convertStatus.textContent = `✅ ${qs.length} questions ready!`;
    setTimeout(startQuiz, 800);
  } catch (e) {
    convertStatus.textContent = `❌ ${e.message}`;
    convertBtn.disabled = false;
  }
});

// ── File loading ──────────────────────────────────────────────────────────────
loadFileBtn.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', async () => {
  const file = fileInput.files[0];
  if (!file) return;
  const ext = file.name.split('.').pop().toLowerCase();
  if (ext === 'txt') {
    const reader = new FileReader();
    reader.onload = e => sendTextToAI(e.target.result);
    reader.readAsText(file, 'utf-8');
  } else if (ext === 'pdf') {
    convertStatus.textContent = '📄 Reading PDF...';
    const pdfjsLib   = await loadPDFJS();
    const arrayBuffer = await file.arrayBuffer();
    const pdf        = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page    = await pdf.getPage(i);
      const content = await page.getTextContent();
      fullText += content.items.map(item => item.str).join(' ') + '\n';
    }
    sendTextToAI(fullText);
  } else {
    alert('Invalid file type. Please upload a .txt or .pdf file only.');
    fileInput.value = '';
  }
});

function loadPDFJS() {
  return new Promise(resolve => {
    if (window.pdfjsLib) { resolve(window.pdfjsLib); return; }
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    script.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      resolve(window.pdfjsLib);
    };
    document.head.appendChild(script);
  });
}

async function sendTextToAI(text) {
  if (!text.trim()) { alert('File appears to be empty.'); return; }
  convertStatus.textContent = '✨ Converting with AI...';
  convertBtn.disabled = true;
  try {
    const res  = await fetch('/api/convert', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Conversion failed');
    const qs  = parseQuestions(data.result);
    if (!qs.length) throw new Error('No valid questions found after conversion.');
    const err = validateQuestions(qs);
    if (err) throw new Error(err);
    questions = qs;
    convertStatus.textContent = `✅ ${qs.length} questions ready!`;
    setTimeout(startQuiz, 800);
  } catch (e) {
    convertStatus.textContent = `❌ ${e.message}`;
    convertBtn.disabled = false;
  }
}

// ── Quiz ──────────────────────────────────────────────────────────────────────
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function startQuiz() {
  shuffle(questions);
  currentIdx = 0;
  score      = 0;
  showQuestion();
}

function showQuestion() {
  answered = false;
  selected = null;
  feedback.textContent = '';
  feedback.style.color = '';
  submitBtn.classList.add('hidden');
  nextBtn.classList.add('hidden');

  const q   = questions[currentIdx];
  const num = currentIdx + 1;
  const tot = questions.length;

  qTitle.textContent = `Question ${num} of ${tot}`;
  qScore.textContent = `Score: ${score}`;
  qText.textContent  = q.question;
  progressFill.style.width = `${((num - 1) / tot) * 100}%`;

  optionsWrap.innerHTML = '';

  if (q.type === 'yesno') {
    ['True', 'False'].forEach(opt => {
      const btn = document.createElement('button');
      btn.className   = 'option-btn yesno-btn';
      btn.textContent = opt;
      btn.dataset.letter = opt;
      btn.addEventListener('click', () => handleAnswer(btn, q));
      optionsWrap.appendChild(btn);
    });
  } else {
    q.options.forEach(opt => {
      const btn = document.createElement('button');
      btn.className   = 'option-btn';
      btn.textContent = opt;
      btn.dataset.letter = opt[0].toUpperCase();
      btn.addEventListener('click', () => handleAnswer(btn, q));
      optionsWrap.appendChild(btn);
    });
  }

  showScreen('question');
}

// ── Single handler for all answer types ──────────────────────────────────────
function handleAnswer(btn, q) {
  if (answered) return;
  answered = true;

  const userAnswer = btn.dataset.letter.toLowerCase();
  const correct    = q.answer.toLowerCase();
  const isCorrect  = userAnswer === correct;

  // lock all buttons
  document.querySelectorAll('.option-btn').forEach(b => b.disabled = true);

  // flash the chosen button then reveal all
  btn.classList.add('flash');

  setTimeout(() => {
    btn.classList.remove('flash');

    // color all buttons
    document.querySelectorAll('.option-btn').forEach(b => {
      const letter = b.dataset.letter.toLowerCase();
      if (letter === correct) {
        b.classList.add('correct');
      } else if (letter === userAnswer && !isCorrect) {
        b.classList.add('wrong');
      }
    });

    if (isCorrect) {
      score++;
      feedback.textContent = '✅  Correct!';
      feedback.style.color = 'var(--success)';
    } else {
      feedback.textContent = `❌  Wrong! Correct answer: ${q.answer}`;
      feedback.style.color = 'var(--error)';
    }

    nextBtn.classList.remove('hidden');
    nextBtn.textContent = currentIdx + 1 < questions.length ? 'Next Question →' : 'See Results';
    qScore.textContent  = `Score: ${score}`;

  }, 300);
}

nextBtn.addEventListener('click', () => {
  if (currentIdx + 1 < questions.length) {
    currentIdx++;
    showQuestion();
  } else {
    showResults();
  }
});

// ── Results ───────────────────────────────────────────────────────────────────
function showResults() {
  const tot = questions.length;
  const pct = Math.round((score / tot) * 100);
  let grade, color;
  if (pct === 100)    { grade = 'Perfect! 🏆';                color = 'var(--success)'; }
  else if (pct >= 70) { grade = 'Well done! 🎉';              color = 'var(--accent)';  }
  else if (pct >= 40) { grade = 'Keep practising 📚';         color = '#f39c12';        }
  else                { grade = 'Better luck next time 💪';   color = 'var(--error)';   }

  gradeText.textContent       = grade;
  scoreDisplay.textContent    = `${score} / ${tot}`;
  scoreDisplay.style.color    = color;
  pctDisplay.textContent      = `${pct}% correct`;
  scoreCard.style.borderColor = color;
  progressFill.style.width    = '100%';
  showScreen('results');
}

playAgainBtn.addEventListener('click', startQuiz);
newFileBtn.addEventListener('click', () => {
  pasteInput.value          = '';
  convertStatus.textContent = '';
  convertBtn.disabled       = false;
  fileInput.value           = '';
  showScreen('welcome');
});