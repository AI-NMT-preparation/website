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
let sessionTopicCounts = {};

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

function normalizeCorrect(value) {
  if (value == null) return null;
  if (typeof value === "object") return value;
  const s = String(value).trim();
  if (/^[a-d]$/i.test(s)) return { option: s.toLowerCase() };
  if (/^[а-я]$/iu.test(s)) return { option: s.toUpperCase() };
  return { value: s };
}

function normalizeQuestion(row, subject, topicKey) {
  const type = row.question_type || "single_choice";
  let options = parseJson(row.options, []);
  if (!Array.isArray(options) || options.length === 0) {
    options = [row.option_a, row.option_b, row.option_c, row.option_d].filter(v => v != null && String(v).trim() !== "");
  }

  let correct = parseJson(row.correct_answer, null);
  if (!correct || (typeof correct === "object" && Object.keys(correct).length === 0)) {
    correct = normalizeCorrect(row.right_answer);
  }
  if (!correct && row.correct_option != null) correct = normalizeCorrect(row.correct_option);
  if (!correct && row.correct_index != null) correct = { index: Number(row.correct_index) };

  return {
    id: row.id,
    subject,
    topic: row.topic || topicKey,
    question_type: type,
    question_text: row.question_text || row.question || "",
    image_path: row.image_path || null,
    options,
    correct_answer: correct || {},
    matching_left: parseJson(row.matching_left, []),
    matching_right: parseJson(row.matching_right, []),
    table_data: parseJson(row.table_data, null),
    hint1: row.hint1 || null,
    hint2: row.hint2 || null,
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
    setTimeout(() => {
      closeModal();
      showScreen("screen-test");
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
  const target = normalizeLetter(c.option ?? c.value);
  if (["a", "b", "c", "d"].includes(target)) return target === ["a", "b", "c", "d"][index];
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
  document.getElementById(`${prefix}-topic-label`).textContent = mode === "test" ? topicLabel(activeSubject, q.topic) : topicLabel(activeSubject, q.topic);
  document.getElementById(`${prefix}-question-text`).innerHTML = escapeHtml(q.question_text).replace(/\n/g, "<br>");

  const image = document.getElementById(`${prefix}-image`);
  image.innerHTML = q.image_path ? `<img class="question-image" src="${escapeHtml(q.image_path)}" alt="Ілюстрація до питання">` : "";

  const options = document.getElementById(`${prefix}-options`);
  options.innerHTML = "";

  if (mode === "session") {
    const hints = document.getElementById("session-hints");
    hints.innerHTML = "";
    if (q.hint1 || q.hint2) {
      hints.innerHTML = `<button type="button" class="secondary-btn hint-btn" id="hint-btn">Дай підказку</button><div id="hint-text" class="hint-text"></div>`;
      let used = 0;
      document.getElementById("hint-btn").addEventListener("click", () => {
        const text = used === 0 ? q.hint1 : q.hint2;
        if (!text) { document.getElementById("hint-btn").disabled = true; return; }
        document.getElementById("hint-text").textContent = text;
        renderMathIn(document.getElementById("hint-text"));
        used++;
        if (used >= 2 || (used === 1 && !q.hint2)) document.getElementById("hint-btn").disabled = true;
      });
    }
  }

  const savedAnswer = questionAnswers[currentQuestionIndex];

  if (q.question_type === "matching") renderMatchingQuestion(q, options, mode, savedAnswer);
  else if (q.question_type === "short_answer") renderShortAnswerQuestion(q, options, mode, savedAnswer);
  else if (q.question_type === "table") renderTableQuestion(q, options, mode, savedAnswer);
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
  const letters = ["A", "B", "C", "D"];
  q.options.forEach((text, index) => {
    if (text == null || String(text).trim() === "") return;
    const el = document.createElement("div");
    el.className = "session-option";
    el.innerHTML = `<div class="session-option-letter">${letters[index]}</div><span>${escapeHtml(text)}</span>`;
    el.addEventListener("click", () => {
      // Дозволяємо переобирати відповідь будь-яку кількість разів до завершення сесії.
      [...container.children].forEach(c => c.classList.remove("correct", "wrong"));
      const correct = isSingleChoiceCorrect(q, index, text);
      el.classList.add(correct ? "correct" : "wrong");
      if (!correct) {
        const c = getQuestionCorrect(q);
        const ci = c.index != null ? Number(c.index) : ["a","b","c","d"].indexOf(normalizeLetter(c.option));
        if (ci >= 0 && container.children[ci]) container.children[ci].classList.add("correct");
      }
      recordAnswer(mode, { type: "single", selectedIndex: index, correct });
    });
    container.appendChild(el);
  });

  if (savedAnswer && savedAnswer.type === "single") {
    const selEl = container.children[savedAnswer.selectedIndex];
    if (selEl) selEl.classList.add(savedAnswer.correct ? "correct" : "wrong");
    if (!savedAnswer.correct) {
      const c = getQuestionCorrect(q);
      const ci = c.index != null ? Number(c.index) : ["a","b","c","d"].indexOf(normalizeLetter(c.option));
      if (ci >= 0 && container.children[ci]) container.children[ci].classList.add("correct");
    }
  }
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

function renderMatchingQuestion(q, container, mode, savedAnswer) {
  const left = Array.isArray(q.matching_left) ? q.matching_left : [];
  const right = Array.isArray(q.matching_right) ? q.matching_right : [];
  const correct = getQuestionCorrect(q);
  if (!left.length || !right.length) {
    container.innerHTML = "<p>Для завдання на відповідність не заповнені matching_left / matching_right.</p>";
    return;
  }
  container.innerHTML = left.map((item, i) => {
    const id = typeof item === "object" ? (item.id ?? i + 1) : i + 1;
    const label = typeof item === "object" ? (item.label ?? item.text ?? id) : item;
    return `<div class="matching-row"><span>${escapeHtml(label)}</span><select class="matching-select" data-id="${escapeHtml(id)}"><option value="">—</option>${right.map((r,j)=>{ const rid=typeof r==='object'?(r.id??String.fromCharCode(65+j)):String.fromCharCode(65+j); const rl=typeof r==='object'?(r.label??r.text??rid):r; return `<option value="${escapeHtml(rid)}">${escapeHtml(rl)}</option>`; }).join("")}</select></div>`;
  }).join("") + `<button id="matching-btn" class="primary-btn" type="button">Перевірити</button><div id="matching-result"></div>`;

  const resultEl = document.getElementById("matching-result");
  if (savedAnswer && savedAnswer.type === "matching") {
    container.querySelectorAll(".matching-select").forEach(sel => {
      const v = savedAnswer.selections ? savedAnswer.selections[sel.dataset.id] : null;
      if (v != null) sel.value = v;
    });
    resultEl.textContent = `Правильно: ${savedAnswer.correctCount} з ${savedAnswer.total}`;
  }

  document.getElementById("matching-btn").addEventListener("click", () => {
    const selects = [...container.querySelectorAll(".matching-select")];
    let correctCount = 0;
    const selections = {};
    selects.forEach(sel => {
      const key = sel.dataset.id;
      selections[key] = sel.value;
      const expected = correct[key] ?? correct[String(key)];
      if (String(sel.value) === String(expected ?? "__never__")) correctCount++;
    });
    const ok = correctCount === selects.length;
    resultEl.textContent = `Правильно: ${correctCount} з ${selects.length}`;
    recordAnswer(mode, { type: "matching", selections, correctCount, total: selects.length, correct: ok });
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
  currentQuestionIndex++;
  renderQuestion(mode);
}

function goToPreviousQuestion(mode) {
  if (currentQuestionIndex <= 0) return;
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

async function finishLearningSession() {
  correctAnswersCount = tallyResults();
  const expGained = correctAnswersCount * 10;
  const newXp = (currentProfile.xp || 0) + expGained;
  const updates = {
    xp: newXp,
    level: Math.floor(newXp / 100) + 1,
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
  renderDashboard();
  alert(`Сесію завершено! Правильних відповідей: ${correctAnswersCount} з ${activeQuestions.length}. Нараховано ${expGained} XP.`);
  showScreen("screen-dashboard");
}

function estimateTrialScore(subject, correct, total) {
  // Результат для профілю/графіка зберігаємо у звичній шкалі 100–200.
  // Це пропорційний орієнтир; офіційну таблицю переведення можна підключити окремо.
  return total ? Math.round(100 + (correct / total) * 100) : 100;
}

async function finishTrialTest() {
  correctAnswersCount = tallyResults();
  const score = estimateTrialScore(activeSubject, correctAnswersCount, activeQuestions.length);
  const history = Array.isArray(currentProfile[`${activeSubject}_history`]) ? [...currentProfile[`${activeSubject}_history`]] : [];
  history.push(score);
  const { data, error } = await supabaseClient.from("profiles").update({
    [`${activeSubject}_history`]: history,
    [`${activeSubject}_score`]: score
  }).eq("id", currentUser.id).select().single();
  if (error) throw error;
  currentProfile = data;
  leaderboardCache = null;
  renderDashboard();
  alert(`Пробний тест завершено! Правильних відповідей: ${correctAnswersCount} з ${activeQuestions.length}. Результат: ${score}/200.`);
  showScreen("screen-dashboard");
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
document.getElementById("session-exit-btn").addEventListener("click", () => showScreen("screen-dashboard"));
document.getElementById("test-exit-btn").addEventListener("click", () => showScreen("screen-dashboard"));

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
