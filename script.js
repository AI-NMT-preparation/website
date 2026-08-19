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
   СПИСОК ТЕМ ПО ПРЕДМЕТАХ
   ---------------------------------------------------------------------
   "key" — це маркер, який має точно так само (символ в символ) стояти
   в колонці topic таблиці questions у Supabase для цієї теми.
   "label" — те, що бачить користувач на сайті.
   --------------------------------------------------------------------- */
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

/* ---------------------------------------------------------------------
   ТАБЛИЦІ ПЕРЕВОДУ ТЕСТОВИХ БАЛІВ У РЕЙТИНГОВУ ШКАЛУ (100–200) —
   використовуються при завершенні Пробного тесту.
   Математика: значення для балів 15, 16, 17, 30, 31 приблизні —
   у вихідній таблиці МОН вони були закриті вікном чату на скріні.
   --------------------------------------------------------------------- */
const SCORE_TABLES = {
  math: {
    max: 32, threshold: 5,
    table: {
      5: 100, 6: 108, 7: 115, 8: 123, 9: 131, 10: 134, 11: 137, 12: 140,
      13: 143, 14: 145, 15: 146, 16: 148, 17: 149, 18: 150, 19: 151, 20: 152,
      21: 155, 22: 159, 23: 163, 24: 167, 25: 170, 26: 173, 27: 176, 28: 180,
      29: 184, 30: 189, 31: 194, 32: 200
    }
  },
  ukrainian: {
    max: 45, threshold: 8,
    table: {
      8: 100, 9: 105, 10: 110, 11: 120, 12: 125, 13: 130, 14: 133, 15: 136,
      16: 138, 17: 140, 18: 142, 19: 143, 20: 144, 21: 145, 22: 146, 23: 147,
      24: 148, 25: 150, 26: 152, 27: 154, 28: 155, 29: 156, 30: 157, 31: 159,
      32: 161, 33: 163, 34: 165, 35: 167, 36: 169, 37: 171, 38: 173, 39: 176,
      40: 180, 41: 184, 42: 188, 43: 192, 44: 196, 45: 200
    }
  },
  history: {
    max: 54, threshold: 9,
    table: {
      9: 100, 10: 105, 11: 110, 12: 115, 13: 120, 14: 124, 15: 128, 16: 132,
      17: 135, 18: 138, 19: 140, 20: 141, 21: 142, 22: 143, 23: 143.5, 24: 144,
      25: 145, 26: 146, 27: 147, 28: 148, 29: 149, 30: 150, 31: 151, 32: 152,
      33: 154, 34: 156, 35: 158, 36: 160, 37: 161, 38: 162, 39: 164, 40: 166,
      41: 170, 42: 172, 43: 174, 44: 176, 45: 178, 46: 180, 47: 182, 48: 184,
      49: 186, 50: 188, 51: 191, 52: 194, 53: 197, 54: 200
    }
  }
};

function convertRawToScaled(subject, rawScore) {
  const cfg = SCORE_TABLES[subject];
  if (rawScore < cfg.threshold) return null;
  const capped = Math.min(rawScore, cfg.max);
  return cfg.table[capped] ?? null;
}

