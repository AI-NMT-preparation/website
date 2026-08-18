/* =====================================================================
   BOLEST.AI — ЛОГІКА ФРОНТЕНДУ
   =====================================================================
   Увесь реальний прогрес (рівень, exp, бали з предметів, статистика
   для аналітики) зберігається в базі даних Supabase (таблиця profiles),
   а не в localStorage браузера. Supabase сам зберігає токен сесії, тому
   при повторному відкритті сайту користувач лишається залогіненим.
   ===================================================================== */

// =====================================================================
// 1. ИНИЦИАЛИЗАЦИЯ SUPABASE
// =====================================================================
const SUPABASE_URL = 'https://envhnssxtxcoxazfblfg.supabase.co';
const SUPABASE_KEY = 'sb_publishable_G1U5Iy7GZQaAIM8Uoah-4g_2-A2xDoX'; // Замените на ваш anon/publishable ключ

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Текущий авторизованный пользователь и его профиль
let currentUser = null; 
let currentProfile = null;
let authMode = "login"; // "login" | "register"

const SUBJECTS_META = {
  math: { label: "Математика", max: 32 },
  ukrainian: { label: "Українська мова", max: 45 },
  history: { label: "Історія України", max: 54 }
};

// Кольори предметів — використовуються і в аналітиці, і в легенді графіка
const SUBJECT_COLORS = {
  math: "#f472b6",
  ukrainian: "#facc15",
  history: "#4ade80"
};

/* ---------------------------------------------------------------------
   ДЛЯ АНАЛІТИКИ потрібні нові колонки в таблиці profiles у Supabase.
   Один раз виконай у Supabase -> SQL Editor:

   ALTER TABLE profiles
     ADD COLUMN IF NOT EXISTS math_questions integer DEFAULT 0,
     ADD COLUMN IF NOT EXISTS math_correct integer DEFAULT 0,
     ADD COLUMN IF NOT EXISTS ukrainian_questions integer DEFAULT 0,
     ADD COLUMN IF NOT EXISTS ukrainian_correct integer DEFAULT 0,
     ADD COLUMN IF NOT EXISTS history_questions integer DEFAULT 0,
     ADD COLUMN IF NOT EXISTS history_correct integer DEFAULT 0,
     ADD COLUMN IF NOT EXISTS math_history jsonb DEFAULT '[]'::jsonb,
     ADD COLUMN IF NOT EXISTS ukrainian_history jsonb DEFAULT '[]'::jsonb,
     ADD COLUMN IF NOT EXISTS history_history jsonb DEFAULT '[]'::jsonb;

   Пояснення:
   - {subject}_questions / {subject}_correct — рахуються з Навчальних
     сесій (кожна сесія = 10 питань), звідси беруться "Питань розв'язано"
     і "Точність" в Аналітиці.
   - {subject}_history — масив балів (100–200) з усіх пройдених пробних
     тестів по цьому предмету, по порядку — звідси будується графік.
   --------------------------------------------------------------------- */

/* ---------------------------------------------------------------------
   ДЛЯ ЛІДЕРБОРДУ потрібно, щоб усі залогінені користувачі могли читати
   (тільки читати!) чужі рядки з profiles — за замовчуванням Supabase
   дозволяє людині бачити тільки свій власний рядок. Один раз виконай
   у Supabase -> SQL Editor:

   CREATE POLICY "Публічне читання для лідерборду"
   ON profiles FOR SELECT
   USING (true);

   Це відкриває читання ВСІХ колонок таблиці всім користувачам (не
   тільки залогіненим) — для нікнейму/балів/аватарки це нормально,
   бо це й так публічна інформація на лідерборді. Але якщо пізніше
   додаси в profiles щось приватне (наприклад email) — постав цю
   інформацію в окрему таблицю або зроби публічний VIEW лише з
   потрібними колонками, а не відкривай всю таблицю.
   --------------------------------------------------------------------- */

/* ---------------------------------------------------------------------
   ПЕРЕКЛЮЧЕНИЕ ЭКРАНОВ
   --------------------------------------------------------------------- */
function showScreen(id) {
  document.querySelectorAll(".screen").forEach(el => el.classList.remove("active"));
  document.getElementById(id).classList.add("active");
}

