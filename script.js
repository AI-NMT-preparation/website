// Конфігурація Supabase
const SUPABASE_URL = "https://YOUR_SUPABASE_PROJECT.supabase.co";
const SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_KEY";

const supabaseClient = (window.supabase && SUPABASE_URL.includes("supabase.co")) 
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) 
  : null;

// Стан застосунку
let currentUser = null;
let userProfile = null;
let currentLeaderboardFilter = "score";
let testSessions = [];

document.addEventListener("DOMContentLoaded", () => {
  initAuth();
  initNavigation();
  initSetupEvents();
  initModalEvents();
  initLeaderboardFilters();
});

/* ==================== АВТОРИЗАЦІЯ ТА ЕКРАНИ ==================== */
function switchScreen(screenId) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  const target = document.getElementById(screenId);
  if (target) target.classList.add("active");
}

async function loadUserProfile() {
  if (!currentUser) return;

  // Спроба завантажити з Supabase
  if (supabaseClient) {
    try {
      const { data, error } = await supabaseClient
        .from("profiles")
        .select("*")
        .eq("id", currentUser.id)
        .maybeSingle();

      if (!error && data) {
        userProfile = data;
        return;
      }
    } catch (e) {
      console.warn("Supabase load error:", e);
    }
  }

  // Фолбек: завантаження з localStorage
  const localData = localStorage.getItem("bolest_profile_" + currentUser.email);
  if (localData) {
    try {
      userProfile = JSON.parse(localData);
    } catch (e) {
      userProfile = null;
    }
  }
}

function initAuth() {
  const authForm = document.getElementById("auth-form");
  const authSwitchBtn = document.getElementById("auth-switch-btn");
  let isRegistering = false;

  authSwitchBtn.addEventListener("click", () => {
    isRegistering = !isRegistering;
    authSwitchBtn.textContent = isRegistering ? "Увійти" : "Зареєструватися";
    document.querySelector(".auth-subtitle").textContent = isRegistering ? "Реєстрація" : "Вхід до системи";
  });

  authForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = document.getElementById("username-input").value.trim();
    const note = document.getElementById("auth-note");

    if (!username) {
      note.textContent = "Введіть логін";
      return;
    }

    note.textContent = "";
    currentUser = { id: "user_" + username.toLowerCase(), email: username.toLowerCase() };
    
    await loadUserProfile();
    
    if (!userProfile || !userProfile.nickname) {
      switchScreen("screen-setup");
    } else {
      switchScreen("screen-dashboard");
      renderDashboard();
    }
  });
}

/* ==================== НАЛАШТУВАННЯ ПРОФІЛЮ ==================== */
function initSetupEvents() {
  const fileInput = document.getElementById("avatar-file-input");
  const previewImg = document.getElementById("avatar-preview-img");
  const placeholder = document.getElementById("avatar-placeholder");
  const saveBtn = document.getElementById("save-profile-btn");
  const aiBtn = document.getElementById("ai-gen-btn");
  let base64Avatar = "";

  fileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        base64Avatar = evt.target.result;
        previewImg.src = base64Avatar;
        previewImg.style.display = "block";
        placeholder.style.display = "none";
      };
      reader.readAsDataURL(file);
    }
  });

  aiBtn.addEventListener("click", () => {
    const descriptions = [
      "Цілеспрямований абітурієнт, що готується до складання НМТ на 190+ балів.",
      "Майбутній студент, фокусуюся на математиці та логічному мисленні.",
      "Активно проходжу тести щодня для досягнення максимумів!"
    ];
    document.getElementById("description-input").value = descriptions[Math.floor(Math.random() * descriptions.length)];
  });

  saveBtn.addEventListener("click", async () => {
    const nickname = document.getElementById("nickname-input").value.trim();
    const description = document.getElementById("description-input").value.trim();

    if (!nickname) {
      alert("Будь ласка, введіть нікнейм");
      return;
    }

    userProfile = {
      id: currentUser ? currentUser.id : "demo_user",
      email: currentUser ? currentUser.email : "demo",
      nickname: nickname,
      description: description,
      avatar: base64Avatar,
      level: 1,
      xp: 150,
      total_score: 525,
      total_tests: 0,
      total_questions: 0,
      total_correct: 0,
      streak: 1
    };

    // Збереження в localStorage
    if (currentUser) {
      localStorage.setItem("bolest_profile_" + currentUser.email, JSON.stringify(userProfile));
    }

    // Збереження в Supabase при наявності зв'язку
    if (supabaseClient) {
      try {
        await supabaseClient.from("profiles").upsert([userProfile]);
      } catch (e) {
        console.warn("Supabase save error:", e);
      }
    }

    switchScreen("screen-dashboard");
    renderDashboard();
  });
}

