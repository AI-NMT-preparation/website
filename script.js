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

  const totalQuestions = (currentProfile.math_questions || 0) + (currentProfile.ukrainian_questions || 0) + (currentProfile.history_questions || 0);
  const totalCorrect = (currentProfile.math_correct || 0) + (currentProfile.ukrainian_correct || 0) + (currentProfile.history_correct || 0);
  const dashQuestions = document.getElementById("dash-questions");
  const dashAccuracy = document.getElementById("dash-accuracy");
  if (dashQuestions) dashQuestions.textContent = totalQuestions;
  if (dashAccuracy) dashAccuracy.textContent = totalQuestions ? `${Math.round((totalCorrect / totalQuestions) * 100)}%` : "0%";
  const dashDifficulty = document.getElementById("dash-difficulty");
  if (dashDifficulty) dashDifficulty.textContent = "—";

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
   ІНТЕРАКТИВНА НАВЧАЛЬНА СЕСІЯ
   --------------------------------------------------------------------- */
let activeQuestions = [];
let currentQuestionIndex = 0;
let correctAnswersCount = 0;
let activeSubject = "";

document.getElementById("btn-session").addEventListener("click", () => {
  openModal(`
    <h3>Навчальна сесія</h3>
    <label class="modal-field-label">Оберіть предмет</label>
    <select id="modal-subject-select">
      <option value="math">Математика</option>
      <option value="ukrainian">Українська мова</option>
      <option value="history">Історія України</option>
    </select>
    <button class="modal-submit-btn" id="start-session-btn" type="button">Почати сесію</button>
    <div id="modal-status" class="modal-result"></div>
  `);

  document.getElementById("start-session-btn").addEventListener("click", async () => {
    activeSubject = document.getElementById("modal-subject-select").value;
    document.getElementById("modal-status").textContent = "Завантаження питань...";
    
    const { data, error } = await supabaseClient.from('questions').select('*').eq('subject', activeSubject).limit(10);
    
    if (error || !data || data.length === 0) {
      document.getElementById("modal-status").textContent = "Не вдалося завантажити питання з БД.";
      return;
    }
    
    activeQuestions = data;
    currentQuestionIndex = 0;
    correctAnswersCount = 0;
    
    closeModal();
    showScreen("screen-session");
    renderActiveQuestion();
  });
});

function renderActiveQuestion() {
  const q = activeQuestions[currentQuestionIndex];
  document.getElementById("session-progress-label").textContent = `Питання ${currentQuestionIndex + 1} з ${activeQuestions.length}`;
  document.getElementById("session-progress-fill").style.width = `${((currentQuestionIndex + 1) / activeQuestions.length) * 100}%`;
  
  const topicObj = TOPICS[activeSubject].find(t => t.key === q.topic);
  document.getElementById("session-topic-label").textContent = topicObj ? topicObj.label : "Загальне";
  
  // В таблице колонка называется question_text, а не question
  document.getElementById("session-question-text").textContent = q.question_text;
  
  const optionsDiv = document.getElementById("session-options");
  optionsDiv.innerHTML = "";
  
  // Массив букв для отображения (А, Б, В, Г...)
  const letters = ['a', 'b', 'c', 'd'];

  // q.options — это массив из Supabase, например: ["Вариант 1", "Вариант 2", ...]
  q.options.forEach((optionText, index) => {
    if (!optionText) return;
    const letter = letters[index];
    const opt = document.createElement("div");
    opt.className = "session-option";
    opt.innerHTML = `<div class="session-option-letter">${letter.toUpperCase()}</div><span>${optionText}</span>`;
    
    opt.addEventListener("click", () => {
      if (optionsDiv.classList.contains("answered")) return;
      optionsDiv.classList.add("answered");
      
      // Сравниваем индекс нажатого варианта с q.correct_index из таблицы
      const isCorrect = index === q.correct_index;
      if (isCorrect) {
        opt.classList.add("correct");
        correctAnswersCount++;
      } else {
        opt.classList.add("wrong");
      }
      
      if (currentQuestionIndex < activeQuestions.length - 1) {
        document.getElementById("session-next-btn").style.display = "block";
      } else {
        document.getElementById("session-finish-btn").style.display = "block";
      }
    });
    optionsDiv.appendChild(opt);
  });
  
  optionsDiv.classList.remove("answered");
  document.getElementById("session-next-btn").style.display = "none";
  document.getElementById("session-finish-btn").style.display = "none";
}

document.getElementById("session-finish-btn").addEventListener("click", async () => {
  const expGained = correctAnswersCount * 10;
  const newXp = (currentProfile.xp || 0) + expGained;
  
  try {
    const { data } = await supabaseClient.from('profiles').update({
      xp: newXp,
      level: Math.floor(newXp / 100) + 1,
      [`${activeSubject}_questions`]: (currentProfile[`${activeSubject}_questions`] || 0) + activeQuestions.length,
      [`${activeSubject}_correct`]: (currentProfile[`${activeSubject}_correct`] || 0) + correctAnswersCount
    }).eq('id', currentUser.id).select().single();
    
    currentProfile = data;
    leaderboardCache = null;
    renderDashboard();
    
    alert(`Сесія завершена! Правильних відповідей: ${correctAnswersCount} з ${activeQuestions.length}. Нараховано ${expGained} XP.`);
  } catch (err) {
    alert("Помилка збереження прогресу.");
  }
  
  document.getElementById("session-finish-btn").style.display = "none";
  showScreen("screen-dashboard");
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
    document.getElementById(`view-${nav}`).classList.add("active");
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