/* ---------------------------------------------------------------------
   ЕКРАН 1: ВХОД / РЕГИСТРАЦИЯ (SUPABASE AUTH)
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

authSwitchBtn.addEventListener("click", () => {
  setAuthMode(authMode === "login" ? "register" : "login");
});

authSubmitBtn.addEventListener("click", handleAuthSubmit);
passwordInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") handleAuthSubmit();
});

async function handleAuthSubmit() {
  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!email || !password) {
    authNote.textContent = "Заповніть email та пароль.";
    return;
  }

  authSubmitBtn.disabled = true;
  authNote.textContent = "";

  try {
    let authData, authError;

    if (authMode === "login") {
      const res = await supabaseClient.auth.signInWithPassword({ email, password });
      authData = res.data;
      authError = res.error;
    } else {
      const res = await supabaseClient.auth.signUp({ email, password });
      authData = res.data;
      authError = res.error;
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

// Проверка наличия профиля в DB
async function checkAndLoadProfile() {
  if (!currentUser) return;

  const { data: profile, error } = await supabaseClient
    .from('profiles')
    .select('*')
    .eq('id', currentUser.id)
    .maybeSingle();

  if (error) {
    console.error("Ошибка загрузки профиля:", error);
    return;
  }

  if (profile) {
    currentProfile = profile;
    renderDashboard();
    showScreen("screen-dashboard");
  } else {
    // Если профиля нет — отправляем на настройку
    showScreen("screen-setup");
  }
}

/* ---------------------------------------------------------------------
   ЕКРАН 2: НАЛАШТУВАННЯ ПРОФІЛЮ (СОХРАНЕНИЕ В SUPABASE)
   --------------------------------------------------------------------- */
const avatarInput = document.getElementById("avatar-input");
const avatarImg = document.getElementById("avatar-img");
const avatarPlaceholder = document.getElementById("avatar-placeholder");
const nicknameInput = document.getElementById("nickname-input");
const descriptionInput = document.getElementById("description-input");
const randomQuoteBtn = document.getElementById("random-quote-btn");
const finishSetupBtn = document.getElementById("finish-setup-btn");

const QUOTES = [
  "Знання — це зброя.",
  "Маленькі кроки щодня ведуть до великого успіху.",
  "Дисципліна б'є талант."
];

randomQuoteBtn.addEventListener("click", () => {
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

  if (!nickname) {
    nicknameInput.focus();
    nicknameInput.style.borderColor = "#f87171";
    return;
  }

  finishSetupBtn.disabled = true;

  try {
    const { data, error } = await supabaseClient
      .from('profiles')
      .insert([
        {
          id: currentUser.id,
          nickname: nickname,
          description: descriptionInput.value.trim(),
          xp: 0,
          level: 1
        }
      ])
      .select()
      .single();

    if (error) throw error;

    currentProfile = data;
    leaderboardCache = null; // дані змінились — оновимо лідерборд при наступному відкритті
    renderDashboard();
    showScreen("screen-dashboard");
  } catch (err) {
    alert("Помилка збереження: " + err.message);
  } finally {
    finishSetupBtn.disabled = false;
  }
});

/* ---------------------------------------------------------------------
   ЕКРАН 3: ГОЛОВНА СТОРІНКА — РЕНДЕР ПРОГРЕСУ
   --------------------------------------------------------------------- */
const levelTitleEl = document.getElementById("level-title");
const levelPointsEl = document.getElementById("level-points");
const xpFillEl = document.getElementById("xp-fill");

function renderDashboard() {
  if (!currentProfile) return;

  const totalXp = currentProfile.xp || 0;
  const level = Math.floor(totalXp / 100) + 1;
  const expIntoLevel = totalXp % 100;
  const expForNextLevel = 100;

  levelTitleEl.textContent = `Рівень ${level}`;
  levelPointsEl.textContent = `${expIntoLevel}/${expForNextLevel}`;
  xpFillEl.style.width = `${Math.min(100, (expIntoLevel / expForNextLevel) * 100)}%`;

  renderSubjectRow("math", currentProfile.math_score);
  renderSubjectRow("ukrainian", currentProfile.ukrainian_score);
  renderSubjectRow("history", currentProfile.history_score);

  renderAnalytics();
}

function renderSubjectRow(subject, rating) {
  const scoreEl = document.getElementById(`score-${subject}`);
  const rangeEl = document.getElementById(`range-${subject}`);
  const meta = SUBJECTS_META[subject];

  if (rating === null || rating === undefined) {
    scoreEl.textContent = "—";
    rangeEl.textContent = "Ще не складали";
  } else {
    scoreEl.textContent = rating;
    rangeEl.textContent = `Шкала: 100–200 · максимум тестових балів: ${meta.max}`;
  }
}

/* ---------------------------------------------------------------------
   АНАЛІТИКА: 3 колонки (питання/точність) + таблиця балів + графік
   --------------------------------------------------------------------- */
