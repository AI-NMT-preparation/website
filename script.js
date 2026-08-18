/* =====================================================================
   BOLEST.AI — ЛОГІКА ФРОНТЕНДУ
   =====================================================================
   Увесь реальний прогрес (рівень, exp, бали з предметів) зберігається
   на сервері, у файлі-базі db.json (див. server/server.js) — не в
   localStorage браузера. localStorage тут використовується лише для
   одного: зберегти токен входу, щоб не вводити пароль щоразу на цьому
   ж пристрої.
   ===================================================================== */

/* TODO: коли задеплоїш сервер (Render/Railway/Fly.io) — заміни адресу
   нижче на свою, наприклад "https://bolest-server.onrender.com/api" */
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

// Навчальна сесія (+10 XP за правильный ответ)
document.getElementById("btn-session").addEventListener("click", () => {
  openModal(`
    <h3>Навчальна сесія</h3>
    <p class="modal-hint">Скільки завдань з 10 ви розв'язали правильно?</p>
    <label class="modal-field-label" for="session-correct">Правильних відповідей</label>
    <input type="number" id="session-correct" min="0" max="10" value="0">
    <button class="modal-submit-btn" id="session-submit" type="button">Завершити сесію</button>
    <div class="modal-result" id="session-result"></div>
  `);

  document.getElementById("session-submit").addEventListener("click", async () => {
    const input = document.getElementById("session-correct");
    const resultEl = document.getElementById("session-result");
    let correct = parseInt(input.value, 10) || 0;
    correct = Math.max(0, Math.min(10, correct));

    const expGained = correct * 10;
    const newXp = (currentProfile.xp || 0) + expGained;
    const newLevel = Math.floor(newXp / 100) + 1;

    try {
      const { data, error } = await supabaseClient
        .from('profiles')
        .update({ xp: newXp, level: newLevel })
        .eq('id', currentUser.id)
        .select()
        .single();

      if (error) throw error;

      currentProfile = data;
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

    // Условный перевод тестовых баллов в шкалу 100-200
    const scaledScore = 100 + Math.round((raw / SUBJECTS_META[subject].max) * 100);
    const expGained = 20;

    const updates = {
      xp: (currentProfile.xp || 0) + expGained,
      level: Math.floor(((currentProfile.xp || 0) + expGained) / 100) + 1,
      [`${subject}_score`]: scaledScore
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