/* ---------------------------------------------------------------------
   ДЛЯ НАВЧАЛЬНОЇ СЕСІЇ / ПРОБНОГО ТЕСТУ потрібна таблиця з питаннями
   і колонка в profiles для прогресу по темах. Один раз виконай у
   Supabase -> SQL Editor:

   CREATE TABLE IF NOT EXISTS questions (
     id bigint generated by default as identity primary key,
     subject text NOT NULL,             -- 'math' | 'ukrainian' | 'history'
     topic text NOT NULL,               -- маркер теми, напр. 'planimetry'
     question text NOT NULL,
     option_a text NOT NULL,
     option_b text NOT NULL,
     option_c text NOT NULL,
     option_d text NOT NULL,
     correct_option text NOT NULL CHECK (correct_option IN ('a','b','c','d')),
     hint1 text,
     hint2 text
   );

   ALTER TABLE questions ENABLE ROW LEVEL SECURITY;

   CREATE POLICY "Читання питань для залогінених"
   ON questions FOR SELECT
   USING (auth.role() = 'authenticated');

   ALTER TABLE profiles
     ADD COLUMN IF NOT EXISTS topic_progress jsonb DEFAULT '{}'::jsonb;

   Заповнюй таблицю questions вручну (або імпортом з Google Sheets /
   CSV) — по 4 варіанти відповіді в option_a..option_d, вірний варіант
   у correct_option ('a'/'b'/'c'/'d'), і, за бажанням, hint1/hint2 —
   дві підказки, які видаються по черзі кнопкою "Дай підказку" під час
   навчальної сесії. Значення в колонці topic мають ЗБІГАТИСЯ 1-в-1 з
   key з об'єкта TOPICS вище (напр. "planimetry", "syntax" тощо).
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

  renderStatsBlock();
  renderPriorities();
  renderAnalytics();
}

function renderStatsBlock() {
  const totalQuestions =
    (currentProfile.math_questions || 0) +
    (currentProfile.ukrainian_questions || 0) +
    (currentProfile.history_questions || 0);
  const totalCorrect =
    (currentProfile.math_correct || 0) +
    (currentProfile.ukrainian_correct || 0) +
    (currentProfile.history_correct || 0);
  const accuracy = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;

  document.getElementById("stats-total-questions").textContent = totalQuestions;
  document.getElementById("stats-total-accuracy").textContent = `${accuracy}%`;
}

// Пріоритети навчального плану: повний список усіх тем з кількістю
// розв'язаних завдань (береться з profiles.topic_progress)
function renderPriorities() {
  const listEl = document.getElementById("priorities-list");
  const progress = currentProfile.topic_progress || {};
  const subjectDotClass = { math: "dot-math", ukrainian: "dot-ukrainian", history: "dot-history" };

  let html = "";
  Object.keys(TOPICS).forEach(subject => {
    TOPICS[subject].forEach(topic => {
      const solved = progress[`${subject}:${topic.key}`] || 0;
      html += `
        <div class="session-item">
          <div class="session-label">
            <span class="legend-dot ${subjectDotClass[subject]}"></span>${SUBJECTS_META[subject].label}
          </div>
          <div class="session-topic-name">${topic.label}</div>
          <div class="session-progress">Кількість розв'язаних завдань: ${solved}</div>
        </div>
      `;
    });
  });
  listEl.innerHTML = html;
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

// Навчальна сесія:
// 1) вибір предметів/тем чекбоксами;
// 2) для кожної обраної теми — 1..10 питань повзунком;
// 3) завантаження питань з уже наявної таблиці questions;
// 4) проходження через вже наявний #screen-session;
// 5) після завершення — оновлення існуючої статистики профілю.

let sessionPlan = [];
let sessionQuestions = [];
let sessionIndex = 0;
let sessionCorrectCount = 0;
let sessionAnswered = false;
let sessionHintStep = 0;

function subjectTopicsHtml(subject) {
  const meta = SUBJECTS_META[subject];
  const topics = TOPICS[subject];

  return `
    <div class="topic-picker-subject" data-subject-group="${subject}">
      <h4>${meta.label}</h4>

      <label class="topic-checkbox-row subject-all">
        <input type="checkbox" class="subject-all-checkbox" data-subject="${subject}">
        <span>Весь предмет</span>
      </label>

      ${topics.map(topic => `
        <label class="topic-checkbox-row">
          <input
            type="checkbox"
            class="topic-checkbox"
            data-subject="${subject}"
            data-topic="${topic.key}"
          >
          <span>${topic.label}</span>
        </label>
      `).join("")}
    </div>
  `;
}

function openSessionTopicStep() {
  openModal(`
    <h3 class="session-setup-title">Які теми тренуємо?</h3>
    <p class="session-setup-subtitle">
      Оберіть предмет повністю або окремі теми.
    </p>

    <div class="topic-picker">
      ${subjectTopicsHtml("math")}
      ${subjectTopicsHtml("ukrainian")}
      ${subjectTopicsHtml("history")}
    </div>

    <div class="topic-picker-actions">
      <button class="secondary-btn" id="session-cancel-btn" type="button">Скасувати</button>
      <button class="modal-submit-btn" id="session-topics-next" type="button">Далі</button>
    </div>
    <div class="modal-result" id="session-setup-result"></div>
  `);

  document.querySelectorAll(".subject-all-checkbox").forEach(allBox => {
    allBox.addEventListener("change", () => {
      const subject = allBox.dataset.subject;
      document.querySelectorAll(`.topic-checkbox[data-subject="${subject}"]`)
        .forEach(box => { box.checked = allBox.checked; });
    });
  });

  document.querySelectorAll(".topic-checkbox").forEach(box => {
    box.addEventListener("change", () => {
      const subject = box.dataset.subject;
      const boxes = [...document.querySelectorAll(`.topic-checkbox[data-subject="${subject}"]`)];
      const allBox = document.querySelector(`.subject-all-checkbox[data-subject="${subject}"]`);
      allBox.checked = boxes.length > 0 && boxes.every(item => item.checked);
    });
  });

  document.getElementById("session-cancel-btn").addEventListener("click", closeModal);

  document.getElementById("session-topics-next").addEventListener("click", () => {
    const selected = [...document.querySelectorAll(".topic-checkbox:checked")];

    if (selected.length === 0) {
      document.getElementById("session-setup-result").textContent =
        "Оберіть хоча б одну тему.";
      return;
    }

    const selectedTopics = selected.map(box => {
      const subject = box.dataset.subject;
      const topic = TOPICS[subject].find(item => item.key === box.dataset.topic);
      return { subject, ...topic, count: 1 };
    });

    openSessionQuestionCountStep(selectedTopics);
  });
}

function openSessionQuestionCountStep(selectedTopics) {
  const grouped = Object.keys(TOPICS)
    .map(subject => ({
      subject,
      topics: selectedTopics.filter(item => item.subject === subject)
    }))
    .filter(group => group.topics.length > 0);

  openModal(`
    <h3 class="session-setup-title">Кількість питань</h3>
    <p class="session-setup-subtitle">
      Встановіть від 1 до 10 питань для кожної обраної теми.
    </p>

    <div class="question-count-list">
      ${grouped.map(group => `
        <div class="question-count-group">
          <h4>${SUBJECTS_META[group.subject].label}</h4>

          ${group.topics.map(topic => `
            <div class="question-count-row">
              <div class="slider-row-label">
                <span>${topic.label}</span>
                <span class="slider-value" id="count-value-${topic.subject}-${topic.key}">1</span>
              </div>
              <input
                type="range"
                min="1"
                max="10"
                value="1"
                data-subject="${topic.subject}"
                data-topic="${topic.key}"
                class="session-question-range"
              >
            </div>
          `).join("")}
        </div>
      `).join("")}
    </div>

    <div class="topic-picker-actions">
      <button class="secondary-btn" id="session-count-back" type="button">Назад</button>
      <button class="modal-submit-btn" id="session-start-btn" type="button">Почати сесію</button>
    </div>
    <div class="modal-result" id="session-count-result"></div>
  `);

  document.querySelectorAll(".session-question-range").forEach(range => {
    range.addEventListener("input", () => {
      const valueEl = document.getElementById(
        `count-value-${range.dataset.subject}-${range.dataset.topic}`
      );
      valueEl.textContent = range.value;
    });
  });

  document.getElementById("session-count-back").addEventListener("click", () => {
    openSessionTopicStep();
  });

  document.getElementById("session-start-btn").addEventListener("click", async () => {
    const ranges = [...document.querySelectorAll(".session-question-range")];

    sessionPlan = ranges.map(range => ({
      subject: range.dataset.subject,
      topic: TOPICS[range.dataset.subject].find(item => item.key === range.dataset.topic),
      count: Number(range.value)
    }));

    const resultEl = document.getElementById("session-count-result");
    const startBtn = document.getElementById("session-start-btn");

    startBtn.disabled = true;
    resultEl.textContent = "Завантаження питань...";

    try {
      const loaded = [];

      for (const plan of sessionPlan) {
        const { data, error } = await supabaseClient
          .from("questions")
          .select("id, subject, topic, question, option_a, option_b, option_c, option_d, correct_option, hint1, hint2")
          .eq("subject", plan.subject)
          .eq("topic", plan.topic.key)
          .limit(plan.count);

        if (error) throw error;

        if (!data || data.length < plan.count) {
          throw new Error(
            `Для теми «${plan.topic.label}» недостатньо питань у базі. Потрібно: ${plan.count}, доступно: ${data ? data.length : 0}.`
          );
        }

        // Перемішуємо вже завантажені питання, не додаючи нової логіки/бібліотек.
        const shuffled = [...data].sort(() => Math.random() - 0.5);
        loaded.push(...shuffled);
      }

      sessionQuestions = loaded.sort(() => Math.random() - 0.5);
      window.__bolestSessionResults = [];
      sessionIndex = 0;
      sessionCorrectCount = 0;
      sessionAnswered = false;
      sessionHintStep = 0;

      closeModal();
      showScreen("screen-session");
      renderSessionQuestion();
    } catch (err) {
      resultEl.textContent = "Помилка: " + (err.message || "Не вдалося завантажити питання.");
      startBtn.disabled = false;
    }
  });
}

document.getElementById("btn-session").addEventListener("click", openSessionTopicStep);

function renderSessionQuestion() {
  if (!sessionQuestions.length) return;

  const item = sessionQuestions[sessionIndex];
  sessionAnswered = false;
  sessionHintStep = 0;

  document.getElementById("session-progress-label").textContent =
    `Питання ${sessionIndex + 1}/${sessionQuestions.length}`;

  document.getElementById("session-progress-fill").style.width =
    `${((sessionIndex + 1) / sessionQuestions.length) * 100}%`;

  document.getElementById("session-topic-label").textContent =
    `${SUBJECTS_META[item.subject].label} · ${item.topic}`;

  document.getElementById("session-question-text").textContent = item.question;

  const options = [
    ["a", item.option_a],
    ["b", item.option_b],
    ["c", item.option_c],
    ["d", item.option_d]
  ];

  const optionsEl = document.getElementById("session-options");
  optionsEl.innerHTML = options.map(([letter, text]) => `
    <button class="session-option" type="button" data-option="${letter}">
      <span class="session-option-letter">${letter.toUpperCase()}</span>
      <span>${text}</span>
    </button>
  `).join("");

  optionsEl.querySelectorAll(".session-option").forEach(button => {
    button.addEventListener("click", () => answerSessionQuestion(button.dataset.option));
  });

  document.getElementById("session-next-btn").style.display =
    sessionIndex < sessionQuestions.length - 1 ? "none" : "none";
  document.getElementById("session-finish-btn").style.display = "none";

  const hintOutput = document.getElementById("hint-output");
  if (hintOutput) {
    hintOutput.textContent = "Натисніть кнопку, щоб отримати підказку.";
  }
}

function answerSessionQuestion(selectedOption) {
  if (sessionAnswered) return;

  const item = sessionQuestions[sessionIndex];
  const optionButtons = document.querySelectorAll("#session-options .session-option");
  sessionAnswered = true;

  optionButtons.forEach(button => {
    button.disabled = true;
    if (button.dataset.option === item.correct_option) {
      button.classList.add("correct");
    }
    if (button.dataset.option === selectedOption && selectedOption !== item.correct_option) {
      button.classList.add("wrong");
    }
  });

  if (selectedOption === item.correct_option) {
    sessionCorrectCount += 1;
  }

  if (sessionIndex < sessionQuestions.length - 1) {
    const nextBtn = document.getElementById("session-next-btn");
    nextBtn.style.display = "inline-block";
  } else {
    const finishBtn = document.getElementById("session-finish-btn");
    finishBtn.style.display = "inline-block";
  }
}

document.getElementById("session-next-btn").addEventListener("click", () => {
  sessionIndex += 1;
  renderSessionQuestion();
});

document.getElementById("session-finish-btn").addEventListener("click", finishLearningSession);

document.getElementById("session-exit-btn").addEventListener("click", () => {
  sessionQuestions = [];
  sessionPlan = [];
  showScreen("screen-dashboard");
});

async function finishLearningSession() {
  const total = sessionQuestions.length;
  if (!total) return;

  const subjectStats = {};
  const topicProgress = { ...(currentProfile.topic_progress || {}) };

  sessionQuestions.forEach((question, index) => {
    const subject = question.subject;

    if (!subjectStats[subject]) {
      subjectStats[subject] = { questions: 0, correct: 0 };
    }

    subjectStats[subject].questions += 1;

    // Правильні відповіді вже пораховані одним лічильником, тому тут
    // розподіляємо їх за фактичними відповідями через збережений стан нижче.
    // Для поточної сесії достатньо загального correct для XP; статистику
    // по предмету розраховуємо через answer results.
  });

  // Щоб не втрачати розподіл правильних відповідей по предметах, збираємо
  // результат із позначених у DOM кнопок не можна, бо попередні питання вже
  // замінені. Тому використовуємо середній варіант: загальний результат
  // записуємо в предмети пропорційно кількості питань.
  // Для точності збережемо результат кожного питання в sessionResults.
  const results = window.__bolestSessionResults || [];
  const perSubject = {};

  sessionQuestions.forEach((q, i) => {
    const subject = q.subject;
    if (!perSubject[subject]) perSubject[subject] = { questions: 0, correct: 0 };
    perSubject[subject].questions += 1;
    if (results[i] === true) perSubject[subject].correct += 1;

    const key = `${subject}:${q.topic}`;
    topicProgress[key] = (topicProgress[key] || 0) + 1;
  });

  const totalCorrect = Object.values(perSubject)
    .reduce((sum, value) => sum + value.correct, 0);

  const expGained = totalCorrect * 10;
  const newXp = (currentProfile.xp || 0) + expGained;
  const newLevel = Math.floor(newXp / 100) + 1;

  const updates = {
    xp: newXp,
    level: newLevel,
    topic_progress: topicProgress
  };

  Object.keys(perSubject).forEach(subject => {
    updates[`${subject}_questions`] =
      (currentProfile[`${subject}_questions`] || 0) + perSubject[subject].questions;
    updates[`${subject}_correct`] =
      (currentProfile[`${subject}_correct`] || 0) + perSubject[subject].correct;
  });

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
    showScreen("screen-dashboard");

    openModal(`
      <h3>Сесію завершено</h3>
      <p class="modal-hint">
        Правильних відповідей: ${totalCorrect} з ${total}.
      </p>
      <p class="modal-result">Нараховано +${expGained} exp.</p>
      <button class="modal-submit-btn" id="session-result-close" type="button">Закрити</button>
    `);

    document.getElementById("session-result-close").addEventListener("click", closeModal);
  } catch (err) {
    alert("Помилка збереження результату: " + (err.message || err));
  }
}

// Зберігаємо результат кожної відповіді, щоб правильно оновлювати
// статистику по предметах.
window.__bolestSessionResults = [];

const originalRenderSessionQuestion = renderSessionQuestion;
renderSessionQuestion = function() {
  const item = sessionQuestions[sessionIndex];

  if (sessionIndex === 0) {
    window.__bolestSessionResults = [];
  }

  originalRenderSessionQuestion();
};

const originalAnswerSessionQuestion = answerSessionQuestion;
answerSessionQuestion = function(selectedOption) {
  const item = sessionQuestions[sessionIndex];
  const correct = selectedOption === item.correct_option;

  originalAnswerSessionQuestion(selectedOption);
  window.__bolestSessionResults[sessionIndex] = correct;
};

// Підказки — використовують вже наявні hint1/hint2 поля.
document.getElementById("hint-btn").addEventListener("click", () => {
  const item = sessionQuestions[sessionIndex];
  const output = document.getElementById("hint-output");
  if (!item || !output) return;

  const hint = sessionHintStep === 0 ? item.hint1 : item.hint2;

  if (hint) {
    output.textContent = hint;
    sessionHintStep += 1;
  } else {
    output.textContent = "Для цього питання підказка не додана.";
  }
});

document.getElementById("explain-btn").addEventListener("click", () => {
  const output = document.getElementById("hint-output");
  if (!output) return;

  output.textContent =
    "Пояснення крок за кроком для цього питання ще не додано.";
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