function renderAnalytics() {
  if (!currentProfile) return;

  ["math", "ukrainian", "history"].forEach(subject => {
    const questions = currentProfile[`${subject}_questions`] || 0;
    const correct = currentProfile[`${subject}_correct`] || 0;
    const accuracy = questions > 0 ? Math.round((correct / questions) * 100) : 0;

    document.getElementById(`an-${subject}-questions`).textContent = questions;
    document.getElementById(`an-${subject}-accuracy`).textContent = `${accuracy}%`;

    const rating = currentProfile[`${subject}_score`];
    document.getElementById(`an-table-${subject}`).textContent =
      (rating === null || rating === undefined) ? "—" : rating;
  });

  renderAnalyticsChart();
}

function renderAnalyticsChart() {
  const svg = document.getElementById("analytics-chart");
  const emptyNote = document.getElementById("chart-empty-note");
  const subjects = ["math", "ukrainian", "history"];

  const histories = {};
  let hasAnyData = false;
  let maxLen = 0;

  subjects.forEach(subject => {
    const hist = currentProfile[`${subject}_history`] || [];
    histories[subject] = hist;
    if (hist.length > 0) hasAnyData = true;
    maxLen = Math.max(maxLen, hist.length);
  });

  svg.innerHTML = "";
  emptyNote.style.display = hasAnyData ? "none" : "block";
  if (!hasAnyData) return;

  const width = 640;
  const height = 280;
  const padding = { top: 20, right: 20, bottom: 30, left: 44 };
  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;

  const yMin = 100;
  const yMax = 200;

  const xForIndex = (i) => padding.left + (maxLen === 1 ? plotW / 2 : (i / (maxLen - 1)) * plotW);
  const yForScore = (score) => padding.top + plotH - ((score - yMin) / (yMax - yMin)) * plotH;

  // горизонтальні напрямні лінії (100 / 150 / 200)
  [100, 150, 200].forEach(val => {
    const y = yForScore(val);
    svg.insertAdjacentHTML("beforeend", `
      <line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}"
            stroke="#2c2d34" stroke-width="1" />
      <text x="4" y="${y + 4}" font-size="11" fill="#9a9ba3">${val}</text>
    `);
  });

  subjects.forEach(subject => {
    const hist = histories[subject];
    if (hist.length === 0) return;

    const points = hist.map((score, i) => `${xForIndex(i)},${yForScore(score)}`).join(" ");
    svg.insertAdjacentHTML("beforeend", `
      <polyline points="${points}" fill="none" stroke="${SUBJECT_COLORS[subject]}"
                stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" />
    `);

    hist.forEach((score, i) => {
      svg.insertAdjacentHTML("beforeend", `
        <circle cx="${xForIndex(i)}" cy="${yForScore(score)}" r="3.5" fill="${SUBJECT_COLORS[subject]}" />
      `);
    });
  });
}

/* ---------------------------------------------------------------------
   ПРОФІЛЬ: фото по центру (або "немає фото"), рівень, к-сть питань, опис
   --------------------------------------------------------------------- */
function renderProfileView() {
  if (!currentProfile) return;

  document.getElementById("profile-level").textContent = `Рівень ${currentProfile.level || 1}`;

  const totalQuestions =
    (currentProfile.math_questions || 0) +
    (currentProfile.ukrainian_questions || 0) +
    (currentProfile.history_questions || 0);
  document.getElementById("profile-questions").textContent = `${totalQuestions} питань`;

  const avatarImg = document.getElementById("profile-avatar-img");
  const avatarPlaceholder = document.getElementById("profile-avatar-placeholder");
  if (currentProfile.avatar) {
    avatarImg.src = currentProfile.avatar;
    avatarImg.style.display = "block";
    avatarPlaceholder.style.display = "none";
  } else {
    avatarImg.style.display = "none";
    avatarPlaceholder.style.display = "block";
  }

  document.getElementById("profile-nickname").textContent = currentProfile.nickname || "—";

  const descEl = document.getElementById("profile-description");
  descEl.textContent = currentProfile.description ? currentProfile.description : "Опис відсутній";
}

/* ---------------------------------------------------------------------
   ЛІДЕРБОРД: список лідерів з фільтром за критерієм
   --------------------------------------------------------------------- */
let leaderboardFilter = "questions";
let leaderboardCache = null; // кешуємо сирі дані, фільтр далі рахуємо на клієнті