/* ==================== НАВІГАЦІЯ ПО ВКЛАДКАХ ==================== */
function initNavigation() {
  const navBtns = document.querySelectorAll(".nav-btn");
  navBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      navBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      const viewTarget = btn.getAttribute("data-view");
      document.querySelectorAll(".content-view").forEach(v => v.classList.remove("active"));
      const activeView = document.getElementById("view-" + viewTarget);
      if (activeView) activeView.classList.add("active");

      if (viewTarget === "leaderboard") {
        loadLeaderboard();
      }
    });
  });
}

/* ==================== ЛІДЕРБОРД ==================== */
function initLeaderboardFilters() {
  const filterBtns = document.querySelectorAll(".filter-btn");
  filterBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      filterBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      currentLeaderboardFilter = btn.getAttribute("data-filter");
      loadLeaderboard();
    });
  });
}

async function loadLeaderboard() {
  const listEl = document.getElementById("leaderboard-list");
  if (!listEl) return;

  let profilesData = [];

  if (supabaseClient) {
    try {
      const { data, error } = await supabaseClient.from("profiles").select("*");
      if (!error && data) profilesData = data;
    } catch (e) {
      console.warn(e);
    }
  }

  if (profilesData.length === 0) {
    profilesData = [
      userProfile || { nickname: "Ви", total_score: 525, total_questions: 100, total_correct: 88, streak: 5, total_tests: 12, avatar: "" },
      { nickname: "Олексій_НМТ", total_score: 570, total_questions: 200, total_correct: 184, streak: 12, total_tests: 25, avatar: "" },
      { nickname: "Марія_Smart", total_score: 540, total_questions: 150, total_correct: 130, streak: 8, total_tests: 18, avatar: "" }
    ];
  }

  profilesData = profilesData.map(p => {
    const q = p.total_questions || 0;
    const c = p.total_correct || 0;
    const acc = q > 0 ? (c / q * 100).toFixed(1) : "0.0";
    return { ...p, accuracyVal: parseFloat(acc) };
  });

  profilesData.sort((a, b) => {
    if (currentLeaderboardFilter === "score") return (b.total_score || 0) - (a.total_score || 0);
    if (currentLeaderboardFilter === "accuracy") return b.accuracyVal - a.accuracyVal;
    if (currentLeaderboardFilter === "streak") return (b.streak || 0) - (a.streak || 0);
    if (currentLeaderboardFilter === "tests") return (b.total_tests || 0) - (a.total_tests || 0);
    return 0;
  });

  renderLeaderboardList(profilesData);
}

function renderLeaderboardList(rows) {
  const listEl = document.getElementById("leaderboard-list");
  if (!listEl) return;

  let valueSuffix = "";
  let valueKey = "total_score";

  if (currentLeaderboardFilter === "score") { valueKey = "total_score"; valueSuffix = " б."; }
  if (currentLeaderboardFilter === "accuracy") { valueKey = "accuracyVal"; valueSuffix = "%"; }
  if (currentLeaderboardFilter === "streak") { valueKey = "streak"; valueSuffix = " дн."; }
  if (currentLeaderboardFilter === "tests") { valueKey = "total_tests"; valueSuffix = " т."; }

  listEl.innerHTML = rows.map((row, i) => `
    <div class="leaderboard-row">
      <span class="leaderboard-rank">${i + 1}</span>
      <span class="leaderboard-avatar">
        ${row.avatar
          ? `<img src="${row.avatar}" alt="Avatar">`
          : `<div class="avatar-placeholder-sm">${(row.nickname || "?").charAt(0).toUpperCase()}</div>`}
      </span>
      <span class="leaderboard-name">${row.nickname || "Без нікнейму"}</span>
      <span class="leaderboard-value">${row[valueKey] !== undefined ? row[valueKey] : 0}${valueSuffix}</span>
    </div>
  `).join("");
}

