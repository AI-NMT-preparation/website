/* =====================================================================
   BOLEST.AI — ЛОГІКА ФРОНТЕНДУ ТА SUPABASE
   ===================================================================== */

const SUPABASE_URL = 'https://envhnssxtxcoxazfblfg.supabase.co';
const SUPABASE_KEY = 'sb_publishable_G1U5Iy7GZQaAIM8Uoah-4g_2-A2xDoX'; 

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentUser = null; 
let currentProfile = null;
let authMode = "login"; 

const SUBJECTS_META = {
  math: { label: "Математика", max: 32 },
  ukrainian: { label: "Українська мова", max: 45 },
  history: { label: "Історія України", max: 54 }
};

const SUBJECT_COLORS = {
  math: "#f472b6",
  ukrainian: "#facc15",
  history: "#4ade80"
};

const TOPICS = {
  math: [
    { key: "numbers_expressions", label: "Числа і вирази" },
    { key: "equations_inequalities", label: "Рівняння, нерівності та їх системи" },
    { key: "functions", label: "Функції та їх властивості" },
    { key: "combinatorics_probability_stats", label: "Елементи комбінаторики, основи теорії ймовірностей та математичної статистики" },
    { key: "planimetry", label: "Планіметрія" },
    { key: "stereometry", label: "Стереометрія" }
  ],
  ukrainian: [
    { key: "phonetics", label: "Фонетика, графіка, орфоепія" },
    { key: "morphology", label: "Морфологія" },
    { key: "syntax", label: "Синтаксис" },
    { key: "spelling", label: "Орфографія" },
    { key: "punctuation", label: "Пунктуація" },
    { key: "stylistics", label: "Стилістика (розвиток мовлення)" }
  ],
  history: [
    { key: "intro_ancient", label: "Вступ до історії та найдавніша історія України" },
    { key: "kyivan_rus", label: "Русь-Україна (Київська держава) та Королівство Руське" },
    { key: "lands_14_16", label: "Українські землі у другій половині XIV — першій половині XVI ст." },
    { key: "rzeczpospolita", label: "Українські землі у складі Речі Посполитої (XVI — перша половина XVII ст.)" },
    { key: "liberation_war", label: "Національно-визвольна війна українського народу середини XVII ст." },
    { key: "cossack_ruin", label: "Козацька Україна (Руїна, Гетьманщина) у другій половині XVII–XVIII ст." },
    { key: "lands_18_19", label: "Українські землі наприкінці XVIII — у першій половині XIX ст." },
    { key: "lands_19", label: "Українські землі у другій половині XIX ст." },
    { key: "wwi_revolution", label: "Україна в роки Першої світової війни та Українська революція (1914–1921)" },
    { key: "interwar", label: "Україна в межвоєнний період (УСРР у 1920–1930-х рр., голодомори)" },
    { key: "postwar_independence", label: "Україна в повоєнний період і період незалежності (до початку XXI ст.)" }
  ]
};

function showScreen(id) {
  document.querySelectorAll(".screen").forEach(el => el.classList.remove("active"));
  document.getElementById(id).classList.add("active");
}

/* ---------------------------------------------------------------------
   АВТОРИЗАЦІЯ
   --------------------------------------------------------------------- */
const emailInput = document.getElementById("email-input");
const passwordInput = document.getElementById("password-input");
const authSubmitBtn = document.getElementById("auth-submit-btn");
const authSwitchBtn = document.getElementById("auth-switch-btn");
const authSwitchText = document.getElementById("auth-switch-text");
const authModeSubtitle = document.getElementById("auth-mode-subtitle");
const authNote = document.getElementById("auth-note");

function setAuthMode(mode) {
  authMode = mode;
  authNote.textContent = "";
  if (mode === "login") {
    authModeSubtitle.textContent = "Увійдіть у свій акаунт";
    authSubmitBtn.textContent = "Увійти";
    authSwitchText.textContent = "Немає акаунту?";
    authSwitchBtn.textContent = "Зареєструватися";
  } else {
    authModeSubtitle.textContent = "Створіть новий акаунт";
    authSubmitBtn.textContent = "Зареєструватися";
    authSwitchText.textContent = "Вже є акаунт?";
    authSwitchBtn.textContent = "Увійти";
  }
}

authSwitchBtn.addEventListener("click", () => setAuthMode(authMode === "login" ? "register" : "login"));
authSubmitBtn.addEventListener("click", handleAuthSubmit);
passwordInput.addEventListener("keydown", (e) => { if (e.key === "Enter") handleAuthSubmit(); });

async function handleAuthSubmit() {
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  if (!email || !password) { authNote.textContent = "Заповніть email та пароль."; return; }

  authSubmitBtn.disabled = true;
  authNote.textContent = "";

  try {
    let authData, authError;
    if (authMode === "login") {
      const res = await supabaseClient.auth.signInWithPassword({ email, password });
      authData = res.data; authError = res.error;
    } else {
      const res = await supabaseClient.auth.signUp({ email, password });
      authData = res.data; authError = res.error;
    }
    if (authError) throw authError;
    currentUser = authData.user;
    await checkAndLoadProfile();
  } catch (err) {
    authNote.textContent = err.message || "Помилка авторизації";
  } finally {
    authSubmitBtn.disabled = false;
  }
}

async function checkAndLoadProfile() {
  if (!currentUser) return;
  const { data: profile } = await supabaseClient.from('profiles').select('*').eq('id', currentUser.id).maybeSingle();
  if (profile) {
    currentProfile = profile;
    renderDashboard();
    showScreen("screen-dashboard");
  } else {
    showScreen("screen-setup");
  }
}

/* ---------------------------------------------------------------------
   НАЛАШТУВАННЯ ПРОФІЛЮ
   --------------------------------------------------------------------- */
const avatarInput = document.getElementById("avatar-input");
const avatarImg = document.getElementById("avatar-img");
const avatarPlaceholder = document.getElementById("avatar-placeholder");
const nicknameInput = document.getElementById("nickname-input");
const descriptionInput = document.getElementById("description-input");
const finishSetupBtn = document.getElementById("finish-setup-btn");

document.getElementById("random-quote-btn").addEventListener("click", () => {
  const QUOTES = ["Знання — це зброя.", "Маленькі кроки щодня ведуть до великого успіху.", "Дисципліна б'є талант."];
  descriptionInput.value = QUOTES[Math.floor(Math.random() * QUOTES.length)];
});

avatarInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (event) => {
    avatarImg.src = event.target.result;
    avatarImg.style.display = "block";
    avatarPlaceholder.style.display = "none";
  };
  reader.readAsDataURL(file);
});

finishSetupBtn.addEventListener("click", async () => {
  const nickname = nicknameInput.value.trim();
  if (!nickname) { nicknameInput.focus(); nicknameInput.style.borderColor = "#f87171"; return; }
  finishSetupBtn.disabled = true;

  try {
    const { data, error } = await supabaseClient
      .from('profiles').insert([{ id: currentUser.id, nickname: nickname, description: descriptionInput.value.trim(), xp: 0, level: 1 }])
      .select().single();
    if (error) throw error;
    currentProfile = data;
    leaderboardCache = null; 
    renderDashboard();
    showScreen("screen-dashboard");
  } catch (err) {
    alert("Помилка збереження: " + err.message);
  } finally {
    finishSetupBtn.disabled = false;
  }
});

/* ---------------------------------------------------------------------
   ГОЛОВНА СТОРІНКА ТА РЕНДЕР
   --------------------------------------------------------------------- */
function renderDashboard() {
  if (!currentProfile) return;
  const totalXp = Math.max(0, Number(currentProfile.xp || 0));
  const { level, currentLevelXp, nextLevelXp } = getLevelProgress(totalXp);
  const expIntoLevel = totalXp - currentLevelXp;
  const expNeeded = nextLevelXp - currentLevelXp;
  const progressPct = Math.min(100, Math.max(0, (expIntoLevel / expNeeded) * 100));

  document.getElementById("level-title").textContent = `Рівень ${level}`;
  document.getElementById("level-points").textContent = `${expIntoLevel}/${expNeeded}`;
  document.getElementById("xp-fill").style.width = `${progressPct}%`;

  ["math", "ukrainian", "history"].forEach(subj => {
    const score = currentProfile[`${subj}_score`];
    document.getElementById(`score-${subj}`).textContent = score ?? "—";
    document.getElementById(`range-${subj}`).textContent = score ? `Шкала: 100–200 · максимум: ${SUBJECTS_META[subj].max}` : "Ще не складали";
  });

  renderPriorities();
  renderAnalytics();
}

