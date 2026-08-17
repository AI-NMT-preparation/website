// ==================== ДАНІ КОРИСТУВАЧА (тимчасово в localStorage) ====================
const userData = {
  nickname: "",
  avatar: "",
  description: ""
};

// ==================== СПИСОК ЦИТАТ ====================
// TODO: заповнити власним списком цитат, звідки скрипт буде брати випадкову
const QUOTES = [
  "Тут буде випадкова цитата 1",
  "Тут буде випадкова цитата 2",
  "Тут буде випадкова цитата 3"
];

function getRandomQuote() {
  const index = Math.floor(Math.random() * QUOTES.length);
  return QUOTES[index];
}

// ==================== ПЕРЕМИКАННЯ ЕКРАНІВ ====================
function showScreen(id) {
  document.querySelectorAll(".screen").forEach(el => el.classList.remove("active"));
  document.getElementById(id).classList.add("active");
}

// ==================== ЕКРАН 1: ВХІД ЧЕРЕЗ GOOGLE ====================
const googleLoginBtn = document.getElementById("google-login-btn");

googleLoginBtn.addEventListener("click", () => {
  // TODO: тут має бути реальна авторизація через Google OAuth (наприклад Firebase Auth / Google Identity Services)
  // Після успішного входу викликати showScreen("screen-setup")
  showScreen("screen-setup");
});

// ==================== ЕКРАН 2: НАЛАШТУВАННЯ ПРОФІЛЮ ====================
const avatarInput = document.getElementById("avatar-input");
const avatarImg = document.getElementById("avatar-img");
const avatarPlaceholder = document.getElementById("avatar-placeholder");
const nicknameInput = document.getElementById("nickname-input");
const descriptionInput = document.getElementById("description-input");
const randomQuoteBtn = document.getElementById("random-quote-btn");
const finishSetupBtn = document.getElementById("finish-setup-btn");

avatarInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    avatarImg.src = event.target.result;
    avatarImg.style.display = "block";
    avatarPlaceholder.style.display = "none";
    userData.avatar = event.target.result;
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

  userData.nickname = nickname;
  userData.description = descriptionInput.value.trim();

  localStorage.setItem("bolestUser", JSON.stringify(userData));

  showScreen("screen-dashboard");
});

// ==================== ЕКРАН 3: ГОЛОВНА СТОРІНКА ====================

// Перемикання активного пункту навігації
document.querySelectorAll(".nav-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
  });
});

// Перемикання табів "Сьогодні" / "За весь час"
document.querySelectorAll(".tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
  });
});

// ==================== АНІМАЦІЯ ЗАЛИВКИ ХІТБОКСУ (зліва направо) ====================
// Основна анімація вже реалізована через CSS (::before, width 0 -> 100%).
// Тут додатково скидаємо стан заливки при виході курсора, щоб анімація
// завжди починалась заново зліва при повторному наведенні.
function setupHoverFillReset(selector) {
  document.querySelectorAll(selector).forEach(el => {
    el.addEventListener("mouseleave", () => {
      el.style.setProperty("--reset", "0");
      void el.offsetWidth; // форсуємо reflow, щоб анімація перезапустилась
    });
  });
}

setupHoverFillReset(".nav-btn");
setupHoverFillReset(".action-btn");

// ==================== АВТО-ЗАВАНТАЖЕННЯ ЗБЕРЕЖЕНОГО ПРОФІЛЮ ====================
window.addEventListener("DOMContentLoaded", () => {
  const saved = localStorage.getItem("bolestUser");
  if (saved) {
    const data = JSON.parse(saved);
    Object.assign(userData, data);
    // Якщо профіль вже налаштовано раніше — одразу відкриваємо головну сторінку
    // (розкоментуй рядок нижче, якщо потрібна така поведінка)
    // showScreen("screen-dashboard");
  }
});
