// ── State ─────────────────────────────────────────────────────────────────────
let questions   = [];
let currentIdx  = 0;
let score       = 0;
let answered    = false;

// ── DOM refs ──────────────────────────────────────────────────────────────────
const app          = document.getElementById('app');
const screens      = { welcome:  document.getElementById('screen-welcome'),
                        question: document.getElementById('screen-question'),
                        results:  document.getElementById('screen-results') };

const convertBtn    = document.getElementById('convert-btn');
const convertStatus = document.getElementById('convert-status') || document.getElementById('convert-status');
const pasteInput    = document.getElementById('paste-input');
const loadFileBtn   = document.getElementById('load-file-btn');
const fileInput     = document.getElementById('file-input');

const qTitle        = document.getElementById('q-title');
const qScore        = document.getElementById('q-score');
const qText         = document.getElementById('q-text');
const optionsWrap   = document.getElementById('options-wrap');
const feedback      = document.getElementById('feedback');
const nextBtn       = document.getElementById('next-btn');
const progressFill  = document.getElementById('progress-fill');

const gradeText     = document.getElementById('grade-text');
const scoreDisplay  = document.getElementById('score-display');
const pctDisplay    = document.getElementById('pct-display');
const scoreCard     = document.getElementById('score-card');
const playAgainBtn  = document.getElementById('play-again-btn');
const newFileBtn    = document.getElementById('new-file-btn');

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
  if (!raw) { convertStatus.textContent = 'Please paste some content first.'; return; }
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
    const pdfjsLib    = await loadPDFJS();
    const arrayBuffer = await file.arrayBuffer();
    const pdf         = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
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
  feedback.textContent = '';
  feedback.style.color = '';
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
      btn.className      = 'option-btn yesno-btn';
      btn.textContent    = opt;
      btn.dataset.letter = opt;
      btn.addEventListener('click', () => handleAnswer(btn, q));
      optionsWrap.appendChild(btn);
    });
  } else {
    q.options.forEach(opt => {
      const btn = document.createElement('button');
      btn.className      = 'option-btn';
      btn.textContent    = opt;
      btn.dataset.letter = opt[0].toUpperCase();
      btn.addEventListener('click', () => handleAnswer(btn, q));
      optionsWrap.appendChild(btn);
    });
  }

  showScreen('question');
}