function renderPriorities() {
  const listEl = document.getElementById("priorities-list");
  const progress = currentProfile.topic_progress || {};
  let html = "";
  Object.keys(TOPICS).forEach(subject => {
    TOPICS[subject].forEach(topic => {
      html += `<div class="session-item" style="padding: 10px 0; border-bottom: 1px solid var(--border-color);">
          <div style="font-size: 12px; color: ${SUBJECT_COLORS[subject]};">${SUBJECTS_META[subject].label}</div>
          <div style="font-weight: 600;">${topic.label}</div>
          <div style="font-size: 13px; color: ${SUBJECT_COLORS[subject]};">Розв'язано: ${progress[`${subject}:${topic.key}`] || 0}</div>
        </div>`;
    });
  });
  listEl.innerHTML = html;
}

function renderAnalytics() {
  if (!currentProfile) return;
  ["math", "ukrainian", "history"].forEach(subject => {
    const q = currentProfile[`${subject}_questions`] || 0;
    const c = currentProfile[`${subject}_correct`] || 0;
    document.getElementById(`an-${subject}-questions`).textContent = q;
    document.getElementById(`an-${subject}-accuracy`).textContent = q > 0 ? `${Math.round((c / q) * 100)}%` : "0%";
    document.getElementById(`an-table-${subject}`).textContent = currentProfile[`${subject}_score`] ?? "—";
  });
  renderAnalyticsChart();
}

function renderAnalyticsChart() {
  const svg = document.getElementById("analytics-chart");
  svg.innerHTML = "";
  const histories = { math: currentProfile.math_history || [], ukrainian: currentProfile.ukrainian_history || [], history: currentProfile.history_history || [] };
  const maxLen = Math.max(...Object.values(histories).map(h => h.length));
  document.getElementById("chart-empty-note").style.display = maxLen > 0 ? "none" : "block";
  if (maxLen === 0) return;

  const w = 640, h = 280, p = { top: 20, right: 20, bottom: 30, left: 44 };
  const plotW = w - p.left - p.right, plotH = h - p.top - p.bottom;
  const getX = i => p.left + (maxLen === 1 ? plotW / 2 : (i / (maxLen - 1)) * plotW);
  // Шкала графіка завжди повна: 0–200.
  const getY = score => p.top + plotH - (Math.max(0, Math.min(200, Number(score) || 0)) / 200) * plotH;

  [0, 50, 100, 150, 200].forEach(val => {
    const y = getY(val);
    svg.insertAdjacentHTML("beforeend", `<line x1="${p.left}" y1="${y}" x2="${w - p.right}" y2="${y}" stroke="#2c2d34"/><text x="4" y="${y + 4}" font-size="11" fill="#9a9ba3">${val}</text>`);
  });

  Object.keys(histories).forEach(subj => {
    const hist = histories[subj];
    if (hist.length === 0) return;
    const points = hist.map((s, i) => `${getX(i)},${getY(s)}`).join(" ");
    svg.insertAdjacentHTML("beforeend", `<polyline points="${points}" fill="none" stroke="${SUBJECT_COLORS[subj]}" stroke-width="2.5" stroke-linejoin="round"/>`);
    hist.forEach((s, i) => svg.insertAdjacentHTML("beforeend", `<circle cx="${getX(i)}" cy="${getY(s)}" r="3.5" fill="${SUBJECT_COLORS[subj]}" />`));
  });
}

function renderProfileView() {
  document.getElementById("profile-level").textContent = `Рівень ${currentProfile.level || 1}`;
  document.getElementById("profile-questions").textContent = `${(currentProfile.math_questions || 0) + (currentProfile.ukrainian_questions || 0) + (currentProfile.history_questions || 0)} питань`;
  document.getElementById("profile-nickname").textContent = currentProfile.nickname || "—";
  document.getElementById("profile-description").textContent = currentProfile.description || "Опис відсутній";
  if (currentProfile.avatar) {
    document.getElementById("profile-avatar-img").src = currentProfile.avatar;
    document.getElementById("profile-avatar-img").style.display = "block";
    document.getElementById("profile-avatar-placeholder").style.display = "none";
  }
}

let leaderboardFilter = "questions", leaderboardCache = null;
async function loadLeaderboard() {
  const listEl = document.getElementById("leaderboard-list");
  if (!leaderboardCache) {
    listEl.innerHTML = `<p class="leaderboard-empty">Завантаження...</p>`;
    const { data, error } = await supabaseClient.from('profiles').select('*').limit(200);
    if (error) { listEl.innerHTML = `<p class="leaderboard-empty">Помилка: ${error.message}</p>`; return; }
    leaderboardCache = data.map(row => {
      const tq = (row.math_questions || 0) + (row.ukrainian_questions || 0) + (row.history_questions || 0);
      const tc = (row.math_correct || 0) + (row.ukrainian_correct || 0) + (row.history_correct || 0);
      return { ...row, totalQuestions: tq, accuracy: tq > 0 ? Math.round((tc / tq) * 100) : 0 };
    });
  }
  let rows = [...leaderboardCache];
  let valKey = leaderboardFilter === "questions" ? "totalQuestions" : (leaderboardFilter === "accuracy" ? "accuracy" : `${leaderboardFilter}_score`);
  let suffix = leaderboardFilter === "accuracy" ? "%" : "";
  
  rows = leaderboardFilter === "questions" || leaderboardFilter === "accuracy" ? rows : rows.filter(r => r[valKey] != null);
  rows.sort((a, b) => b[valKey] - a[valKey]);

  if (rows.length === 0) { listEl.innerHTML = `<p class="leaderboard-empty">Немає результатів.</p>`; return; }
  listEl.innerHTML = rows.slice(0, 20).map((r, i) => `
    <div class="leaderboard-row">
      <span class="leaderboard-rank">${i + 1}</span>
      <span class="leaderboard-name">${r.nickname || "Анонім"}</span>
      <span class="leaderboard-value">${r[valKey]}${suffix}</span>
    </div>`).join("");
}

document.querySelectorAll(".filter-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    leaderboardFilter = btn.dataset.filter;
    loadLeaderboard();
  });
});

/* ---------------------------------------------------------------------
   МОДАЛКИ
   --------------------------------------------------------------------- */
const modalOverlay = document.getElementById("modal-overlay");
const modalContent = document.getElementById("modal-content");
function openModal(html) { modalContent.innerHTML = html; modalOverlay.classList.add("active"); }
function closeModal() { modalOverlay.classList.remove("active"); }
document.getElementById("modal-close").addEventListener("click", closeModal);
modalOverlay.addEventListener("click", (e) => { if (e.target === modalOverlay) closeModal(); });

/* ---------------------------------------------------------------------
   НАВЧАЛЬНА СЕСІЯ / ПРОБНИЙ ТЕСТ
   Питання беруться з public.questions, а якщо там їх немає —
   напряму з таблиці теми у схемі math / ukrainian / history.
   --------------------------------------------------------------------- */

let activeQuestions = [];
let currentQuestionIndex = 0;
let correctAnswersCount = 0;
let activeSubject = "";
let activeMode = "session";
let activeQuestionResults = [];
let questionAnswers = []; // збережений вибір користувача по кожному питанню (можна змінювати до завершення сесії)
let hintState = []; // скільки підказок вже відкрито по кожному питанню (session mode)
let sessionTopicCounts = {};
let questionStartedAt = null;
let questionElapsedMs = [];
let questionFinalized = []; // true only after an answer exists AND the user clicks "Next"
let questionTimerInterval = null;
let testStartedAt = null;
let testRemainingMs = 60 * 60 * 1000;
let testTimerInterval = null;
let completedAnalytics = null;

const NMT_COUNTS = { math: 22, ukrainian: 30, history: 30 };

/* Рендер LaTeX-формул (KaTeX auto-render) у заданому DOM-контейнері.
   Підтримує $...$ та $$...$$, а також \( \) і \[ \]. */
