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
  const totalXp = currentProfile.xp || 0;
  const level = Math.floor(totalXp / 100) + 1;
  const expIntoLevel = totalXp % 100;

  document.getElementById("level-title").textContent = `Рівень ${level}`;
  document.getElementById("level-points").textContent = `${expIntoLevel}/100`;
  document.getElementById("xp-fill").style.width = `${expIntoLevel}%`;

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
          <div style="font-size: 12px; color: var(--text-muted);">${SUBJECTS_META[subject].label}</div>
          <div style="font-weight: 600;">${topic.label}</div>
          <div style="font-size: 13px; color: var(--accent-pink);">Розв'язано: ${progress[`${subject}:${topic.key}`] || 0}</div>
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
  const getY = score => p.top + plotH - ((score - 100) / 100) * plotH;

  [100, 150, 200].forEach(val => {
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
   ПИТАННЯ З БД: SCHEMA -> TABLE -> RANDOM
   --------------------------------------------------------------------- */

const SUBJECT_SCHEMAS = {
  math: "math",
  ukrainian: "ukrainian",
  history: "history"
};

const SUBJECT_TABLES = {
  math: [
    "numbers_expressions",
    "equations_inequalities",
    "functions",
    "combinatorics_probability_stats",
    "planimetry",
    "stereometry"
  ],
  ukrainian: [
    "phonetics",
    "morphology",
    "syntax",
    "spelling",
    "punctuation",
    "stylistics"
  ],
  history: [
    "intro_ancient",
    "kyivan_rus",
    "lands_14_16",
    "rzeczpospolita",
    "liberation_war",
    "cossack_ruin",
    "lands_18_19",
    "lands_19",
    "wwi_revolution",
    "interwar",
    "postwar_independence"
  ]
};

/*
  Totals taken from the supplied NMT structure screenshot:
  Ukrainian language = 30, Math = 22, History of Ukraine = 30.
*/
const MOCK_TEST_TOTALS = {
  ukrainian: 30,
  math: 22,
  history: 30
};

const TOPIC_LOOKUP = Object.fromEntries(
  Object.entries(TOPICS).flatMap(([subject, list]) =>
    list.map(topic => [`${subject}:${topic.key}`, topic])
  )
);

function shuffleArray(items) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/*
  Renders plain text + inline/display LaTeX without requiring the
  auto-render extension. Supported delimiters:
  $$...$$, \[...\], \(...\), and $...$.
*/
function renderLatexText(value) {
  const source = String(value ?? "");
  if (!window.katex) return escapeHtml(source).replace(/\n/g, "<br>");

  const tokenRe = /(\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\)|\$[^$\n]+\$)/g;
  let html = "";
  let last = 0;

  for (const match of source.matchAll(tokenRe)) {
    const raw = match[0];
    const start = match.index ?? 0;

    html += escapeHtml(source.slice(last, start)).replace(/\n/g, "<br>");

    let latex = raw;
    let displayMode = false;

    if (latex.startsWith("$$") && latex.endsWith("$$")) {
      latex = latex.slice(2, -2);
      displayMode = true;
    } else if (latex.startsWith("\\[") && latex.endsWith("\\]")) {
      latex = latex.slice(2, -2);
      displayMode = true;
    } else if (latex.startsWith("\\(") && latex.endsWith("\\)")) {
      latex = latex.slice(2, -2);
    } else if (latex.startsWith("$") && latex.endsWith("$")) {
      latex = latex.slice(1, -1);
    }

    try {
      html += window.katex.renderToString(latex, {
        throwOnError: false,
        displayMode
      });
    } catch {
      html += escapeHtml(raw);
    }

    last = start + raw.length;
  }

  html += escapeHtml(source.slice(last)).replace(/\n/g, "<br>");
  return html;
}

function normalizeCorrectIndex(row, options) {
  const raw =
    row.right_answer ??
    row.correct_answer ??
    row.correct_option ??
    row.correct_index ??
    row.answer ??
    null;

  if (raw == null) return -1;

  if (typeof raw === "number") {
    if (Number.isInteger(raw)) {
      if (raw >= 0 && raw < options.length) return raw;
      if (raw >= 1 && raw <= options.length) return raw - 1;
    }
  }

  const text = String(raw).trim();
  const lower = text.toLowerCase();

  const letterMap = { a: 0, b: 1, c: 2, d: 3, а: 0, б: 1, в: 2, г: 3 };
  if (Object.prototype.hasOwnProperty.call(letterMap, lower)) return letterMap[lower];

  const m = lower.match(/(?:option|answer|variant|choice|відповідь|варіант)[_\s-]*([abcd1-4])/i);
  if (m) {
    const key = m[1].toLowerCase();
    if (letterMap[key] !== undefined) return letterMap[key];
    const n = Number(key);
    if (Number.isInteger(n) && n >= 1 && n <= options.length) return n - 1;
  }

  if (/^\d+$/.test(lower)) {
    const n = Number(lower);
    if (n >= 0 && n < options.length) return n;
    if (n >= 1 && n <= options.length) return n - 1;
  }

  const exact = options.findIndex(option => String(option).trim() === text);
  if (exact >= 0) return exact;

  return -1;
}

function normalizeQuestion(row, subject, tableName) {
  const rawOptions = Array.isArray(row.options)
    ? row.options
    : [
        row.option_a ?? row.optionA ?? row.a,
        row.option_b ?? row.optionB ?? row.b,
        row.option_c ?? row.optionC ?? row.c,
        row.option_d ?? row.optionD ?? row.d
      ];

  const options = rawOptions
    .map(v => v == null ? "" : String(v))
    .filter(v => v.trim() !== "");

  const key = TOPICS[subject]?.some(t => t.key === tableName)
    ? tableName
    : (row.topic || tableName);

  const question = String(
    row.question_text ??
    row.question ??
    row.text ??
    row.questionText ??
    ""
  );

  const normalized = {
    id: row.id ?? crypto.randomUUID?.() ?? `${subject}-${tableName}-${Math.random()}`,
    subject,
    table: tableName,
    topic: key,
    topicLabel: TOPIC_LOOKUP[`${subject}:${key}`]?.label || tableName,
    question,
    options,
    correctIndex: normalizeCorrectIndex(row, options),
    raw: row
  };

  return normalized;
}

async function fetchTopicRows(subject, tableName) {
  const schema = SUBJECT_SCHEMAS[subject];
  if (!schema) throw new Error(`Невідома схема: ${subject}`);

  const { data, error } = await supabaseClient
    .schema(schema)
    .from(tableName)
    .select("*");

  if (error) {
    throw new Error(`Не вдалося прочитати ${schema}.${tableName}: ${error.message}`);
  }

  return (data || [])
    .map(row => normalizeQuestion(row, subject, tableName))
    .filter(q => q.question && q.options.length >= 2 && q.correctIndex >= 0);
}

async function fetchRandomFromTopic(subject, tableName, count) {
  const rows = await fetchTopicRows(subject, tableName);
  return shuffleArray(rows).slice(0, Math.min(count, rows.length));
}

async function fetchStudySessionQuestions(plan) {
  const result = [];

  for (const item of plan) {
    const rows = await fetchRandomFromTopic(item.subject, item.table, item.count);

    if (rows.length < item.count) {
      throw new Error(
        `У таблиці ${item.subject}.${item.table} є лише ${rows.length} придатних питань, а потрібно ${item.count}.`
      );
    }

    result.push(...rows);
  }

  return shuffleArray(result);
}

/*
  Trial test:
  - uses the exact total question counts from the supplied screenshot;
  - loads every topic table of the chosen subject;
  - randomly shuffles rows within each table;
  - round-robin takes one question from each topic, repeatedly,
    until the subject total is reached.
  This gives maximum topic spread while keeping every question random.
*/
async function fetchTrialTestQuestions(subject) {
  const total = MOCK_TEST_TOTALS[subject];
  const tables = shuffleArray(SUBJECT_TABLES[subject]);
  const pools = [];

  for (const table of tables) {
    const rows = await fetchTopicRows(subject, table);
    if (rows.length) pools.push({ table, rows: shuffleArray(rows), cursor: 0 });
  }

  if (!pools.length) {
    throw new Error(`У схемі ${SUBJECT_SCHEMAS[subject]} не знайдено придатних питань.`);
  }

  const result = [];

  while (result.length < total) {
    let addedThisRound = false;

    for (const pool of pools) {
      if (pool.cursor >= pool.rows.length) continue;

      result.push(pool.rows[pool.cursor]);
      pool.cursor += 1;
      addedThisRound = true;

      if (result.length >= total) break;
    }

    if (!addedThisRound) break;
  }

  if (result.length < total) {
    throw new Error(
      `Для пробного тесту потрібно ${total} питань, але в схемі доступно лише ${result.length} придатних.`
    );
  }

  return shuffleArray(result);
}

/* ---------------------------------------------------------------------
   УНІВЕРСАЛЬНИЙ РЕНДЕР ПИТАННЯ
   --------------------------------------------------------------------- */

function renderQuestionOptions(containerId, question, onAnswer) {
  const optionsEl = document.getElementById(containerId);
  optionsEl.innerHTML = "";
  optionsEl.classList.remove("answered");

  const letters = ["A", "B", "C", "D", "E", "F"];

  question.options.forEach((optionText, index) => {
    const opt = document.createElement("button");
    opt.type = "button";
    opt.className = "session-option";
    opt.innerHTML = `
      <span class="session-option-letter">${letters[index] || index + 1}</span>
      <span class="session-option-content">${renderLatexText(optionText)}</span>
    `;

    opt.addEventListener("click", () => {
      if (optionsEl.classList.contains("answered")) return;
      optionsEl.classList.add("answered");

      const isCorrect = index === question.correctIndex;
      opt.classList.add(isCorrect ? "correct" : "wrong");

      if (!isCorrect) {
        const correctButton = [...optionsEl.children][question.correctIndex];
        if (correctButton) correctButton.classList.add("correct");
      }

      onAnswer(index, isCorrect);
    });

    optionsEl.appendChild(opt);
  });
}

function renderQuestionText(elementId, text) {
  const el = document.getElementById(elementId);
  el.innerHTML = renderLatexText(text);
}

/* ---------------------------------------------------------------------
   НАВЧАЛЬНА СЕСІЯ
   --------------------------------------------------------------------- */

let activeQuestions = [];
let currentQuestionIndex = 0;
let sessionResults = [];
let activeStudySubject = "";

function buildTopicSelectionModal() {
  return `
    <h3>Навчальна сесія</h3>
    <p class="modal-hint">Спочатку оберіть предмет, потім теми, які хочете тренувати.</p>

    <div class="subject-radio-row">
      ${Object.entries(SUBJECTS_META).map(([subject, meta], index) => `
        <label class="subject-radio-option ${index === 0 ? "selected" : ""}">
          <input type="radio" name="study-subject" value="${subject}" ${index === 0 ? "checked" : ""}>
          ${meta.label}
        </label>
      `).join("")}
    </div>

    <div id="study-topic-step"></div>
    <div id="study-modal-error" class="modal-error"></div>

    <button class="modal-submit-btn" id="study-next-btn" type="button">Далі</button>
  `;
}

function renderStudyTopics(subject) {
  return `
    <div class="topic-picker">
      <p class="modal-hint">Можна вибрати весь предмет або лише окремі теми.</p>

      <label class="topic-checkbox-row">
        <input id="study-all-topics" type="checkbox">
        <strong>Весь предмет</strong>
      </label>

      ${TOPICS[subject].map(topic => `
        <label class="topic-checkbox-row">
          <input class="study-topic-check" type="checkbox" value="${topic.key}">
          <span>${topic.label}</span>
        </label>
      `).join("")}
    </div>
  `;
}

function renderStudyQuestionCounts(subject, selectedTables) {
  return `
    <h3>Кількість питань</h3>
    <p class="modal-hint">Для кожної вибраної теми задайте від 1 до 10 питань.</p>

    <div class="question-count-list">
      ${selectedTables.map(table => {
        const topic = TOPIC_LOOKUP[`${subject}:${table}`];
        return `
          <div class="question-count-row">
            <div class="slider-row-label">
              <span>${topic?.label || table}</span>
              <span class="slider-value" id="study-count-${table}">1</span>
            </div>
            <input
              class="session-question-range study-range"
              data-table="${table}"
              type="range"
              min="1"
              max="10"
              value="1"
            >
          </div>
        `;
      }).join("")}
    </div>

    <div id="study-count-error" class="modal-error"></div>

    <button class="secondary-btn" id="study-back-btn" type="button">Назад</button>
    <button class="modal-submit-btn" id="study-start-btn" type="button">Почати сесію</button>
  `;
}

async function startStudySessionFromModal(subject, plan) {
  const questions = await fetchStudySessionQuestions(plan);

  activeStudySubject = subject;
  activeQuestions = questions;
  currentQuestionIndex = 0;
  sessionResults = [];

  closeModal();
  showScreen("screen-session");
  renderStudyQuestion();
}

function renderStudyQuestion() {
  const q = activeQuestions[currentQuestionIndex];
  if (!q) return;

  document.getElementById("session-progress-label").textContent =
    `Питання ${currentQuestionIndex + 1} з ${activeQuestions.length}`;

  document.getElementById("session-progress-fill").style.width =
    `${((currentQuestionIndex + 1) / activeQuestions.length) * 100}%`;

  document.getElementById("session-topic-label").textContent =
    `${SUBJECTS_META[q.subject].label} · ${q.topicLabel}`;

  renderQuestionText("session-question-text", q.question);

  renderQuestionOptions("session-options", q, (_index, isCorrect) => {
    sessionResults[currentQuestionIndex] = {
      subject: q.subject,
      table: q.table,
      topic: q.topic,
      correct: isCorrect
    };

    if (currentQuestionIndex < activeQuestions.length - 1) {
      document.getElementById("session-next-btn").style.display = "block";
    } else {
      document.getElementById("session-finish-btn").style.display = "block";
    }
  });

  document.getElementById("session-next-btn").style.display = "none";
  document.getElementById("session-finish-btn").style.display = "none";
}

async function finishStudySession() {
  const answered = sessionResults.filter(Boolean);

  if (answered.length !== activeQuestions.length) {
    return;
  }

  const subjectStats = {
    math: { questions: 0, correct: 0 },
    ukrainian: { questions: 0, correct: 0 },
    history: { questions: 0, correct: 0 }
  };

  const topicProgress = { ...(currentProfile.topic_progress || {}) };

  for (const result of sessionResults) {
    subjectStats[result.subject].questions += 1;
    subjectStats[result.subject].correct += result.correct ? 1 : 0;

    const key = `${result.subject}:${result.topic}`;
    topicProgress[key] = (topicProgress[key] || 0) + 1;
  }

  const totalCorrect = Object.values(subjectStats)
    .reduce((sum, item) => sum + item.correct, 0);

  const xpGained = totalCorrect * 10;
  const newXp = (currentProfile.xp || 0) + xpGained;

  const updates = {
    xp: newXp,
    level: Math.floor(newXp / 100) + 1,
    topic_progress: topicProgress
  };

  for (const subject of Object.keys(subjectStats)) {
    updates[`${subject}_questions`] =
      (currentProfile[`${subject}_questions`] || 0) + subjectStats[subject].questions;

    updates[`${subject}_correct`] =
      (currentProfile[`${subject}_correct`] || 0) + subjectStats[subject].correct;
  }

  try {
    const { data, error } = await supabaseClient
      .from("profiles")
      .update(updates)
      .eq("id", currentUser.id)
      .select()
      .single();

    if (error) throw error;

    currentProfile = data;
    leaderboardCache = null;
    renderDashboard();

    alert(
      `Сесію завершено! Правильних відповідей: ${totalCorrect} з ${activeQuestions.length}. ` +
      `Нараховано ${xpGained} XP.`
    );

    activeQuestions = [];
    sessionResults = [];
    showScreen("screen-dashboard");
  } catch (err) {
    alert(`Помилка збереження прогресу: ${err.message || err}`);
  }
}

document.getElementById("btn-session").addEventListener("click", () => {
  openModal(buildTopicSelectionModal());

  const stepEl = document.getElementById("study-topic-step");
  const errorEl = document.getElementById("study-modal-error");
  const nextBtn = document.getElementById("study-next-btn");

  const updateSubjectStyle = () => {
    document.querySelectorAll(".subject-radio-option").forEach(label => {
      const input = label.querySelector("input");
      label.classList.toggle("selected", input.checked);
    });
  };

  const getSelectedSubject = () =>
    document.querySelector('input[name="study-subject"]:checked')?.value || "math";

  stepEl.innerHTML = renderStudyTopics(getSelectedSubject());

  const bindAllTopics = () => {
    const all = document.getElementById("study-all-topics");
    if (!all) return;
    all.addEventListener("change", () => {
      document.querySelectorAll(".study-topic-check")
        .forEach(input => { input.checked = all.checked; });
    });
  };

  document.querySelectorAll('input[name="study-subject"]').forEach(input => {
    input.addEventListener("change", () => {
      updateSubjectStyle();
      stepEl.innerHTML = renderStudyTopics(getSelectedSubject());
      bindAllTopics();
    });
  });

  bindAllTopics();

  nextBtn.addEventListener("click", () => {
    const subject = getSelectedSubject();
    const allChecked = document.getElementById("study-all-topics")?.checked;
    const selected = [...document.querySelectorAll(".study-topic-check:checked")]
      .map(input => input.value);

    const topicKeys = allChecked ? TOPICS[subject].map(t => t.key) : selected;

    if (!topicKeys.length) {
      errorEl.textContent = "Оберіть хоча б одну тему.";
      return;
    }

    openModal(renderStudyQuestionCounts(subject, topicKeys));

    document.querySelectorAll(".study-range").forEach(range => {
      range.addEventListener("input", () => {
        document.getElementById(`study-count-${range.dataset.table}`).textContent = range.value;
      });
    });

    document.getElementById("study-back-btn").addEventListener("click", () => {
      // Re-open the first step.
      document.getElementById("btn-session").click();
    });

    document.getElementById("study-start-btn").addEventListener("click", async () => {
      const startBtn = document.getElementById("study-start-btn");
      const countError = document.getElementById("study-count-error");

      const plan = [...document.querySelectorAll(".study-range")].map(range => ({
        subject,
        table: range.dataset.table,
        count: Number(range.value)
      }));

      startBtn.disabled = true;
      countError.textContent = "Завантаження випадкових питань...";

      try {
        await startStudySessionFromModal(subject, plan);
      } catch (err) {
        countError.textContent = err.message || "Не вдалося завантажити питання.";
        startBtn.disabled = false;
      }
    });
  });
});

document.getElementById("session-next-btn").addEventListener("click", () => {
  currentQuestionIndex += 1;
  renderStudyQuestion();
});

document.getElementById("session-finish-btn").addEventListener("click", finishStudySession);

document.getElementById("session-exit-btn").addEventListener("click", () => {
  activeQuestions = [];
  sessionResults = [];
  showScreen("screen-dashboard");
});

/* ---------------------------------------------------------------------
   ПРОБНИЙ ТЕСТ
   --------------------------------------------------------------------- */

let activeTestQuestions = [];
let currentTestIndex = 0;
let testResults = [];
let activeTestSubject = "";

function openTrialTestModal() {
  openModal(`
    <h3>Пробний тест</h3>
    <p class="modal-hint">Оберіть предмет. Питання будуть випадково підібрані з різних тем цього предмета.</p>

    <div class="subject-radio-row">
      ${Object.entries(MOCK_TEST_TOTALS).map(([subject, total], index) => `
        <label class="subject-radio-option ${index === 0 ? "selected" : ""}">
          <input type="radio" name="test-subject" value="${subject}" ${index === 0 ? "checked" : ""}>
          ${SUBJECTS_META[subject].label}<br>
          <span style="font-size:11px;color:var(--text-muted)">${total} питань</span>
        </label>
      `).join("")}
    </div>

    <div id="test-modal-status" class="modal-result"></div>
    <button id="start-test-btn" class="modal-submit-btn" type="button">Почати тест</button>
  `);

  document.querySelectorAll('input[name="test-subject"]').forEach(input => {
    input.addEventListener("change", () => {
      document.querySelectorAll(".subject-radio-option").forEach(label => {
        label.classList.toggle("selected", label.querySelector("input").checked);
      });
    });
  });

  document.getElementById("start-test-btn").addEventListener("click", async () => {
    const subject = document.querySelector('input[name="test-subject"]:checked').value;
    const statusEl = document.getElementById("test-modal-status");
    const btn = document.getElementById("start-test-btn");

    btn.disabled = true;
    statusEl.textContent = "Підбираємо випадкові питання з різних тем...";

    try {
      activeTestSubject = subject;
      activeTestQuestions = await fetchTrialTestQuestions(subject);

      currentTestIndex = 0;
      testResults = [];

      closeModal();
      showScreen("screen-test");
      renderTestQuestion();
    } catch (err) {
      statusEl.textContent = err.message || "Не вдалося завантажити тест.";
      btn.disabled = false;
    }
  });
}

function renderTestQuestion() {
  const q = activeTestQuestions[currentTestIndex];
  if (!q) return;

  document.getElementById("test-progress-label").textContent =
    `Питання ${currentTestIndex + 1} з ${activeTestQuestions.length}`;

  document.getElementById("test-progress-fill").style.width =
    `${((currentTestIndex + 1) / activeTestQuestions.length) * 100}%`;

  document.getElementById("test-topic-label").textContent =
    `${SUBJECTS_META[q.subject].label} · ${q.topicLabel}`;

  renderQuestionText("test-question-text", q.question);

  renderQuestionOptions("test-options", q, (_index, isCorrect) => {
    testResults[currentTestIndex] = isCorrect;

    if (currentTestIndex < activeTestQuestions.length - 1) {
      document.getElementById("test-next-btn").style.display = "block";
    } else {
      document.getElementById("test-finish-btn").style.display = "block";
    }
  });

  document.getElementById("test-next-btn").style.display = "none";
  document.getElementById("test-finish-btn").style.display = "none";
}

document.getElementById("test-next-btn").addEventListener("click", () => {
  currentTestIndex += 1;
  renderTestQuestion();
});

async function finishTrialTest() {
  const total = activeTestQuestions.length;
  const correct = testResults.filter(Boolean).length;

  if (testResults.length !== total) return;

  const currentScoreRaw = Math.round((correct / total) * SUBJECTS_META[activeTestSubject].max);
  const xpGained = correct * 5;
  const newXp = (currentProfile.xp || 0) + xpGained;

  const history = Array.isArray(currentProfile[`${activeTestSubject}_history`])
    ? [...currentProfile[`${activeTestSubject}_history`]]
    : [];

  history.push(currentScoreRaw);

  const updates = {
    xp: newXp,
    level: Math.floor(newXp / 100) + 1,
    [`${activeTestSubject}_score`]: Math.max(0, Math.min(200, Math.round(
      100 + (correct / total) * 100
    ))),
    [`${activeTestSubject}_history`]: history
  };

  try {
    const { data, error } = await supabaseClient
      .from("profiles")
      .update(updates)
      .eq("id", currentUser.id)
      .select()
      .single();

    if (error) throw error;

    currentProfile = data;
    leaderboardCache = null;
    renderDashboard();

    alert(
      `Тест завершено! Правильних відповідей: ${correct} з ${total}. ` +
      `Результат: ${updates[`${activeTestSubject}_score`]}/200.`
    );

    activeTestQuestions = [];
    testResults = [];
    showScreen("screen-dashboard");
  } catch (err) {
    alert(`Помилка збереження результату: ${err.message || err}`);
  }
}

document.getElementById("test-finish-btn").addEventListener("click", finishTrialTest);
document.getElementById("test-exit-btn").addEventListener("click", () => {
  activeTestQuestions = [];
  testResults = [];
  showScreen("screen-dashboard");
});

document.getElementById("btn-test").addEventListener("click", openTrialTestModal);

/* ---------------------------------------------------------------------
   ІНШІ КНОПКИ + НАВІГАЦІЯ
   --------------------------------------------------------------------- */

document.getElementById("btn-review").addEventListener("click", () =>
  openModal(`<h3>Лабораторія повторення</h3><p class="modal-hint">Розділ у розробці.</p>`)
);

document.querySelectorAll(".nav-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");

    const nav = btn.dataset.nav;
    document.querySelectorAll(".content-view").forEach(v => v.classList.remove("active"));

    const view = document.getElementById(`view-${nav}`);
    if (view) view.classList.add("active");

    if (nav === "analytics") renderAnalytics();
    if (nav === "profile") renderProfileView();
    if (nav === "leaderboard") loadLeaderboard();
  });
});

/* ---------------------------------------------------------------------
   ЗАПУСК
   --------------------------------------------------------------------- */

window.addEventListener("DOMContentLoaded", async () => {
  setAuthMode("login");

  try {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session?.user) {
      currentUser = session.user;
      await checkAndLoadProfile();
    }
  } catch (err) {
    console.error("Supabase session error:", err);
  }
});
