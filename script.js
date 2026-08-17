/* =====================================================================
   BOLEST.AI — ОСНОВНА ЛОГІКА
   =====================================================================
   Що тут реалізовано:
   1. Реальний вхід через Google (Google Identity Services, OAuth2 token client)
   2. Збереження акаунту й прогресу (localStorage, прив'язка до Google ID)
   3. Система рівнів з геометричною прогресією досвіду
   4. Таблиці переводу тестових балів у рейтингову шкалу (100–200)
      для трьох предметів + логіка "кращий результат / середнє арифметичне"
   ===================================================================== */

/* ---------------------------------------------------------------------
   1. НАЛАШТУВАННЯ GOOGLE-АВТОРИЗАЦІЇ
   ---------------------------------------------------------------------
   Щоб вхід через Google реально запрацював, потрібно:

   1) Зайти в Google Cloud Console -> створити проєкт
      https://console.cloud.google.com/

   2) APIs & Services -> OAuth consent screen -> налаштувати (тип External,
      додати назву застосунку Bolest.ai, свою пошту тощо).

   3) APIs & Services -> Credentials -> Create Credentials -> OAuth client ID
      -> тип застосунку "Web application".

   4) В полі "Authorized JavaScript origins" додати адресу, з якої буде
      відкриватись сайт. Наприклад, під час розробки:
         http://localhost:5500
      (запускати сайт треба через локальний сервер, а не подвійним кліком
      по файлу — Google Identity Services не працює на file://).
      Пізніше, коли сайт буде на хостингу — додати туди і реальний домен,
      наприклад https://bolest.ai

   5) Скопійований "Client ID" (виду 1234567890-xxxx.apps.googleusercontent.com)
      вставити замість рядка нижче.

   Це дає РЕАЛЬНУ автентифікацію через Google (справжній акаунт користувача,
   його ім'я, пошту, фото). Без бекенда цього достатньо, щоб при повторному
   вході в межах цього ж браузера прогрес користувача підвантажувався знову
   (дані зберігаються в localStorage і прив'язані до унікального Google ID).

   ВАЖЛИВО: якщо потрібна синхронізація ОДНОГО акаунту між РІЗНИМИ пристроями
   (наприклад, з телефону й з ноутбука) — localStorage для цього не підходить,
   бо він живе тільки в конкретному браузері. Для міжпристроєвої синхронізації
   треба зберігати userRecord не в localStorage, а в базі даних (найпростіше —
   Firebase Authentication + Firestore, вони "з коробки" дружать з Google
   Sign-In і не вимагають написання власного сервера). Структура даних нижче
   (createNewUserRecord) вже готова для того, щоб один в один піти в Firestore
   документ — коли будеш готовий, скажи, і я допоможу підключити.
   --------------------------------------------------------------------- */

const GOOGLE_CLIENT_ID = "ВАШ_CLIENT_ID.apps.googleusercontent.com"; // TODO: замінити на свій

let tokenClient = null;
let currentUser = null;

const STORAGE_USERS_KEY = "bolestUsers";        // { [googleSub]: userRecord }
const STORAGE_ACTIVE_KEY = "bolestActiveUser";  // googleSub активного користувача

/* ---------------------------------------------------------------------
   2. ТАБЛИЦІ ПЕРЕВОДУ ТЕСТОВИХ БАЛІВ У РЕЙТИНГОВУ ШКАЛУ (100–200)
   ---------------------------------------------------------------------
   Офіційної формули для цього не існує — переклад робиться виключно
   по затверджених таблицях (МОН/УЦОКО), тому нижче — таблиці "сирий бал
   -> рейтинговий бал" для кожного предмета.

   Математика: значення для балів 15, 16, 17, 30, 31 приблизні
   (орієнтовна інтерполяція) — у джерелі вони були закриті вікном чату
   на скріншоті. Якщо в тебе є точні цифри — просто заміни їх нижче.
   --------------------------------------------------------------------- */