async function loadLeaderboard() {
  const listEl = document.getElementById("leaderboard-list");
  const emptyNote = document.getElementById("leaderboard-empty-note");

  if (!leaderboardCache) {
    listEl.innerHTML = `<p class="leaderboard-empty" id="leaderboard-empty-note">Завантаження...</p>`;

    const { data, error } = await supabaseClient
      .from('profiles')
      .select('id, nickname, avatar, math_questions, math_correct, ukrainian_questions, ukrainian_correct, history_questions, history_correct, math_score, ukrainian_score, history_score')
      .limit(200);

    if (error) {
      listEl.innerHTML = `<p class="leaderboard-empty">Не вдалося завантажити лідерборд: ${error.message}</p>`;
      return;
    }

    leaderboardCache = data.map(row => {
      const totalQuestions =
        (row.math_questions || 0) + (row.ukrainian_questions || 0) + (row.history_questions || 0);
      const totalCorrect =
        (row.math_correct || 0) + (row.ukrainian_correct || 0) + (row.history_correct || 0);
      const accuracy = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;

      return { ...row, totalQuestions, accuracy };
    });
  }

  renderLeaderboardList();
}

function renderLeaderboardList() {
  const listEl = document.getElementById("leaderboard-list");
  if (!leaderboardCache) return;

  let rows = [...leaderboardCache];
  let valueKey; // ключ значення, яке показуємо праворуч
  let valueSuffix = "";

  if (leaderboardFilter === "questions") {
    valueKey = "totalQuestions";
    rows.sort((a, b) => b.totalQuestions - a.totalQuestions);
  } else if (leaderboardFilter === "accuracy") {
    valueKey = "accuracy";
    valueSuffix = "%";
    rows = rows.filter(r => r.totalQuestions > 0);
    rows.sort((a, b) => b.accuracy - a.accuracy);
  } else {
    // math / ukrainian / history — рейтинг по балах предмета
    const scoreField = `${leaderboardFilter}_score`;
    valueKey = scoreField;
    rows = rows.filter(r => r[scoreField] !== null && r[scoreField] !== undefined);
    rows.sort((a, b) => b[scoreField] - a[scoreField]);
  }

  rows = rows.slice(0, 20);

  if (rows.length === 0) {
    listEl.innerHTML = `<p class="leaderboard-empty">Поки що немає результатів у цій категорії.</p>`;
    return;
  }

  listEl.innerHTML = rows.map((row, i) => `
    <div class="leaderboard-row">
      <span class="leaderboard-rank">${i + 1}</span>
      <span class="leaderboard-avatar">
        ${row.avatar
          ? `<img src="${row.avatar}" alt="">`
          : (row.nickname ? row.nickname.charAt(0).toUpperCase() : "?")}
      </span>
      <span class="leaderboard-name">${row.nickname || "Без нікнейму"}</span>
      <span class="leaderboard-value">${row[valueKey]}${valueSuffix}</span>
    </div>
  `).join("");
}

document.querySelectorAll(".filter-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    leaderboardFilter = btn.dataset.filter;
    renderLeaderboardList();
  });
});

/* ---------------------------------------------------------------------
   МОДАЛЬНОЕ ОКНО
   --------------------------------------------------------------------- */
const modalOverlay = document.getElementById("modal-overlay");
const modalContent = document.getElementById("modal-content");
const modalClose = document.getElementById("modal-close");

function openModal(html) {
  modalContent.innerHTML = html;
  modalOverlay.classList.add("active");
}
function closeModal() {
  modalOverlay.classList.remove("active");
}
modalClose.addEventListener("click", closeModal);
modalOverlay.addEventListener("click", (e) => {
  if (e.target === modalOverlay) closeModal();
});

// Навчальна сесія (+10 XP за правильный ответ, + рахує "Питання"/"Точність" в Аналітиці по предмету)
document.getElementById("btn-session").addEventListener("click", () => {
  openModal(`
    <h3>Навчальна сесія</h3>
    <label class="modal-field-label" for="session-subject">Предмет</label>
    <select id="session-subject">
      <option value="math">Математика</option>
      <option value="ukrainian">Українська мова</option>
      <option value="history">Історія України</option>
    </select>

    <p class="modal-hint">Скільки завдань з 10 ви розв'язали правильно?</p>
    <label class="modal-field-label" for="session-correct">Правильних відповідей</label>
    <input type="number" id="session-correct" min="0" max="10" value="0">
    <button class="modal-submit-btn" id="session-submit" type="button">Завершити сесію</button>
    <div class="modal-result" id="session-result"></div>
  `);

  document.getElementById("session-submit").addEventListener("click", async () => {
    const subject = document.getElementById("session-subject").value;
    const input = document.getElementById("session-correct");
    const resultEl = document.getElementById("session-result");
    let correct = parseInt(input.value, 10) || 0;
    correct = Math.max(0, Math.min(10, correct));

    const expGained = correct * 10;
    const newXp = (currentProfile.xp || 0) + expGained;
    const newLevel = Math.floor(newXp / 100) + 1;

    const newQuestions = (currentProfile[`${subject}_questions`] || 0) + 10;
    const newCorrect = (currentProfile[`${subject}_correct`] || 0) + correct;

    try {
      const { data, error } = await supabaseClient
        .from('profiles')
        .update({
          xp: newXp,
          level: newLevel,
          [`${subject}_questions`]: newQuestions,
          [`${subject}_correct`]: newCorrect
        })
        .eq('id', currentUser.id)
        .select()
        .single();

      if (error) throw error;

      currentProfile = data;
    leaderboardCache = null; // дані змінились — оновимо лідерборд при наступному відкритті
      renderDashboard();
      resultEl.textContent = `Нараховано +${expGained} exp.`;
    } catch (err) {
      resultEl.textContent = "Помилка: " + err.message;
    }
  });
});