/* ==================== ДАШБОРД ТА МОДАЛЬНЕ ВІКНО ==================== */
function renderDashboard() {
  if (!userProfile) return;

  document.getElementById("profile-nickname-display").textContent = userProfile.nickname || "Без нікнейму";
  document.getElementById("profile-description-display").textContent = userProfile.description || "Опис відсутній";
  document.getElementById("profile-level-display").textContent = userProfile.level || 1;
  document.getElementById("profile-xp-display").textContent = userProfile.xp || 0;

  if (userProfile.avatar) {
    const profImg = document.getElementById("profile-avatar-img");
    profImg.src = userProfile.avatar;
    profImg.style.display = "block";
    document.getElementById("profile-avatar-placeholder").style.display = "none";
  }

  document.getElementById("user-level").textContent = userProfile.level || 1;
  document.getElementById("user-xp").textContent = userProfile.xp || 0;
  const xpPct = Math.min(100, Math.round(((userProfile.xp || 0) / 1000) * 100));
  document.getElementById("xp-fill").style.width = xpPct + "%";
  document.getElementById("streak-count").textContent = userProfile.streak || 0;

  updateAnalyticsTable();
}

function initModalEvents() {
  const modal = document.getElementById("modal-add-session");
  const openBtn = document.getElementById("btn-open-add-modal");
  const closeBtn = document.getElementById("modal-close-btn");
  const submitBtn = document.getElementById("modal-submit-btn");

  openBtn.addEventListener("click", () => modal.classList.add("active"));
  closeBtn.addEventListener("click", () => modal.classList.remove("active"));

  submitBtn.addEventListener("click", () => {
    const subject = document.getElementById("modal-subject-select").value;
    const correct = parseInt(document.getElementById("modal-correct-input").value) || 0;
    const total = parseInt(document.getElementById("modal-total-input").value) || 1;

    testSessions.push({ subject, correct, total, date: new Date() });

    if (userProfile) {
      userProfile.total_tests = (userProfile.total_tests || 0) + 1;
      userProfile.total_questions = (userProfile.total_questions || 0) + total;
      userProfile.total_correct = (userProfile.total_correct || 0) + correct;
      userProfile.xp = (userProfile.xp || 0) + correct * 10;

      if (currentUser) {
        localStorage.setItem("bolest_profile_" + currentUser.email, JSON.stringify(userProfile));
      }
    }

    renderDashboard();
    modal.classList.remove("active");
  });
}

function updateAnalyticsTable() {
  const tbody = document.getElementById("analytics-table-body");
  if (!tbody) return;

  const subjects = [
    { key: "math", name: "Математика" },
    { key: "ukrainian", name: "Українська мова" },
    { key: "history", name: "Історія України" }
  ];

  tbody.innerHTML = subjects.map(s => {
    const sessions = testSessions.filter(t => t.subject === s.key);
    const count = sessions.length;
    const correct = sessions.reduce((acc, curr) => acc + curr.correct, 0);
    const total = sessions.reduce((acc, curr) => acc + curr.total, 0);
    const accuracy = total > 0 ? (correct / total * 100).toFixed(1) : "0.0";

    return `
      <tr>
        <td>${s.name}</td>
        <td>${count}</td>
        <td>${correct}/${total}</td>
        <td>${accuracy}%</td>
      </tr>
    `;
  }).join("");

  const totalTests = testSessions.length;
  const totalCorrectAll = testSessions.reduce((acc, curr) => acc + curr.correct, 0);
  const totalQuestionsAll = testSessions.reduce((acc, curr) => acc + curr.total, 0);
  const globalAccuracy = totalQuestionsAll > 0 ? (totalCorrectAll / totalQuestionsAll * 100).toFixed(1) : "0.0";

  document.getElementById("stat-total-tests").textContent = totalTests;
  document.getElementById("stat-accuracy").textContent = globalAccuracy + "%";
}