const SCORE_TABLES = {
  math: {
    label: "Математика",
    max: 32,
    threshold: 5, // мінімум тестових балів, щоб предмет вважався зданим
    table: {
      5: 100, 6: 108, 7: 115, 8: 123, 9: 131, 10: 134, 11: 137, 12: 140,
      13: 143, 14: 145,
      15: 146, 16: 148, 17: 149, // приблизно (дані закриті на скріні)
      18: 150, 19: 151, 20: 152, 21: 155, 22: 159, 23: 163, 24: 167,
      25: 170, 26: 173, 27: 176, 28: 180, 29: 184,
      30: 189, 31: 194, // приблизно (дані закриті на скріні)
      32: 200
    }
  },
  ukrainian: {
    label: "Українська мова",
    max: 45,
    threshold: 8,
    table: {
      8: 100, 9: 105, 10: 110, 11: 120, 12: 125, 13: 130, 14: 133, 15: 136,
      16: 138, 17: 140, 18: 142, 19: 143, 20: 144, 21: 145, 22: 146, 23: 147,
      24: 148, 25: 150, 26: 152, 27: 154, 28: 155, 29: 156, 30: 157, 31: 159,
      32: 161, 33: 163, 34: 165, 35: 167, 36: 169, 37: 171, 38: 173, 39: 176,
      40: 180, 41: 184, 42: 188, 43: 192, 44: 196, 45: 200
    }
  },
  history: {
    label: "Історія України",
    max: 54,
    threshold: 9,
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

// Переводить "сирий" тестовий бал у рейтинговий (100-200) по таблиці.
// Повертає null, якщо поріг не подоланий (предмет вважається не зданим).
function convertRawToScaled(subject, rawScore) {
  const cfg = SCORE_TABLES[subject];
  if (!cfg) return null;
  if (rawScore < cfg.threshold) return null;
  const capped = Math.min(rawScore, cfg.max);
  return cfg.table[capped] ?? null;
}

/* ---------------------------------------------------------------------
   3. СИСТЕМА РІВНІВ (геометрична прогресія, коефіцієнт 2)
   ---------------------------------------------------------------------
   Рівень 1 -> 2: потрібно 100 exp
   Рівень 2 -> 3: потрібно 200 exp
   Рівень 3 -> 4: потрібно 400 exp
   Рівень 4 -> 5: потрібно 800 exp  ...і так далі (кожен наступний x2)

   За кожну правильну відповідь (у навчальній сесії чи пробному тесті)
   нараховується +10 exp.
   --------------------------------------------------------------------- */
const BASE_LEVEL_EXP = 100;
const LEVEL_GROWTH = 2;
const EXP_PER_CORRECT_ANSWER = 10;

function calcLevelInfo(totalExp) {
  let level = 1;
  let need = BASE_LEVEL_EXP;
  let remaining = totalExp;

  while (remaining >= need) {
    remaining -= need;
    level++;
    need *= LEVEL_GROWTH;
  }

  return { level, expIntoLevel: remaining, expForNextLevel: need };
}

/* ---------------------------------------------------------------------
   4. ЗБЕРЕЖЕННЯ КОРИСТУВАЧІВ
   --------------------------------------------------------------------- */
function getAllUsers() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_USERS_KEY)) || {};
  } catch {
    return {};
  }
}

function saveAllUsers(users) {
  localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(users));
}

function persistCurrentUser() {
  if (!currentUser) return;
  const users = getAllUsers();
  users[currentUser.sub] = currentUser;
  saveAllUsers(users);
}

// Прогрес нового акаунту завжди нульовий.
function createNewUserRecord(profile) {
  return {
    sub: profile.sub,
    email: profile.email || "",
    googleName: profile.name || "",
    googlePicture: profile.picture || "",
    nickname: "",
    avatar: "",
    description: "",
    exp: 0,
    level: 1,
    scores: {
      math: null,
      ukrainian: null,
      history: null
    },
    createdAt: Date.now()
  };
}

/* ---------------------------------------------------------------------
   5. ІНІЦІАЛІЗАЦІЯ GOOGLE IDENTITY SERVICES
   --------------------------------------------------------------------- */
const googleLoginBtn = document.getElementById("google-login-btn");
const authNote = document.getElementById("auth-note");

function initGoogleAuth() {
  if (typeof google === "undefined" || !google.accounts) {
    authNote.textContent = "Не вдалося завантажити Google SDK. Перевірте інтернет-з'єднання.";
    return;
  }

  if (GOOGLE_CLIENT_ID.includes("ВАШ_CLIENT_ID")) {
    authNote.textContent = "Google Client ID ще не налаштований (див. коментар на початку script.js).";
  }

  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_CLIENT_ID,
    scope: "openid email profile",
    callback: handleGoogleTokenResponse
  });
}

googleLoginBtn.addEventListener("click", () => {
  if (!tokenClient) {
    authNote.textContent = "Авторизація ще не готова. Спробуйте за кілька секунд.";
    return;
  }
  googleLoginBtn.disabled = true;
  tokenClient.requestAccessToken();
});