// Пробный тест
document.getElementById("btn-test").addEventListener("click", () => {
  openModal(`
    <h3>Пробний тест</h3>
    <label class="modal-field-label" for="test-subject">Предмет</label>
    <select id="test-subject">
      <option value="math">Математика (макс. 32)</option>
      <option value="ukrainian">Українська мова (макс. 45)</option>
      <option value="history">Історія України (макс. 54)</option>
    </select>

    <label class="modal-field-label" for="test-raw">Кількість правильних відповідей</label>
    <input type="number" id="test-raw" min="0" value="0">

    <button class="modal-submit-btn" id="test-submit" type="button">Завершити тест</button>
    <div class="modal-result" id="test-result"></div>
  `);

  const subjectSelect = document.getElementById("test-subject");
  const rawInput = document.getElementById("test-raw");

  const syncMax = () => { rawInput.max = SUBJECTS_META[subjectSelect.value].max; };
  syncMax();
  subjectSelect.addEventListener("change", syncMax);

  document.getElementById("test-submit").addEventListener("click", async () => {
    const subject = subjectSelect.value;
    const resultEl = document.getElementById("test-result");
    let raw = parseInt(rawInput.value, 10) || 0;

    // Умовний перевод тестових балів у шкалу 100-200
    const scaledScore = 100 + Math.round((raw / SUBJECTS_META[subject].max) * 100);
    const expGained = 20;

    const newHistory = [...(currentProfile[`${subject}_history`] || []), scaledScore];

    const updates = {
      xp: (currentProfile.xp || 0) + expGained,
      level: Math.floor(((currentProfile.xp || 0) + expGained) / 100) + 1,
      [`${subject}_score`]: scaledScore,
      [`${subject}_history`]: newHistory
    };

    try {
      const { data, error } = await supabaseClient
        .from('profiles')
        .update(updates)
        .eq('id', currentUser.id)
        .select()
        .single();

      if (error) throw error;

      currentProfile = data;
    leaderboardCache = null; // дані змінились — оновимо лідерборд при наступному відкритті
      renderDashboard();
      resultEl.textContent = `Тест складено! Ваш бал: ${scaledScore} (+${expGained} exp)`;
    } catch (err) {
      resultEl.textContent = "Помилка: " + err.message;
    }
  });
});

document.getElementById("btn-review").addEventListener("click", () => {
  openModal(`
    <h3>Лабораторія повторення</h3>
    <p class="modal-hint">Цей розділ ще в розробці.</p>
  `);
});

/* ---------------------------------------------------------------------
   НАВИГАЦИЯ И ВИТРИНА
   --------------------------------------------------------------------- */
document.querySelectorAll(".nav-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");

    const nav = btn.dataset.nav;
    const knownViews = ["tutor", "analytics", "profile", "leaderboard"];
    if (knownViews.includes(nav)) {
      document.querySelectorAll(".content-view").forEach(v => v.classList.remove("active"));
      document.getElementById(`view-${nav}`).classList.add("active");

      if (nav === "analytics") renderAnalytics();
      if (nav === "profile") renderProfileView();
      if (nav === "leaderboard") loadLeaderboard();
    }
  });
});

document.querySelectorAll(".tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
  });
});

/* ---------------------------------------------------------------------
   СТАРТ ПРИ ЗАГРУЗКЕ СТРАНИЦЫ (АВТОВХОД ИЗ СЕССИИ SUPABASE)
   --------------------------------------------------------------------- */
window.addEventListener("DOMContentLoaded", async () => {
  setAuthMode("login");

  // Проверяем существующую сессию Supabase
  const { data: { session } } = await supabaseClient.auth.getSession();

  if (session && session.user) {
    currentUser = session.user;
    await checkAndLoadProfile();
  }
});