// ── Instant answer handler ────────────────────────────────────────────────────
function handleAnswer(btn, q) {
  if (answered) return;
  answered = true;

  const userAnswer = btn.dataset.letter.toLowerCase();
  const correct    = q.answer.toLowerCase();
  const isCorrect  = userAnswer === correct;

  // lock all buttons immediately
  document.querySelectorAll('.option-btn').forEach(b => b.disabled = true);

  // brief flash on clicked button
  btn.classList.add('flash');

  setTimeout(() => {
    btn.classList.remove('flash');

    // reveal correct/wrong colors
    document.querySelectorAll('.option-btn').forEach(b => {
      if (b.dataset.letter.toLowerCase() === correct) {
        b.classList.add('correct');
      } else if (b.dataset.letter.toLowerCase() === userAnswer && !isCorrect) {
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

    qScore.textContent = `Score: ${score}`;
    nextBtn.classList.remove('hidden');
    nextBtn.textContent = currentIdx + 1 < questions.length ? 'Next Question →' : 'See Results';
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
  if (pct === 100)    { grade = 'Perfect! 🏆';              color = 'var(--success)'; }
  else if (pct >= 70) { grade = 'Well done! 🎉';            color = 'var(--accent)';  }
  else if (pct >= 40) { grade = 'Keep practising 📚';       color = '#f39c12';        }
  else                { grade = 'Better luck next time 💪'; color = 'var(--error)';   }

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

// ── Particles ─────────────────────────────────────────────────────────────────
(function spawnParticles() {
  const container = document.getElementById('particles');
  if (!container) return;
  for (let i = 0; i < 30; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    p.style.left = Math.random() * 100 + 'vw';
    p.style.animationDuration = (8 + Math.random() * 16) + 's';
    p.style.animationDelay    = (Math.random() * 12) + 's';
    p.style.width  = (1 + Math.random() * 2) + 'px';
    p.style.height = p.style.width;
    p.style.opacity = Math.random() * 0.5;
    const colors = ['#7c6af7','#a78bfa','#f472b6','#22d3ee'];
    p.style.background = colors[Math.floor(Math.random() * colors.length)];
    container.appendChild(p);
  }
})();

// ── Magic Canvas ──────────────────────────────────────────────────────────────
(function initMagicCanvas() {
  const canvas = document.getElementById('magic-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  function resize() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  // Stars
  const stars = Array.from({ length: 120 }, () => ({
    x: Math.random() * window.innerWidth,
    y: Math.random() * window.innerHeight,
    r: Math.random() * 1.2,
    speed: 0.2 + Math.random() * 0.3,
    twinkle: Math.random() * Math.PI * 2,
    twinkleSpeed: 0.02 + Math.random() * 0.03,
    color: ['#9d6fff','#c084fc','#f472b6','#fbbf24','#ffffff'][Math.floor(Math.random()*5)]
  }));

  // Magic orbs drifting across screen
  const orbs = Array.from({ length: 6 }, () => ({
    x: Math.random() * window.innerWidth,
    y: Math.random() * window.innerHeight,
    r: 60 + Math.random() * 100,
    vx: (Math.random() - 0.5) * 0.4,
    vy: (Math.random() - 0.5) * 0.4,
    color: ['rgba(157,111,255','rgba(196,132,252','rgba(244,114,182','rgba(34,211,238'][Math.floor(Math.random()*4)],
    phase: Math.random() * Math.PI * 2,
  }));

  // Shooting stars
  let shootingStars = [];
  function spawnShootingStar() {
    shootingStars.push({
      x: Math.random() * window.innerWidth * 0.7,
      y: Math.random() * window.innerHeight * 0.4,
      len: 80 + Math.random() * 120,
      speed: 6 + Math.random() * 6,
      angle: Math.PI / 4 + (Math.random() - 0.5) * 0.3,
      life: 1,
    });
  }
  setInterval(spawnShootingStar, 3000 + Math.random() * 4000);

  function draw(t) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Orbs
    orbs.forEach(o => {
      o.phase += 0.005;
      o.x += o.vx;
      o.y += o.vy;
      if (o.x < -o.r) o.x = canvas.width + o.r;
      if (o.x > canvas.width + o.r) o.x = -o.r;
      if (o.y < -o.r) o.y = canvas.height + o.r;
      if (o.y > canvas.height + o.r) o.y = -o.r;

      const alpha = 0.04 + Math.sin(o.phase) * 0.02;
      const grad = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, o.r);
      grad.addColorStop(0, `${o.color},${alpha})`);
      grad.addColorStop(1, `${o.color},0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2);
      ctx.fill();
    });

    // Stars
    stars.forEach(s => {
      s.twinkle += s.twinkleSpeed;
      const alpha = 0.3 + Math.sin(s.twinkle) * 0.4;
      ctx.globalAlpha = Math.max(0, alpha);
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    // Shooting stars
    shootingStars = shootingStars.filter(ss => ss.life > 0);
    shootingStars.forEach(ss => {
      ss.x += Math.cos(ss.angle) * ss.speed;
      ss.y += Math.sin(ss.angle) * ss.speed;
      ss.life -= 0.025;

      const grad = ctx.createLinearGradient(
        ss.x, ss.y,
        ss.x - Math.cos(ss.angle) * ss.len,
        ss.y - Math.sin(ss.angle) * ss.len
      );
      grad.addColorStop(0, `rgba(255,255,255,${ss.life})`);
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(ss.x, ss.y);
      ctx.lineTo(ss.x - Math.cos(ss.angle) * ss.len, ss.y - Math.sin(ss.angle) * ss.len);
      ctx.stroke();
    });

    requestAnimationFrame(draw);
  }

  requestAnimationFrame(draw);
})();