function renderMathIn(container) {
  if (!container || typeof window.renderMathInElement !== "function") return;
  try {
    window.renderMathInElement(container, {
      delimiters: [
        { left: "$$", right: "$$", display: true },
        { left: "$", right: "$", display: false },
        { left: "\\(", right: "\\)", display: false },
        { left: "\\[", right: "\\]", display: true }
      ],
      throwOnError: false
    });
  } catch (e) {
    console.warn("KaTeX render error:", e);
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function parseJson(value, fallback) {
  if (value == null) return fallback;
  if (typeof value === "object") return value;
  try { return JSON.parse(value); } catch { return fallback; }
}

function normalizeQuestionType(value) {
  const raw = String(value ?? '').trim().toLowerCase();
  const aliases = {
    single: 'single_choice',
    choice: 'single_choice',
    singlechoice: 'single_choice',
    single_choice: 'single_choice',
    matching: 'matching',
    correspondence: 'matching',
    matching_question: 'matching',
    відповідність: 'matching',
    short: 'short_answer',
    short_answer: 'short_answer',
    free_text: 'short_answer',
    text_answer: 'short_answer',
    own_answer: 'short_answer',
    user_answer: 'short_answer',
    input: 'short_answer',
    multiple: 'multiple_choice',
    multiple_choice: 'multiple_choice',
    multi_choice: 'multiple_choice',
    table: 'table'
  };
  return aliases[raw] || 'single_choice';
}

function normalizeOptionToken(value) {
  if (value == null) return '';
  const s = String(value).trim().toLowerCase();
  const map = { a:'a', b:'b', c:'c', d:'d', e:'e', а:'a', б:'b', в:'c', г:'d', ґ:'e' };
  if (map[s]) return map[s];
  const optionMatch = s.match(/^option[_\s-]?([a-e])$/i);
  if (optionMatch) return optionMatch[1].toLowerCase();
  if (/^[1-5]$/.test(s)) return ['a','b','c','d','e'][Number(s) - 1];
  return s;
}

function normalizeCorrect(value) {
  if (value == null) return null;
  if (typeof value === 'object') return value;
  const s = String(value).trim();
  const option = normalizeOptionToken(s);
  if (['a','b','c','d','e'].includes(option)) return { option };
  return { value: s };
}

function readIndexedColumns(row, prefix, max = 10) {
  const result = [];
  for (let i = 1; i <= max; i++) {
    const value = row[`${prefix}_${i}`];
    if (value != null && String(value).trim() !== '') {
      result.push({ index: i, value });
    }
  }
  return result;
}

function buildMatchingData(row, options) {
  const leftColumns = readIndexedColumns(row, 'subquestion', 10);
  const answerColumns = readIndexedColumns(row, 'right_answer', 10);

  // Primary format: subquestion_1..N + option_a..e + right_answer_1..N.
  if (leftColumns.length) {
    const left = leftColumns.map(({ index, value }) => ({ id: index, label: String(value) }));

    // Для matching значення відповіді в БД — option_a / option_b / ... .
    // Тому саме ці токени використовуємо як value, а не A/B/C/D.
    const letters = ["a", "b", "c", "d", "e"];
    const right = options.map((text, i) => ({
      id: `option_${letters[i]}`,
      label: String(text)
    }));

    const correct = {};
    answerColumns.forEach(({ index, value }) => {
      const token = normalizeOptionToken(value);
      if (token && letters.includes(token)) {
        correct[String(index)] = `option_${token}`;
      }
    });
    return { left, right, correct };
  }

  // Backward compatibility with the previous JSON-based matching format.
  const legacyLeft = parseJson(row.matching_left, []);
  const legacyRight = parseJson(row.matching_right, []);
  let legacyCorrect = parseJson(row.correct_answer, null);
  if (!legacyCorrect || (typeof legacyCorrect === 'object' && Object.keys(legacyCorrect).length === 0)) {
    legacyCorrect = {};
  }
  return {
    left: Array.isArray(legacyLeft) ? legacyLeft : [],
    right: Array.isArray(legacyRight) ? legacyRight : [],
    correct: legacyCorrect
  };
}

function normalizeQuestion(row, subject, topicKey) {
  const type = normalizeQuestionType(row.question_type);

  let options = parseJson(row.options, []);
  if (!Array.isArray(options) || options.length === 0) {
    options = [row.option_a, row.option_b, row.option_c, row.option_d, row.option_e]
      .filter(v => v != null && String(v).trim() !== '');
  }

  let correct = parseJson(row.correct_answer, null);
  if (!correct || (typeof correct === 'object' && Object.keys(correct).length === 0)) {
    correct = normalizeCorrect(row.right_answer);
  }
  if (!correct && row.correct_option != null) correct = normalizeCorrect(row.correct_option);
  if (!correct && row.correct_index != null) correct = { index: Number(row.correct_index) };

  const matching = buildMatchingData(row, options);
  if (type === 'matching' && matching.left.length && matching.right.length) {
    correct = matching.correct;
  }

  return {
    id: row.id,
    exam_position: row.exam_position ?? row.nmt_number ?? row.question_number ?? row.task_number ?? row.position ?? row.order ?? row.number ?? null,
    subject,
    topic: row.topic || topicKey,
    question_type: type,
    question_text: row.question_text || row.question || '',
    image_path: row.image_path || null,
    options,
    correct_answer: correct || {},
    matching_left: matching.left,
    matching_right: matching.right,
    table_data: parseJson(row.table_data, null),
    hint1: row.hint1 || null,
    hint2: row.hint2 || null,
    hint3: row.hint3 || null,
    weight: row.weight != null && Number(row.weight) > 0 ? Number(row.weight) : 1,
    solutionImages: [row.hint_image_1, row.hint_image_2, row.hint_image_3].filter(v => v != null && String(v).trim() !== ''),
    explanation: row.explanation || null
  };
}

let lastFetchErrors = [];

async function fetchTopicQuestions(subject, topicKey) {
  // 1. Новий універсальний формат: public.questions
  const universal = await supabaseClient
    .from("questions")
    .select("*")
    .eq("subject", subject)
    .eq("topic", topicKey);

  if (!universal.error && universal.data && universal.data.length) {
    return universal.data.map(row => normalizeQuestion(row, subject, topicKey));
  }
  if (universal.error) {
    console.warn(`public.questions (${subject}/${topicKey}):`, universal.error.message);
  }

  // 2. Формат, який уже є у користувача: math.equations_inequalities,
  // ukrainian.syntax, history.kyivan_rus тощо.
  const direct = await supabaseClient
    .schema(subject)
    .from(topicKey)
    .select("*");

  if (direct.error) {
    console.warn(`Не вдалося прочитати ${subject}.${topicKey}:`, direct.error.message);
    lastFetchErrors.push(`${subject}.${topicKey}: ${direct.error.message}`);
    return [];
  }
  return (direct.data || []).map(row => normalizeQuestion(row, subject, topicKey));
}

function shuffle(array) {
  const a = [...array];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function loadQuestionsForPlan(subject, plan) {
  lastFetchErrors = [];
  const result = [];
  for (const item of plan) {
    const rows = await fetchTopicQuestions(subject, item.topic);
    if (!rows.length) continue;
    result.push(...shuffle(rows).slice(0, Math.max(1, Math.min(10, Number(item.count) || 1))));
  }
  return shuffle(result);
}

async function loadNmtQuestions(subject) {
  lastFetchErrors = [];
  const topics = TOPICS[subject] || [];
  const pools = [];
  for (const topic of topics) {
    const rows = await fetchTopicQuestions(subject, topic.key);
    if (rows.length) pools.push({ topic: topic.key, rows: shuffle(rows) });
  }
  if (!pools.length) return [];

  const target = NMT_COUNTS[subject];
  const selected = [];
  let cursor = 0;
  let guard = 0;
  while (selected.length < target && guard < target * 20) {
    const pool = pools[cursor % pools.length];
    if (pool.rows.length) selected.push(pool.rows.shift());
    pools.splice(0, 0); // no-op: keeps array stable
    cursor++;
    if (pools.every(p => p.rows.length === 0)) break;
    guard++;
  }
  return shuffle(selected).slice(0, target);
}

function topicLabel(subject, key) {
  const found = (TOPICS[subject] || []).find(t => t.key === key);
  return found ? found.label : key || "Загальне";
}


/* ==================== РІВНІ ТА ТАЙМЕРИ ==================== */
function getLevelProgress(totalXp) {
  let level = 1;
  let currentLevelXp = 0;
  let nextLevelXp = 100;

  while (totalXp >= nextLevelXp && level < 60) {
    level += 1;
    currentLevelXp = nextLevelXp;
    nextLevelXp = currentLevelXp + 100 * Math.pow(2, level - 1);
  }

  return { level, currentLevelXp, nextLevelXp };
}

function formatTime(ms) {
  const sec = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/*
 * Рекомендований час із таблиці користувача.
 * Для НМТ використовуємо реальний exam_position, якщо він є в рядку БД.
 * У навчальній сесії, де питання перемішані, запасний варіант — тип завдання.
 */
const TIME_LIMITS = {
  ukrainian: [
    { from: 1, to: 25, sec: 45 },
    { from: 26, to: 30, sec: 120 }
  ],
  math: [
    { from: 1, to: 15, sec: 120 },
    { from: 16, to: 18, sec: 180 },
    { from: 19, to: 22, sec: 330 }
  ],
  history: [
    { from: 1, to: 20, sec: 48 },
    { from: 21, to: 24, sec: 120 },
    { from: 25, to: 27, sec: 150 },
    { from: 28, to: 30, sec: 150 }
  ]
};

function getRecommendedSeconds(subject, questionNumber, question = null) {
  // Якщо в БД є справжній номер завдання НМТ — використовуємо його.
  // Для навчальної сесії, де питання перемішані, орієнтуємося на тип завдання.
  const examPosition = question?.exam_position;
  if (Number.isFinite(Number(examPosition)) && Number(examPosition) > 0) {
    const band = (TIME_LIMITS[subject] || []).find(x => Number(examPosition) >= x.from && Number(examPosition) <= x.to);
    if (band) return band.sec;
  }

  const type = String(question?.question_type || "single_choice").toLowerCase();
  const is = (...names) => names.includes(type);

  if (subject === "ukrainian") {
    if (is("matching", "correspondence", "matching_question")) return 120;
    if (is("short_answer", "short", "open", "open_answer")) return 90; // розширення для власної відповіді
    if (is("multiple_choice", "multi_choice", "multiple")) return 90;
    return 45; // середина рекомендованого діапазону 35–50 с
  }

  if (subject === "math") {
    if (is("matching", "correspondence", "matching_question")) return 180;
    if (is("short_answer", "short", "open", "open_answer")) return 330; // середина 5–6 хв
    if (is("multiple_choice", "multi_choice", "multiple")) return 120;
    return 120;
  }

  if (subject === "history") {
    if (is("matching", "correspondence", "matching_question")) return 120;
    if (is("short_answer", "short", "open", "open_answer")) return 120; // розширення для власної відповіді
    if (is("sequence", "ordering", "order", "multiple_choice", "multi_choice", "multiple", "table")) return 150;
    return 48; // середина рекомендованого діапазону 45–50 с
  }

  return 120;
}

function getCurrentQuestionTimerElement() {
  return document.getElementById(activeMode === "test" ? "test-question-timer" : "session-question-timer");
}

function renderCurrentQuestionTimer() {
  const el = getCurrentQuestionTimerElement();
  if (!el) return;
  el.textContent = formatTime(questionElapsedMs[currentQuestionIndex] || 0);
}

function startQuestionTimer() {
  stopQuestionTimer();

  // Вопрос замораживается только после выполнения ОБОИХ условий:
  // 1) есть ответ;
  // 2) пользователь нажал «Наступне питання».
  // Если ответ был введён/проверен, но пользователь вернулся к вопросу до
  // перехода вперёд, таймер продолжает идти.
  if (questionFinalized[currentQuestionIndex] === true) {
    questionStartedAt = null;
    renderCurrentQuestionTimer();
    return;
  }

  questionStartedAt = performance.now();
  const el = getCurrentQuestionTimerElement();
  if (!el) return;

  const render = () => {
    const elapsed = (performance.now() - questionStartedAt) + (questionElapsedMs[currentQuestionIndex] || 0);
    el.textContent = formatTime(elapsed);
  };

  render();
  questionTimerInterval = setInterval(render, 250);
}

function stopQuestionTimer() {
  if (questionTimerInterval) {
    clearInterval(questionTimerInterval);
    questionTimerInterval = null;
  }
}

function captureCurrentQuestionElapsed() {
  if (questionStartedAt == null) {
    renderCurrentQuestionTimer();
    return;
  }

  const elapsed = Math.max(0, performance.now() - questionStartedAt);
  questionElapsedMs[currentQuestionIndex] = (questionElapsedMs[currentQuestionIndex] || 0) + elapsed;
  questionStartedAt = null;
  stopQuestionTimer();
  renderCurrentQuestionTimer();
}

function startTestOverallTimer() {
  clearInterval(testTimerInterval);
  testRemainingMs = 60 * 60 * 1000;
  const el = document.getElementById("test-total-timer");
  const render = () => {
    if (!el) return;
    el.textContent = formatTime(testRemainingMs);
    el.classList.toggle("is-warning", testRemainingMs <= 5 * 60 * 1000);
  };
  render();

  testTimerInterval = setInterval(() => {
    testRemainingMs -= 250;
    render();

    if (testRemainingMs <= 0) {
      clearInterval(testTimerInterval);
      testTimerInterval = null;
      finishTrialTest(true);
    }
  }, 250);
}

function stopAllTimers() {
  stopQuestionTimer();
  clearInterval(testTimerInterval);
  testTimerInterval = null;
  testRemainingMs = 60 * 60 * 1000;
}

function buildCompletedAnalytics(mode, subject) {
  const totalQuestions = activeQuestions.length;
  const correct = tallyResults();

  // Временная аналитика показывается ТОЛЬКО для правильных ответов.
  const questions = activeQuestions
    .map((q, i) => ({ q, i, answer: questionAnswers[i] }))
    .filter(({ answer }) => !!(answer && answer.correct))
    .map(({ q, i }) => ({
      number: i + 1,
      topic: q.topic,
      questionType: q.question_type,
      timeMs: Math.max(0, Math.round(questionElapsedMs[i] || 0)),
      limitSec: getRecommendedSeconds(subject, i + 1, q),
      correct: true
    }));

  const totalTime = questions.reduce((sum, item) => sum + item.timeMs, 0);
  const averageMs = questions.length ? totalTime / questions.length : 0;

  return {
    mode,
    subject,
    totalQuestions,
    correct,
    accuracy: totalQuestions ? Math.round((correct / totalQuestions) * 100) : 0,
    timedQuestionsCount: questions.length,
    averageMs,
    totalTime,
    overallLimitMs: mode === "test" ? 60 * 60 * 1000 : null,
    questions
  };
}

function renderCompletedAnalytics() {
  if (!completedAnalytics) return;

  const data = completedAnalytics;
  document.getElementById("result-mode-badge").textContent = data.mode === "test" ? "Пробний тест" : "Навчальна сесія";
  document.getElementById("result-subtitle").textContent =
    `${SUBJECTS_META[data.subject]?.label || data.subject} · деталізація темпу по кожному питанню`;

  document.getElementById("result-accuracy").textContent = `${data.accuracy}%`;
  document.getElementById("result-score-line").textContent = `${data.correct} з ${data.totalQuestions} правильних`;
  document.getElementById("result-avg-time").textContent = data.timedQuestionsCount ? formatTime(data.averageMs) : "—";
  document.getElementById("result-time-line").textContent = data.timedQuestionsCount
    ? "Середнє лише за правильними відповідями"
    : "Час не показується: немає правильних відповідей";
  document.getElementById("result-total-time").textContent = data.timedQuestionsCount ? formatTime(data.totalTime) : "—";

  const scoreEl = document.getElementById("result-nmt-score");
  const rawEl = document.getElementById("result-raw-score-line");
  if (scoreEl) {
    scoreEl.textContent = data.mode === "test" && data.nmtScore != null ? `${data.nmtScore} / 200` : "—";
  }
  if (rawEl) {
    rawEl.textContent = data.mode === "test" && data.rawScore != null
      ? `Сирий бал: ${data.rawScore} / ${data.rawMax}`
      : "Тільки для пробного тесту";
  }

  const totalLimitEl = document.getElementById("result-total-limit");
  if (totalLimitEl) totalLimitEl.textContent = "";

  const host = document.getElementById("result-questions-list");
  if (!data.questions.length) {
    host.innerHTML = `<div class="result-no-time">⏱️ Часова аналітика відсутня: у цій спробі немає правильних відповідей.</div>`;
    showScreen("screen-result");
    return;
  }
  host.innerHTML = data.questions.map(item => {
    const limitMs = item.limitSec * 1000;
    const ratio = limitMs > 0 ? item.timeMs / limitMs : 0;
    const fillPct = Math.min(100, Math.round(ratio * 100));
    const good = item.timeMs <= limitMs;
    const status = good ? "Відмінно, ти легенда! 🔥" : "дуже повільно!!(((";
    const statusClass = good ? "good" : "slow";

    return `
      <div class="result-question-row">
        <div class="result-q-meta">
          <div>
            <strong>Питання ${item.number}</strong>
            <span class="result-q-topic">${escapeHtml(topicLabel(data.subject, item.topic))}</span>
          </div>
          <div class="result-q-time">${formatTime(item.timeMs)}</div>
        </div>
        <div class="result-scale">
          <div class="result-scale-fill ${statusClass}" style="width:${fillPct}%"></div>
          <span class="result-scale-limit">Рекомендовано: ${formatTime(limitMs)}</span>
        </div>
        <div class="result-q-footer">
          <span class="result-q-status ${statusClass}">${status}</span>
          <span class="result-q-limit-note">Рекомендовано: ${formatTime(limitMs)}</span>
        </div>
      </div>
    `;
  }).join("");

  showScreen("screen-result");
}

function openSessionSetup() {
  const subjectOptions = Object.entries(SUBJECTS_META)
    .map(([key, meta]) => `<option value="${key}">${meta.label}</option>`).join("");

  openModal(`
    <h3>Навчальна сесія</h3>
    <label class="modal-field-label">Предмет</label>
    <select id="modal-subject-select">${subjectOptions}</select>
    <div class="session-plan-head">
      <label><input type="checkbox" id="all-topics-check" checked> Усі теми</label>
      <span>Кількість питань: 1–10 для кожної обраної теми</span>
    </div>
    <div id="session-topic-picker" class="session-topic-picker"></div>
    <button class="modal-submit-btn" id="start-session-btn" type="button">Почати сесію</button>
    <div id="modal-status" class="modal-result"></div>
  `);

  const select = document.getElementById("modal-subject-select");
  const picker = document.getElementById("session-topic-picker");
  const allCheck = document.getElementById("all-topics-check");

  function renderTopicPicker() {
    const topics = TOPICS[select.value] || [];
    picker.innerHTML = topics.map((t, i) => `
      <div class="session-topic-row">
        <label class="session-topic-check">
          <input type="checkbox" class="topic-check" data-topic="${t.key}" checked>
          <span>${escapeHtml(t.label)}</span>
        </label>
        <input type="range" class="topic-count" data-topic="${t.key}" min="1" max="10" value="${i === 0 ? 2 : 1}">
        <output class="topic-count-value" data-for="${t.key}">${i === 0 ? 2 : 1}</output>
      </div>
    `).join("");

    picker.querySelectorAll(".topic-count").forEach(range => {
      range.addEventListener("input", () => {
        const out = picker.querySelector(`[data-for="${range.dataset.topic}"]`);
        if (out) out.textContent = range.value;
      });
    });
    picker.querySelectorAll(".topic-check").forEach(check => {
      check.addEventListener("change", () => {
        allCheck.checked = [...picker.querySelectorAll(".topic-check")].every(x => x.checked);
      });
    });
  }

  select.addEventListener("change", renderTopicPicker);
  allCheck.addEventListener("change", () => {
    picker.querySelectorAll(".topic-check").forEach(c => c.checked = allCheck.checked);
  });
  renderTopicPicker();

  document.getElementById("start-session-btn").addEventListener("click", async () => {
    const selected = [...picker.querySelectorAll(".topic-check:checked")];
    if (!selected.length) {
      document.getElementById("modal-status").textContent = "Оберіть хоча б одну тему.";
      return;
    }
    const plan = selected.map(check => ({
      topic: check.dataset.topic,
      count: Number(picker.querySelector(`.topic-count[data-topic="${check.dataset.topic}"]`).value)
    }));
    const status = document.getElementById("modal-status");
    status.textContent = "Завантажую питання з таблиць...";
    const questions = await loadQuestionsForPlan(select.value, plan);
    if (!questions.length) {
      status.textContent = lastFetchErrors.length
        ? `Помилка доступу до таблиць: ${lastFetchErrors.join(" | ")}. Найімовірніше схему потрібно додати в "Exposed schemas" у Supabase (Project Settings → Data API) та перевірити RLS.`
        : "У вибраних таблицях немає питань. Перевір назви схем/таблиць та дані.";
      return;
    }
    activeSubject = select.value;
    activeMode = "session";
    activeQuestions = questions;
    sessionTopicCounts = Object.fromEntries(plan.map(x => [x.topic, x.count]));
    currentQuestionIndex = 0;
    correctAnswersCount = 0;
    activeQuestionResults = [];
    questionAnswers = new Array(questions.length).fill(null);
    hintState = new Array(questions.length).fill(0);
    questionElapsedMs = new Array(questions.length).fill(0);
    questionFinalized = new Array(questions.length).fill(false);
    completedAnalytics = null;
    closeModal();
    showScreen("screen-session");
    renderQuestion("session");
  });
}

function openTrialTestSetup() {
  openModal(`
    <h3>Пробний тест НМТ</h3>
    <p class="modal-description">Питання будуть випадково розподілені між усіма темами обраного предмета.</p>
    <label class="modal-field-label">Предмет</label>
    <select id="modal-test-subject">
      <option value="math">Математика — ${NMT_COUNTS.math} питань</option>
      <option value="ukrainian">Українська мова — ${NMT_COUNTS.ukrainian} питань</option>
      <option value="history">Історія України — ${NMT_COUNTS.history} питань</option>
    </select>
    <button class="modal-submit-btn" id="start-test-btn" type="button">Почати пробний тест</button>
    <div id="modal-status" class="modal-result"></div>
  `);

  document.getElementById("start-test-btn").addEventListener("click", async () => {
    const subject = document.getElementById("modal-test-subject").value;
    const status = document.getElementById("modal-status");
    status.textContent = "Формую тест з усіх доступних таблиць...";
    const questions = await loadNmtQuestions(subject);
    if (!questions.length) {
      status.textContent = lastFetchErrors.length
        ? `Помилка доступу до таблиць: ${lastFetchErrors.join(" | ")}. Найімовірніше схему потрібно додати в "Exposed schemas" у Supabase (Project Settings → Data API) та перевірити RLS.`
        : "Не знайдено питань. Додай їх у public.questions або у таблиці тем.";
      return;
    }
    if (questions.length < NMT_COUNTS[subject]) {
      status.textContent = `Зараз у БД лише ${questions.length} питань із потрібних ${NMT_COUNTS[subject]}. Тест запуститься з доступних.`;
    }
    activeSubject = subject;
    activeMode = "test";
    activeQuestions = questions;
    currentQuestionIndex = 0;
    correctAnswersCount = 0;
    activeQuestionResults = [];
    questionAnswers = new Array(questions.length).fill(null);
    questionElapsedMs = new Array(questions.length).fill(0);
    questionFinalized = new Array(questions.length).fill(false);
    completedAnalytics = null;
    setTimeout(() => {
      closeModal();
      showScreen("screen-test");
      startTestOverallTimer();
      renderQuestion("test");
    }, 250);
  });
}

function getQuestionCorrect(q) {
  const c = q.correct_answer || {};
  if (typeof c === "string") return { value: c };
  return c;
}

function normalizeLetter(v) {
  const s = String(v ?? "").trim().toLowerCase();
  const map = { а: "a", б: "b", в: "c", г: "d" };
  return map[s] || s;
}

function isSingleChoiceCorrect(q, index, value) {
  const c = getQuestionCorrect(q);
  if (c.index != null) return Number(c.index) === index;
  const target = normalizeOptionToken(c.option ?? c.value);
  const letters = ["a", "b", "c", "d", "e"];
  if (letters.includes(target)) return target === letters[index];
  if (target !== "" && value != null) return String(value).trim() === String(c.value ?? target).trim();
  return false;
}

function renderQuestion(mode) {
  const q = activeQuestions[currentQuestionIndex];
  const prefix = mode === "test" ? "test" : "session";
  const total = activeQuestions.length;
  const progress = ((currentQuestionIndex + 1) / total) * 100;
  document.getElementById(`${prefix}-progress-label`).textContent = `Питання ${currentQuestionIndex + 1} з ${total}`;
  document.getElementById(`${prefix}-progress-fill`).style.width = `${progress}%`;
  startQuestionTimer();
  document.getElementById(`${prefix}-topic-label`).textContent = mode === "test" ? topicLabel(activeSubject, q.topic) : topicLabel(activeSubject, q.topic);
  document.getElementById(`${prefix}-question-text`).innerHTML = escapeHtml(q.question_text).replace(/\n/g, "<br>");

  const image = document.getElementById(`${prefix}-image`);
  image.innerHTML = q.image_path ? `<img class="question-image" src="${escapeHtml(q.image_path)}" alt="Ілюстрація до питання">` : "";

  const options = document.getElementById(`${prefix}-options`);
  options.innerHTML = "";

  if (mode === "session") {
    const hints = document.getElementById("session-hints");
    hints.innerHTML = "";
    const hintTexts = [q.hint1, q.hint2, q.hint3].filter(t => t != null && String(t).trim() !== "");

    if (hintTexts.length) {
      hints.innerHTML = `<div id="hint-messages" class="hint-messages"></div><button type="button" class="secondary-btn hint-btn" id="hint-btn">Дай підказку</button>`;
      const messagesEl = document.getElementById("hint-messages");
      const btn = document.getElementById("hint-btn");

      const renderRevealedHints = () => {
        const used = hintState[currentQuestionIndex] || 0;
        messagesEl.innerHTML = hintTexts.slice(0, used).map((t, i) =>
          `<div class="hint-message"><span class="hint-message-label">Підказка ${i + 1}</span>${escapeHtml(t)}</div>`
        ).join("");
        if (used >= hintTexts.length) {
          messagesEl.innerHTML += `<div class="hint-message hint-message-end">Підказки закінчились — думай сам 🙂</div>`;
          btn.disabled = true;
        }
        renderMathIn(messagesEl);
      };

      btn.addEventListener("click", () => {
        hintState[currentQuestionIndex] = (hintState[currentQuestionIndex] || 0) + 1;
        renderRevealedHints();
      });
      renderRevealedHints();
    } else {
      hints.innerHTML = `<div class="hint-messages"><div class="hint-message hint-message-end">Підказок для цього питання ще немає — думай сам 🙂</div></div><button type="button" class="secondary-btn hint-btn" disabled>Дай підказку</button>`;
    }

    // Для математики: якщо для питання завантажені фото розв'язання — окрема кнопка-галерея.
    const imagesHost = document.getElementById("session-hint-images");
    if (imagesHost) {
      imagesHost.innerHTML = "";
      if (activeSubject === "math" && q.solutionImages && q.solutionImages.length) {
        imagesHost.innerHTML = `<button type="button" class="secondary-btn hint-images-btn" id="hint-images-btn">Показати розв'язання (фото)</button><div id="hint-images-gallery" class="hint-images-gallery" style="display:none;"></div>`;
        document.getElementById("hint-images-btn").addEventListener("click", () => {
          const gallery = document.getElementById("hint-images-gallery");
          const showing = gallery.style.display !== "none";
          if (showing) { gallery.style.display = "none"; return; }
          gallery.innerHTML = q.solutionImages.map((src, i) =>
            `<a href="${escapeHtml(src)}" target="_blank" rel="noopener"><img src="${escapeHtml(src)}" alt="Розв'язання, крок ${i + 1}"></a>`
          ).join("");
          gallery.style.display = "flex";
        });
      }
    }
  }

  const savedAnswer = questionAnswers[currentQuestionIndex];

  if (q.question_type === 'matching') renderMatchingQuestion(q, options, mode, savedAnswer);
  else if (q.question_type === 'short_answer') renderShortAnswerQuestion(q, options, mode, savedAnswer);
  else if (q.question_type === 'multiple_choice') renderMultipleChoiceQuestion(q, options, mode, savedAnswer);
  else if (q.question_type === 'table') renderTableQuestion(q, options, mode, savedAnswer);
  else renderSingleChoiceQuestion(q, options, mode, savedAnswer);

  const prevBtn = document.getElementById(`${prefix}-prev-btn`);
  const nextBtn = document.getElementById(`${prefix}-next-btn`);
  const finishBtn = document.getElementById(`${prefix}-finish-btn`);
  if (prevBtn) prevBtn.disabled = currentQuestionIndex === 0;
  if (nextBtn) nextBtn.disabled = currentQuestionIndex >= activeQuestions.length - 1;
  if (finishBtn) finishBtn.style.display = "block";

  renderMathIn(document.getElementById(`${prefix}-question-text`).closest(".session-card-main"));
}

/* Зберігає (чи оновлює) відповідь користувача на поточне питання.
   Можна викликати повторно — вибір завжди можна змінити до завершення сесії. */
function recordAnswer(mode, data) {
  questionAnswers[currentQuestionIndex] = { ...data, correct: !!data.correct };
  activeQuestionResults[currentQuestionIndex] = !!data.correct;
}

function renderSingleChoiceQuestion(q, container, mode, savedAnswer) {
  const letters = ["A", "B", "C", "D", "E"];
  q.options.forEach((text, index) => {
    if (text == null || String(text).trim() === "") return;
    const el = document.createElement("div");
    el.className = "session-option";
    el.innerHTML = `<div class="session-option-letter">${letters[index]}</div><span>${escapeHtml(text)}</span>`;
    el.addEventListener("click", () => {
      // Дозволяємо переобирати відповідь будь-яку кількість разів до завершення сесії.
      // Правильність не підсвічується кольором — лише позначаємо обраний варіант.
      [...container.children].forEach(c => c.classList.remove("selected"));
      el.classList.add("selected");
      const correct = isSingleChoiceCorrect(q, index, text);
      recordAnswer(mode, { type: "single", selectedIndex: index, correct });
    });
    container.appendChild(el);
  });

  if (savedAnswer && savedAnswer.type === "single") {
    const selEl = container.children[savedAnswer.selectedIndex];
    if (selEl) selEl.classList.add("selected");
  }
}

function renderMultipleChoiceQuestion(q, container, mode, savedAnswer) {
  const letters = ['A', 'B', 'C', 'D', 'E'];
  const saved = savedAnswer && savedAnswer.type === 'multiple' ? (savedAnswer.selectedIndices || []) : [];
  container.innerHTML = '';

  q.options.forEach((text, index) => {
    if (text == null || String(text).trim() === '') return;
    const el = document.createElement('div');
    el.className = 'session-option';
    el.innerHTML = `<div class="session-option-letter">${letters[index]}</div><span>${escapeHtml(text)}</span>`;
    if (saved.includes(index)) el.classList.add('selected');
    el.addEventListener('click', () => {
      el.classList.toggle('selected');
    });
    container.appendChild(el);
  });

  const checkBtn = document.createElement('button');
  checkBtn.id = 'multiple-answer-btn';
  checkBtn.className = 'primary-btn';
  checkBtn.type = 'button';
  checkBtn.textContent = 'Перевірити';
  const resultEl = document.createElement('div');
  resultEl.id = 'multiple-answer-result';
  container.appendChild(checkBtn);
  container.appendChild(resultEl);

  if (savedAnswer && savedAnswer.type === 'multiple') {
    resultEl.textContent = savedAnswer.correct ? 'Правильно' : 'Неправильно';
  }

  checkBtn.addEventListener('click', () => {
    const selectedIndices = [...container.querySelectorAll('.session-option')]
      .map((el, i) => el.classList.contains('selected') ? i : -1)
      .filter(i => i >= 0);
    const selectedTokens = selectedIndices.map(i => letters[i].toLowerCase());
    const rawCorrect = getQuestionCorrect(q);
    let expectedTokens = [];
    if (Array.isArray(rawCorrect)) expectedTokens = rawCorrect.map(normalizeOptionToken).filter(Boolean);
    else if (rawCorrect && Array.isArray(rawCorrect.options)) expectedTokens = rawCorrect.options.map(normalizeOptionToken).filter(Boolean);
    else if (rawCorrect?.value != null) expectedTokens = String(rawCorrect.value).split(/[,;\s]+/).map(normalizeOptionToken).filter(Boolean);
    else if (rawCorrect?.option != null) expectedTokens = [normalizeOptionToken(rawCorrect.option)];

    expectedTokens = [...new Set(expectedTokens)].sort();
    const actualTokens = [...new Set(selectedTokens)].sort();
    const correct = JSON.stringify(actualTokens) === JSON.stringify(expectedTokens);
    resultEl.textContent = correct ? 'Правильно' : 'Неправильно';
    recordAnswer(mode, { type: 'multiple', selectedIndices, correct, expected: expectedTokens });
  });
}

function renderShortAnswerQuestion(q, container, mode, savedAnswer) {
  container.innerHTML = `<div class="short-answer-wrap"><input id="short-answer-input" class="auth-input" type="text" placeholder="Введіть відповідь"><button id="short-answer-btn" class="primary-btn" type="button">Перевірити</button><div id="short-answer-result"></div></div>`;
  const input = document.getElementById("short-answer-input");
  const resultEl = document.getElementById("short-answer-result");
  if (savedAnswer && savedAnswer.type === "short") {
    input.value = savedAnswer.value || "";
    resultEl.textContent = savedAnswer.correct ? "Правильно" : `Неправильно. Правильна відповідь: ${savedAnswer.expected}`;
  }
  document.getElementById("short-answer-btn").addEventListener("click", () => {
    const value = input.value.trim();
    if (!value) return;
    const c = getQuestionCorrect(q);
    const expected = String(c.value ?? c.option ?? "").trim();
    const correct = value.toLowerCase() === expected.toLowerCase();
    resultEl.textContent = correct ? "Правильно" : `Неправильно. Правильна відповідь: ${expected}`;
    renderMathIn(resultEl);
    recordAnswer(mode, { type: "short", value, expected, correct });
  });
}

function normalizeMatchingChoice(value) {
  const raw = String(value ?? "").trim().toLowerCase();
  if (!raw) return "";
  if (/^option_[a-e]$/.test(raw)) return raw;
  const token = normalizeOptionToken(raw);
  return ["a", "b", "c", "d", "e"].includes(token) ? `option_${token}` : raw;
}

function renderMatchingQuestion(q, container, mode, savedAnswer) {
  const left = Array.isArray(q.matching_left) ? q.matching_left : [];
  const right = Array.isArray(q.matching_right) ? q.matching_right : [];
  const correct = getQuestionCorrect(q);

  if (!left.length || !right.length) {
    container.innerHTML = "<p>Для завдання на відповідність не знайдені subquestion_1..N або option_a..option_e.</p>";
    return;
  }

  const savedSelections = savedAnswer?.type === "matching" ? (savedAnswer.selections || {}) : {};
  const optionLabel = (item) => String(typeof item === "object" ? (item.label ?? item.text ?? item.id ?? "") : item);
  const optionId = (item, index) => normalizeMatchingChoice(typeof item === "object" ? item.id : item) || `option_${["a", "b", "c", "d", "e"][index]}`;

  container.innerHTML = left.map((item, i) => {
    const id = String(typeof item === "object" ? (item.id ?? i + 1) : i + 1);
    const label = typeof item === "object" ? (item.label ?? item.text ?? id) : item;
    const saved = normalizeMatchingChoice(savedSelections[id]);

    const menuOptions = right.map((r, j) => {
      const rid = optionId(r, j);
      const rl = optionLabel(r);
      const selectedClass = rid === saved ? " selected" : "";
      return `<button type="button" class="matching-choice-option${selectedClass}" data-value="${escapeHtml(rid)}">${escapeHtml(rl)}</button>`;
    }).join("");

    const selectedItem = right.find((r, j) => optionId(r, j) === saved);
    const selectedLabel = selectedItem ? optionLabel(selectedItem) : "—";

    return `
      <div class="matching-row">
        <div class="matching-subquestion">${escapeHtml(label)}</div>
        <div class="matching-choice" data-id="${escapeHtml(id)}" data-value="${escapeHtml(saved)}">
          <button type="button" class="matching-choice-trigger">
            <span class="matching-choice-value">${escapeHtml(selectedLabel)}</span>
            <span class="matching-choice-arrow">▾</span>
          </button>
          <div class="matching-choice-menu">${menuOptions}</div>
        </div>
      </div>`;
  }).join("") + `<button id="matching-btn" class="primary-btn" type="button">Перевірити</button><div id="matching-result"></div>`;

  const closeMenus = (except = null) => {
    container.querySelectorAll(".matching-choice.open").forEach(menu => {
      if (menu !== except) menu.classList.remove("open");
    });
  };

  container.querySelectorAll(".matching-choice").forEach(choice => {
    const trigger = choice.querySelector(".matching-choice-trigger");
    const valueEl = choice.querySelector(".matching-choice-value");

    trigger.addEventListener("click", (event) => {
      event.stopPropagation();
      const wasOpen = choice.classList.contains("open");
      closeMenus(choice);
      choice.classList.toggle("open", !wasOpen);
    });

    choice.querySelectorAll(".matching-choice-option").forEach(option => {
      option.addEventListener("click", (event) => {
        event.stopPropagation();
        const value = normalizeMatchingChoice(option.dataset.value);
        choice.dataset.value = value;
        valueEl.innerHTML = option.innerHTML;
        choice.querySelectorAll(".matching-choice-option").forEach(o => o.classList.remove("selected"));
        option.classList.add("selected");
        choice.classList.remove("open");
        renderMathIn(valueEl);
      });
    });

    renderMathIn(valueEl);
    choice.querySelectorAll(".matching-choice-option").forEach(option => renderMathIn(option));
  });

  const resultEl = document.getElementById("matching-result");
  if (savedAnswer && savedAnswer.type === "matching") {
    resultEl.textContent = `Правильно: ${savedAnswer.correctCount} з ${savedAnswer.total}`;
  }

  document.getElementById("matching-btn").addEventListener("click", () => {
    const choices = [...container.querySelectorAll(".matching-choice")];
    let correctCount = 0;
    const selections = {};

    choices.forEach(choice => {
      const key = String(choice.dataset.id);
      const userValue = normalizeMatchingChoice(choice.dataset.value);
      const expected = normalizeMatchingChoice(correct[key] ?? correct[String(key)]);
      selections[key] = userValue;
      if (userValue && expected && userValue === expected) correctCount++;
    });

    const ok = choices.length > 0 && correctCount === choices.length;
    resultEl.textContent = `Правильно: ${correctCount} з ${choices.length}`;
    recordAnswer(mode, {
      type: "matching",
      selections,
      correctCount,
      total: choices.length,
      correct: ok
    });
  });
}

function renderTableQuestion(q, container, mode, savedAnswer) {
  const data = q.table_data;
  if (!data) { container.innerHTML = "<p>Для табличного завдання не заповнено table_data.</p>"; return; }
  let headers = [], rows = [];
  if (Array.isArray(data)) rows = data;
  else { headers = data.headers || data.columns || []; rows = data.rows || []; }
  if (!headers.length && rows.length && Array.isArray(rows[0])) headers = rows[0].map((_,i)=>`Колонка ${i+1}`);
  container.innerHTML = `<div class="question-table-wrap"><table class="question-table"><thead><tr>${headers.map(h=>`<th>${escapeHtml(h)}</th>`).join("")}</tr></thead><tbody>${rows.map(r=>`<tr>${(Array.isArray(r)?r:Object.values(r)).map(v=>`<td>${escapeHtml(v)}</td>`).join("")}</tr>`).join("")}</tbody></table></div><div class="table-answer-wrap"><input id="table-answer-input" class="auth-input" type="text" placeholder="Введіть відповідь"><button id="table-answer-btn" class="primary-btn" type="button">Перевірити</button><div id="table-answer-result"></div></div>`;
  const input = document.getElementById("table-answer-input");
  const resultEl = document.getElementById("table-answer-result");
  if (savedAnswer && savedAnswer.type === "table") {
    input.value = savedAnswer.value || "";
    resultEl.textContent = savedAnswer.correct ? "Правильно" : `Неправильно. Правильна відповідь: ${savedAnswer.expected}`;
  }
  document.getElementById("table-answer-btn").addEventListener("click", () => {
    const value = input.value.trim();
    const c = getQuestionCorrect(q);
    const expected = String(c.value ?? c.option ?? "").trim();
    const ok = value.toLowerCase() === expected.toLowerCase();
    resultEl.textContent = ok ? "Правильно" : `Неправильно. Правильна відповідь: ${expected}`;
    recordAnswer(mode, { type: "table", value, expected, correct: ok });
  });
}

function advanceQuestion(mode) {
  if (currentQuestionIndex >= activeQuestions.length - 1) return;

  // Время сохраняем при уходе со страницы вопроса.
  // Но замораживаем его только когда выполнены ОБА условия:
  // 1) есть выбранный/проверенный ответ;
  // 2) пользователь нажал «Следующее».
  captureCurrentQuestionElapsed();
  questionFinalized[currentQuestionIndex] = !!questionAnswers[currentQuestionIndex];
  currentQuestionIndex++;
  renderQuestion(mode);
}

function goToPreviousQuestion(mode) {
  if (currentQuestionIndex <= 0) return;

  // Для «Назад» таймер не считается завершённым. Мы только сохраняем
  // уже набежавшее время; при возврате на неотвеченный вопрос отсчёт
  // снова продолжится. У отвеченного вопроса он останется замороженным.
  captureCurrentQuestionElapsed();
  currentQuestionIndex--;
  renderQuestion(mode);
}

/* Підраховує фінальний результат на основі збережених (і, можливо,
   змінених користувачем) відповідей questionAnswers. */
function tallyResults() {
  let correct = 0;
  questionAnswers.forEach(a => { if (a && a.correct) correct++; });
  return correct;
}

/* Тестові бали для пробного тесту: кожне звичайне питання дає стільки
   балів, скільки вказано у його weight (за замовчуванням 1) — якщо
   відповідь правильна. Завдання на відповідність не працюють за
   принципом "все або нічого": кожна правильно поставлена пара окремо
   додає +1 тестовий бал. */
function tallyRawScore() {
  let raw = 0;
  let max = 0;
  activeQuestions.forEach((q, i) => {
    const a = questionAnswers[i];
    if (q.question_type === "matching") {
      const pairsTotal = Array.isArray(q.matching_left) ? q.matching_left.length : (a && a.total) || 0;
      max += pairsTotal;
      if (a && a.type === "matching") raw += a.correctCount || 0;
    } else {
      const weight = q.weight || 1;
      max += weight;
      if (a && a.correct) raw += weight;
    }
  });
  return { raw, max };
}

async function finishLearningSession() {
  captureCurrentQuestionElapsed();
  correctAnswersCount = tallyResults();

  const expGained = correctAnswersCount * 10;
  const newXp = (currentProfile.xp || 0) + expGained;
  const levelProgress = getLevelProgress(newXp);

  const updates = {
    xp: newXp,
    level: levelProgress.level,
    [`${activeSubject}_questions`]: (currentProfile[`${activeSubject}_questions`] || 0) + activeQuestions.length,
    [`${activeSubject}_correct`]: (currentProfile[`${activeSubject}_correct`] || 0) + correctAnswersCount
  };

  const topicProgress = { ...(currentProfile.topic_progress || {}) };
  activeQuestions.forEach(q => {
    const key = `${activeSubject}:${q.topic}`;
    topicProgress[key] = (topicProgress[key] || 0) + 1;
  });
  updates.topic_progress = topicProgress;

  const { data, error } = await supabaseClient.from("profiles").update(updates).eq("id", currentUser.id).select().single();
  if (error) throw error;

  currentProfile = data;
  leaderboardCache = null;
  completedAnalytics = buildCompletedAnalytics("session", activeSubject);

  stopAllTimers();
  renderDashboard();
  renderCompletedAnalytics();

  /* Времена активной сессії більше не зберігаємо. */
  questionElapsedMs = [];
  questionFinalized = [];
  questionStartedAt = null;
}

/* Офіційні таблиці переведення тестового бала НМТ 2026 у шкалу 100–200
   (Освіта.UA, за Порядком прийому на навчання 2026 року). */
const NMT_SCORE_TABLES = {
  math: [
    [5, 100], [6, 108], [7, 115], [8, 123], [9, 131], [10, 134], [11, 137], [12, 140],
    [13, 143], [14, 145], [15, 147], [16, 148], [17, 149], [18, 150], [19, 151], [20, 152],
    [21, 155], [22, 159], [23, 163], [24, 167], [25, 170], [26, 173], [27, 176], [28, 180],
    [29, 184], [30, 189], [31, 194], [32, 200]
  ],
  ukrainian: [
    [8, 100], [9, 105], [10, 110], [11, 120], [12, 125], [13, 130], [14, 134], [15, 136],
    [16, 138], [17, 140], [18, 142], [19, 143], [20, 144], [21, 145], [22, 146], [23, 148],
    [24, 149], [25, 150], [26, 152], [27, 154], [28, 156], [29, 157], [30, 159], [31, 160],
    [32, 162], [33, 163], [34, 165], [35, 167], [36, 170], [37, 172], [38, 175], [39, 177],
    [40, 180], [41, 183], [42, 186], [43, 191], [44, 195], [45, 200]
  ],
  history: [
    [9, 100], [10, 105], [11, 110], [12, 115], [13, 120], [14, 125], [15, 130], [16, 132],
    [17, 134], [18, 136], [19, 138], [20, 140], [21, 141], [22, 142], [23, 143], [24, 144],
    [25, 145], [26, 146], [27, 147], [28, 148], [29, 149], [30, 150], [31, 151], [32, 152],
    [33, 154], [34, 156], [35, 158], [36, 160], [37, 163], [38, 166], [39, 168], [40, 169],
    [41, 170], [42, 172], [43, 173], [44, 175], [45, 177], [46, 179], [47, 181], [48, 183],
    [49, 185], [50, 188], [51, 191], [52, 194], [53, 197], [54, 200]
  ]
};

/* Знаходить рейтинговий бал за офіційною таблицею для сирого тестового
   бала. Якщо сирий бал нижчий за поріг — тест не зарахований (null).
   Якщо вищий за максимум таблиці — прирівнюється до 200. */
function lookupNmtScore(subject, raw) {
  const table = NMT_SCORE_TABLES[subject];
  if (!table) return null;
  if (raw < table[0][0]) return null;
  let result = table[0][1];
  for (const [threshold, score] of table) {
    if (raw >= threshold) result = score; else break;
  }
  return result;
}

async function finishTrialTest(autoFinished = false) {
  captureCurrentQuestionElapsed();
  correctAnswersCount = tallyResults();

  const { raw, max } = tallyRawScore();
  const score = lookupNmtScore(activeSubject, raw);
  const history = Array.isArray(currentProfile[`${activeSubject}_history`]) ? [...currentProfile[`${activeSubject}_history`]] : [];
  history.push(score ?? 0);

  const { data, error } = await supabaseClient.from("profiles").update({
    [`${activeSubject}_history`]: history,
    [`${activeSubject}_score`]: score
  }).eq("id", currentUser.id).select().single();

  if (error) throw error;

  currentProfile = data;
  leaderboardCache = null;
  completedAnalytics = buildCompletedAnalytics("test", activeSubject);
  completedAnalytics.nmtScore = score;
  completedAnalytics.rawScore = raw;
  completedAnalytics.rawMax = max;

  stopAllTimers();
  renderDashboard();
  renderCompletedAnalytics();

  questionElapsedMs = [];
  questionFinalized = [];
  questionStartedAt = null;
}

document.getElementById("btn-session").addEventListener("click", openSessionSetup);
document.getElementById("btn-test").addEventListener("click", openTrialTestSetup);
document.getElementById("session-prev-btn")?.addEventListener("click", () => goToPreviousQuestion("session"));
document.getElementById("test-prev-btn")?.addEventListener("click", () => goToPreviousQuestion("test"));
document.getElementById("session-next-btn").addEventListener("click", () => advanceQuestion("session"));
document.getElementById("test-next-btn").addEventListener("click", () => advanceQuestion("test"));
document.getElementById("session-finish-btn").addEventListener("click", async () => {
  try { await finishLearningSession(); } catch (e) { alert("Помилка збереження прогресу: " + e.message); }
});
document.getElementById("test-finish-btn").addEventListener("click", async () => {
  try { await finishTrialTest(); } catch (e) { alert("Помилка збереження результату тесту: " + e.message); }
});
document.getElementById("session-exit-btn").addEventListener("click", () => {
  stopAllTimers();
  questionElapsedMs = [];
  showScreen("screen-dashboard");
});
document.getElementById("test-exit-btn").addEventListener("click", () => {
  stopAllTimers();
  questionElapsedMs = [];
  showScreen("screen-dashboard");
});
document.getElementById("result-back-btn").addEventListener("click", () => showScreen("screen-dashboard"));

/* ---------------------------------------------------------------------
   НАВІГАЦІЯ
   --------------------------------------------------------------------- */
document.querySelectorAll(".nav-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    const nav = btn.dataset.nav;
    document.querySelectorAll(".content-view").forEach(v => v.classList.remove("active"));
    const target = document.getElementById(`view-${nav}`);
    if (target) target.classList.add("active");
    if (nav === "analytics") renderAnalytics();
    if (nav === "profile") renderProfileView();
    if (nav === "leaderboard") loadLeaderboard();
  });
});

window.addEventListener("DOMContentLoaded", async () => {
  setAuthMode("login");
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session && session.user) {
    currentUser = session.user;
    await checkAndLoadProfile();
  }
});