async function handleGoogleTokenResponse(tokenResponse) {
  googleLoginBtn.disabled = false;

  if (!tokenResponse || tokenResponse.error) {
    authNote.textContent = "Вхід через Google скасовано або сталася помилка.";
    return;
  }

  try {
    const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${tokenResponse.access_token}` }
    });
    const profile = await res.json(); // { sub, name, email, picture, ... }
    loginWithGoogleProfile(profile);
  } catch (err) {
    authNote.textContent = "Не вдалося отримати дані профілю Google.";
    console.error(err);
  }
}

function loginWithGoogleProfile(profile) {
  const users = getAllUsers();
  const existing = users[profile.sub];
  const isNewUser = !existing;

  currentUser = existing || createNewUserRecord(profile);

  if (isNewUser) {
    users[profile.sub] = currentUser;
    saveAllUsers(users);
    localStorage.setItem(STORAGE_ACTIVE_KEY, profile.sub);

    // Підставляємо дані з Google як стартові — користувач може змінити на екрані налаштувань
    nicknameInput.value = profile.name || "";
    if (profile.picture) {
      avatarImg.src = profile.picture;
      avatarImg.style.display = "block";
      avatarPlaceholder.style.display = "none";
      currentUser.avatar = profile.picture;
    }
    showScreen("screen-setup");
  } else {
    // Акаунт вже існував — прогрес (рівень, бали) підвантажується таким, яким був
    localStorage.setItem(STORAGE_ACTIVE_KEY, profile.sub);
    renderDashboard();
    showScreen("screen-dashboard");
  }
}

/* ---------------------------------------------------------------------
   6. ПЕРЕМИКАННЯ ЕКРАНІВ
   --------------------------------------------------------------------- */
function showScreen(id) {
  document.querySelectorAll(".screen").forEach(el => el.classList.remove("active"));
  document.getElementById(id).classList.add("active");
}

/* ---------------------------------------------------------------------
   7. ЕКРАН НАЛАШТУВАННЯ ПРОФІЛЮ (лише для нового акаунту)
   --------------------------------------------------------------------- */
const avatarInput = document.getElementById("avatar-input");
const avatarImg = document.getElementById("avatar-img");
const avatarPlaceholder = document.getElementById("avatar-placeholder");
const nicknameInput = document.getElementById("nickname-input");
const descriptionInput = document.getElementById("description-input");
const randomQuoteBtn = document.getElementById("random-quote-btn");
const finishSetupBtn = document.getElementById("finish-setup-btn");

// TODO: заповнити власним списком цитат, звідки скрипт буде брати випадкову
const QUOTES = [
  "Тут буде випадкова цитата 1",
  "Тут буде випадкова цитата 2",
  "Тут буде випадкова цитата 3"
];

function getRandomQuote() {
  return QUOTES[Math.floor(Math.random() * QUOTES.length)];
}

avatarInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    avatarImg.src = event.target.result;
    avatarImg.style.display = "block";
    avatarPlaceholder.style.display = "none";
    if (currentUser) currentUser.avatar = event.target.result;
  };
  reader.readAsDataURL(file);
});

randomQuoteBtn.addEventListener("click", () => {
  descriptionInput.value = getRandomQuote();
});

finishSetupBtn.addEventListener("click", () => {
  const nickname = nicknameInput.value.trim();

  if (!nickname) {
    nicknameInput.focus();
    nicknameInput.style.borderColor = "#f87171";
    return;
  }

  currentUser.nickname = nickname;
  currentUser.description = descriptionInput.value.trim();
  persistCurrentUser();

  renderDashboard();
  showScreen("screen-dashboard");
});

/* ---------------------------------------------------------------------
   8. ГОЛОВНА СТОРІНКА — РЕНДЕР ПРОГРЕСУ
   --------------------------------------------------------------------- */
const levelTitleEl = document.getElementById("level-title");
const levelPointsEl = document.getElementById("level-points");
const xpFillEl = document.getElementById("xp-fill");

function renderDashboard() {
  if (!currentUser) return;

  const { level, expIntoLevel, expForNextLevel } = calcLevelInfo(currentUser.exp);
  currentUser.level = level;

  levelTitleEl.textContent = `Рівень ${level}`;
  levelPointsEl.textContent = `${expIntoLevel}/${expForNextLevel}`;
  xpFillEl.style.width = `${Math.min(100, (expIntoLevel / expForNextLevel) * 100)}%`;

  renderSubjectRow("math");
  renderSubjectRow("ukrainian");
  renderSubjectRow("history");
}

function renderSubjectRow(subject) {
  const scoreEl = document.getElementById(`score-${subject}`);
  const rangeEl = document.getElementById(`range-${subject}`);
  const rating = currentUser.scores[subject];
  const cfg = SCORE_TABLES[subject];

  if (rating === null || rating === undefined) {
    scoreEl.textContent = "—";
    rangeEl.textContent = "Ще не складали";
  } else {
    scoreEl.textContent = rating;
    rangeEl.textContent = `Шкала: 100–200 · максимум тестових балів: ${cfg.max}`;
  }
}

/* ---------------------------------------------------------------------
   9. НАРАХУВАННЯ ДОСВІДУ ТА ОНОВЛЕННЯ БАЛІВ ЗА ПРЕДМЕТАМИ
   --------------------------------------------------------------------- */
function addExp(amount) {
  if (!currentUser) return;
  currentUser.exp += amount;
  persistCurrentUser();
  renderDashboard();
}

// Логіка оновлення балу з предмета після пробного тесту:
// - якщо новий результат ВИЩИЙ за попередній -> зберігається новий
// - якщо новий результат НИЖЧИЙ або РІВНИЙ -> зберігається середнє арифметичне
function submitPracticeTest(subject, rawScore) {
  const cfg = SCORE_TABLES[subject];
  const scaled = convertRawToScaled(subject, rawScore);

  if (scaled === null) {
    return { ok: false, message: `Поріг не подолано (мінімум ${cfg.threshold} тестових балів) — тест вважається не зданим.` };
  }

  const prev = currentUser.scores[subject];
  let updated;
  let resultType;

  if (prev === null || prev === undefined) {
    updated = scaled;
    resultType = "first";
  } else if (scaled > prev) {
    updated = scaled;
    resultType = "improved";
  } else {
    updated = Math.round((prev + scaled) / 2);
    resultType = "averaged";
  }

  currentUser.scores[subject] = updated;
  persistCurrentUser();

  // +10 exp за кожну правильну відповідь (= тестовий бал у даному предметі)
  addExp(rawScore * EXP_PER_CORRECT_ANSWER);
  renderDashboard();

  return { ok: true, resultType, scaled, updated };
}

/* ---------------------------------------------------------------------
   10. МОДАЛЬНЕ ВІКНО: "НАВЧАЛЬНА СЕСІЯ" / "ПРОБНИЙ ТЕСТ"
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

// ---- Навчальна сесія (просто нараховує exp за правильні відповіді) ----
document.getElementById("btn-session").addEventListener("click", () => {
  openModal(`
    <h3>Навчальна сесія</h3>
    <p class="modal-hint">Скільки завдань з 10 ви розв'язали правильно?</p>
    <label class="modal-field-label" for="session-correct">Правильних відповідей</label>
    <input type="number" id="session-correct" min="0" max="10" value="0">
    <button class="modal-submit-btn" id="session-submit" type="button">Завершити сесію</button>
    <div class="modal-result" id="session-result"></div>
  `);

  document.getElementById("session-submit").addEventListener("click", () => {
    const input = document.getElementById("session-correct");
    let correct = parseInt(input.value, 10);
    if (isNaN(correct)) correct = 0;
    correct = Math.max(0, Math.min(10, correct));

    addExp(correct * EXP_PER_CORRECT_ANSWER);

    document.getElementById("session-result").textContent =
      `Нараховано +${correct * EXP_PER_CORRECT_ANSWER} exp.`;
  });
});

// ---- Пробний тест (нараховує exp + оновлює бал з предмета за таблицею) ----
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

  const syncMax = () => {
    rawInput.max = SCORE_TABLES[subjectSelect.value].max;
  };
  syncMax();
  subjectSelect.addEventListener("change", syncMax);

  document.getElementById("test-submit").addEventListener("click", () => {
    const subject = subjectSelect.value;
    const cfg = SCORE_TABLES[subject];
    let raw = parseInt(rawInput.value, 10);
    if (isNaN(raw)) raw = 0;
    raw = Math.max(0, Math.min(cfg.max, raw));

    const result = submitPracticeTest(subject, raw);
    const resultEl = document.getElementById("test-result");

    if (!result.ok) {
      resultEl.textContent = result.message;
      return;
    }

    const messages = {
      first: `Перший результат з предмета "${cfg.label}": ${result.updated} балів.`,
      improved: `Новий результат вищий за попередній — оновлено до ${result.updated} балів.`,
      averaged: `Результат нижчий за попередній — збережено середнє арифметичне: ${result.updated} балів.`
    };
    resultEl.textContent = `${messages[result.resultType]} (+${raw * EXP_PER_CORRECT_ANSWER} exp)`;
  });
});

// "Лабораторія повторення" поки заглушка — логіка додається пізніше
document.getElementById("btn-review").addEventListener("click", () => {
  openModal(`
    <h3>Лабораторія повторення</h3>
    <p class="modal-hint">Цей розділ ще в розробці.</p>
  `);
});

/* ---------------------------------------------------------------------
   11. НАВІГАЦІЯ ТА ТАБИ (без змін логіки, лише UI)
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
   12. СТАРТ
   --------------------------------------------------------------------- */
window.addEventListener("DOMContentLoaded", () => {
  initGoogleAuth();

  // Якщо в цьому браузері вже є активний Google-акаунт — можна одразу
  // показати дашборд (розкоментуй, якщо потрібна така поведінка "запам'ятати мене"):
  //
  // const activeSub = localStorage.getItem(STORAGE_ACTIVE_KEY);
  // const users = getAllUsers();
  // if (activeSub && users[activeSub]) {
  //   currentUser = users[activeSub];
  //   renderDashboard();
  //   showScreen("screen-dashboard");
  // }
});
