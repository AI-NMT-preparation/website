/* =====================================================================
   BOLEST.AI — МНОГОСТРАНИЧНЫЙ СКРИПТ С СОХРАНЕНИЕМ
   ===================================================================== */
const SUPABASE_URL = 'https://envhnssxtxcoxazfblfg.supabase.co';
const SUPABASE_KEY = 'sb_publishable_G1U5Iy7GZQaAIM8Uoah-4g_2-A2xDoX'; 
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentUser = null; 
let currentProfile = null;
let authMode = "login";

// Добавьте обработчики для кнопок подсказок
const btnHint1 = document.getElementById("btn-hint-1");
if (btnHint1) {
  btnHint1.onclick = () => {
    const q = sessionState.questions[sessionState.currentIndex];
    const aiBox = document.getElementById("ai-messages-area");
    if (q && q.hint_1 && aiBox) {
      aiBox.innerHTML += `<p class="ai-msg">💡 <b>Підказка 1:</b> ${q.hint_1}</p>`;
    }
  };
}

if (res.data.user) {
  window.location.href = "dashboard.html";
}

const btnExplain = document.getElementById("btn-ai-explain");
if (btnExplain) {
  btnExplain.onclick = () => {
    const q = sessionState.questions[sessionState.currentIndex];
    const aiBox = document.getElementById("ai-messages-area");
    if (q && q.explanation && aiBox) {
      aiBox.innerHTML += `<p class="ai-msg">🤖 <b>Пояснення:</b> ${q.explanation}</p>`;
    }
  };
}
const btnSaveProfile = document.getElementById("btn-save-initial-setup");
if (btnSaveProfile) {
  btnSaveProfile.addEventListener("click", async () => {
    if (!currentUser) return;
    
    const newProfile = {
      id: currentUser.id,
      xp: 0,
      level: 1,
      math_score: 100,
      ukrainian_score: 100,
      history_score: 100,
      topics_progress: {}
    };

    const { error } = await supabaseClient.from('profiles').insert([newProfile]);
    if (error) {
      console.error("Ошибка создания профиля:", error);
      alert("Не удалось сохранить профиль");
    } else {
      currentProfile = newProfile;
      window.location.href = "dashboard.html";
    }
  });
}

const tabLogin = document.getElementById("tab-login");
const tabRegister = document.getElementById("tab-register");

if (tabLogin && tabRegister) {
  tabLogin.onclick = () => { authMode = "login"; tabLogin.classList.add("active"); tabRegister.classList.remove("active"); };
  tabRegister.onclick = () => { authMode = "register"; tabRegister.classList.add("active"); tabLogin.classList.remove("active"); };
}
const SUBJECTS_META = {
  math: { label: "Математика", max: 32 },
  ukrainian: { label: "Українська мова", max: 45 },
  history: { label: "Історія України", max: 54 }
};

const NMT_TOPICS = {
  math: ["Числа і вирази", "Рівняння та нерівності", "Функції", "Елементи комбінаторики та ймовірність", "Планіметрія", "Стереометрія"],
  ukrainian: ["Фонетика, графіка, орфоепія", "Лексикологія і фразеологія", "Будова слова і словотвір", "Морфологія", "Синтаксис", "Стилістика", "Розвиток мовлення"],
  history: ["Русь-Україна", "Українські землі у 16 ст.", "Козацька Україна", "Українські землі у 19 ст.", "Україна у 20 ст.", "Незалежна Україна"]
};

let sessionState = { mode: "", questions: [], currentIndex: 0, currentSubject: "", selectedTopicsCounts: {}, hintClicks: 0, wrongClicks: 0, firstTry: true, correctStats: 0 };

function showScreen(id) {
  const target = document.getElementById(id);
  if (!target) return;
  document.querySelectorAll(".screen").forEach(el => el.classList.remove("active"));
  target.classList.add("active");
}

// --- АВТОРИЗАЦИЯ И ИНИЦИАЛИЗАЦИЯ ---
async function checkAndLoadProfile() {
  if (!currentUser) return;
  const { data: profile, error } = await supabaseClient.from('profiles').select('*').eq('id', currentUser.id).maybeSingle();
  
  if (error) {
    console.error("Помилка завантаження профілю:", error);
    return;
  }

  if (profile) { 
    currentProfile = profile; 
    if (document.getElementById("screen-dashboard")) {
      renderDashboard(); 
      showScreen("screen-dashboard"); 
    } else if (document.getElementById("screen-session-setup")) {
      initSessionPage();
    }
  } else { 
    if (document.getElementById("screen-setup")) {
      showScreen("screen-setup"); 
    }
  }
}

// --- ДАШБОРД ---
function renderDashboard() {
  if (!currentProfile) return;
  const totalXp = currentProfile.xp || 0;
  const level = Math.floor(totalXp / 100) + 1;
  
  const levelTitle = document.getElementById("level-title");
  if (levelTitle) levelTitle.textContent = `Рівень ${level}`;
  
  const levelPoints = document.getElementById("level-points");
  if (levelPoints) levelPoints.textContent = `${totalXp % 100}/100`;
  
  const xpFill = document.getElementById("xp-fill");
  if (xpFill) xpFill.style.width = `${Math.min(100, (totalXp % 100))}%`;

  let totalQ = 0, totalCorrect = 0;
  ["math", "ukrainian", "history"].forEach(subj => {
    totalQ += (currentProfile[`${subj}_questions`] || 0);
    totalCorrect += (currentProfile[`${subj}_correct`] || 0);
  });

  const statQ = document.getElementById("stat-total-q");
  if (statQ) statQ.textContent = totalQ;

  const statAcc = document.getElementById("stat-total-acc");
  if (statAcc) statAcc.textContent = totalQ > 0 ? Math.round((totalCorrect/totalQ)*100) + "%" : "0%";

  renderPrioritiesList();
}

function renderPrioritiesList() {
  const container = document.getElementById("priorities-list-container");
  if (!container) return;
  container.innerHTML = "";
  const progress = currentProfile.topics_progress || {};

  Object.keys(NMT_TOPICS).forEach(subject => {
    NMT_TOPICS[subject].forEach(topic => {
      const solved = progress[topic] || 0;
      let colorClass = subject === "math" ? "topic-pink" : subject === "ukrainian" ? "topic-yellow" : "topic-green";

      container.innerHTML += `
        <div class="session-item">
          <div class="session-label">${SUBJECTS_META[subject].label}</div>
          <div class="session-topic ${colorClass}">${topic}</div>
          <div class="session-progress">(вирішено: ${solved})</div>
        </div>
      `;
    });
  });
}

// --- ЛОГИКА СЕССИИ / ТЕСТА ---
function initSessionPage() {
  const urlParams = new URLSearchParams(window.location.search);
  const mode = urlParams.get('mode') || 'session';
  sessionState.mode = mode;

  showScreen("screen-session-setup");
  
  const title = document.getElementById("setup-wizard-title");
  const step1 = document.getElementById("setup-step-1");
  const step2 = document.getElementById("setup-step-2");
  const container = document.getElementById("topics-selection-container");
  
  if (!container) return;
  step1.classList.add("active");
  step2.classList.remove("active");
  container.innerHTML = "";

  if (mode === "session") {
    if (title) title.textContent = "Що будемо практикувати?";
    Object.keys(NMT_TOPICS).forEach(subj => {
      let html = `<div class="subject-group"><div class="subject-group-title">${SUBJECTS_META[subj].label}</div>`;
      NMT_TOPICS[subj].forEach(topic => {
        html += `<label class="topic-checkbox-label"><input type="checkbox" class="topic-cb" data-subj="${subj}" value="${topic}"> ${topic}</label>`;
      });
      html += `</div>`;
      container.innerHTML += html;
    });
  } else {
    if (title) title.textContent = "Пробний тест (Обери 1 предмет)";
    Object.keys(SUBJECTS_META).forEach(subj => {
      container.innerHTML += `<label class="topic-checkbox-label" style="font-size: 16px; margin-bottom: 10px;"><input type="radio" name="mock-subj" value="${subj}"> ${SUBJECTS_META[subj].label}</label>`;
    });
  }
}

// Переход по шагам настройки
const btnNext1 = document.getElementById("setup-btn-next-1");
if (btnNext1) {
  btnNext1.addEventListener("click", async () => {
    if (sessionState.mode === "session") {
      const checked = Array.from(document.querySelectorAll('.topic-cb:checked'));
      if (checked.length === 0) return alert("Обери хоча б одну тему!");
      
      const sliderContainer = document.getElementById("sliders-container");
      sliderContainer.innerHTML = "";
      checked.forEach(cb => {
        sliderContainer.innerHTML += `
          <div class="slider-row">
            <div class="slider-header"><span>${cb.value}</span> <span class="slider-val" id="val-${cb.value}">5</span></div>
            <input type="range" class="range-slider count-slider" data-topic="${cb.value}" data-subj="${cb.dataset.subj}" min="1" max="10" value="5" oninput="document.getElementById('val-${cb.value}').textContent = this.value">
          </div>`;
      });
      document.getElementById("setup-step-1").classList.remove("active");
      document.getElementById("setup-step-2").classList.add("active");
    } else {
      const selectedRadio = document.querySelector('input[name="mock-subj"]:checked');
      if(!selectedRadio) return alert("Обери предмет!");
      sessionState.currentSubject = selectedRadio.value;
      await fetchQuestionsFromDB(sessionState.currentSubject, 20);
      startMockTest();
    }
  });
}

const btnBack1 = document.getElementById("setup-btn-back-1");
if (btnBack1) {
  btnBack1.addEventListener("click", () => {
    document.getElementById("setup-step-2").classList.remove("active");
    document.getElementById("setup-step-1").classList.add("active");
  });
}

const btnStart = document.getElementById("setup-btn-start");
if (btnStart) {
  btnStart.addEventListener("click", async () => {
    const sliders = document.querySelectorAll('.count-slider');
    sessionState.selectedTopicsCounts = {};
    sliders.forEach(s => { sessionState.selectedTopicsCounts[s.dataset.topic] = { count: parseInt(s.value), subj: s.dataset.subj }; });
    
    await fetchSessionQuestions();
    startActiveSession();
  });
}

// Загрузка вопросов из базы
async function fetchSessionQuestions() {
  sessionState.questions = [];
  for (const [topic, info] of Object.entries(sessionState.selectedTopicsCounts)) {
    const { data } = await supabaseClient.from('questions').select('*').eq('topic', topic).limit(info.count);
    if (!data || data.length === 0) {
      for(let i = 0; i < info.count; i++) {
        sessionState.questions.push({
          topic: topic, subject: info.subj, question_text: `Питання по темі: ${topic} #${i+1}`,
          options: ["Варіант А", "Варіант Б", "Варіант В", "Варіант Г"], correct_index: Math.floor(Math.random()*4),
          hint_1: "Підказка 1", hint_2: "Підказка 2", explanation: "Пояснення розв'язку..."
        });
      }
    } else { sessionState.questions.push(...data); }
  }
}

async function fetchQuestionsFromDB(subj, limit) {
  const { data } = await supabaseClient.from('questions').select('*').eq('subject', subj).limit(limit);
  if (!data || data.length === 0) {
    sessionState.questions = Array.from({length: limit}, (_, i) => ({
      subject: subj, topic: "Загальна", question_text: `Тестове питання #${i+1} з ${SUBJECTS_META[subj].label}`,
      options: ["А", "Б", "В", "Г"], correct_index: 0
    }));
  } else { sessionState.questions = data; }
}

// Активная сессия
function startActiveSession() {
  sessionState.currentIndex = 0;
  sessionState.correctStats = 0;
  showScreen("screen-active-session");
  renderSessionQuestion();
}

function renderSessionQuestion() {
  const q = sessionState.questions[sessionState.currentIndex];
  document.getElementById("session-progress-text").textContent = `${sessionState.currentIndex + 1} / ${sessionState.questions.length}`;
  document.getElementById("session-q-text").textContent = q.question_text;
  document.getElementById("ai-messages-area").innerHTML = '<p class="system-msg">Використовуй підказки, якщо застряг.</p>';
  document.getElementById("btn-session-next").style.display = "none";
  
  sessionState.hintClicks = 0;
  sessionState.wrongClicks = 0;
  sessionState.firstTry = true;

  const optionsContainer = document.getElementById("session-options");
  optionsContainer.innerHTML = "";
  const labels = ["А", "Б", "В", "Г"];
  
  q.options.forEach((optText, index) => {
    const btn = document.createElement("button");
    btn.className = "option-btn";
    btn.innerHTML = `<span class="option-label">${labels[index]}</span> ${optText}`;
    btn.onclick = () => handleSessionAnswerClick(btn, index, q.correct_index, q.topic, q.subject);
    optionsContainer.appendChild(btn);
  });
}

function handleSessionAnswerClick(btn, selectedIdx, correctIdx, topic, subj) {
  if (btn.classList.contains("locked")) return;
  const allBtns = document.querySelectorAll("#session-options .option-btn");
  
  if (selectedIdx === correctIdx) {
    btn.classList.add("correct");
    allBtns.forEach(b => b.classList.add("locked"));
    document.getElementById("btn-session-next").style.display = "inline-block";
    
    if (sessionState.firstTry) {
      sessionState.correctStats++;
      updateTopicProgress(topic, 1);
      updateSubjectStats(subj, 1, 1);
    } else {
      updateSubjectStats(subj, 1, 0);
    }
  } else {
    btn.classList.add("wrong", "locked");
    if (sessionState.firstTry) sessionState.firstTry = false;
    sessionState.wrongClicks++;
    
    if (sessionState.wrongClicks >= 3) {
      allBtns[correctIdx].classList.add("correct");
      allBtns.forEach(b => b.classList.add("locked"));
      document.getElementById("btn-session-next").style.display = "inline-block";
      updateSubjectStats(subj, 1, 0);
    }
  }
}

const btnNextQ = document.getElementById("btn-session-next");
if (btnNextQ) {
  btnNextQ.onclick = () => {
    if (sessionState.currentIndex + 1 < sessionState.questions.length) {
      sessionState.currentIndex++;
      renderSessionQuestion();
    } else { finishSession(); }
  };
}

// Пробный тест
function startMockTest() {
  sessionState.currentIndex = 0;
  showScreen("screen-mock-test");
  
  const selector = document.getElementById("mock-question-selector");
  selector.innerHTML = "";
  sessionState.questions.forEach((_, i) => { selector.innerHTML += `<option value="${i}">Питання ${i+1}</option>`; });
  
  selector.onchange = (e) => { sessionState.currentIndex = parseInt(e.target.value); renderMockQuestion(); };
  renderMockQuestion();
}

function renderMockQuestion() {
  const q = sessionState.questions[sessionState.currentIndex];
  document.getElementById("mock-question-selector").value = sessionState.currentIndex;
  document.getElementById("mock-q-text").textContent = q.question_text;
  
  const optionsContainer = document.getElementById("mock-options");
  optionsContainer.innerHTML = "";
  const labels = ["А", "Б", "В", "Г"];
  
  q.options.forEach((optText, index) => {
    const btn = document.createElement("button");
    btn.className = "option-btn";
    if (q.userAnswer === index) btn.style.borderColor = "var(--accent)";
    
    btn.innerHTML = `<span class="option-label">${labels[index]}</span> ${optText}`;
    btn.onclick = () => {
      document.querySelectorAll("#mock-options .option-btn").forEach(b => b.style.borderColor = "");
      btn.style.borderColor = "var(--accent)";
      q.userAnswer = index;
    };
    optionsContainer.appendChild(btn);
  });
}

const btnMockNext = document.getElementById("btn-mock-next");
if (btnMockNext) {
  btnMockNext.onclick = () => {
    if (sessionState.currentIndex + 1 < sessionState.questions.length) {
      sessionState.currentIndex++;
      renderMockQuestion();
    } else { finishTest(); }
  };
}

// --- СОХРАНЕНИЕ В SUPABASE (С ВЫВОДОМ ОШИБОК) ---
async function updateTopicProgress(topic, amount) {
  if (!currentProfile || !currentUser) return;
  const progress = currentProfile.topics_progress || {};
  progress[topic] = (progress[topic] || 0) + amount;
  currentProfile.topics_progress = progress;
  
  const { error } = await supabaseClient.from('profiles').update({ topics_progress: progress }).eq('id', currentUser.id);
  if (error) console.error("Помилка збереження прогресу тем:", error);
}

async function updateSubjectStats(subject, qAdded, correctAdded) {
  if (!currentProfile || !currentUser) return;
  const updates = {
    xp: (currentProfile.xp || 0) + (correctAdded * 10),
    level: Math.floor(((currentProfile.xp || 0) + (correctAdded * 10)) / 100) + 1,
    [`${subject}_questions`]: (currentProfile[`${subject}_questions`] || 0) + qAdded,
    [`${subject}_correct`]: (currentProfile[`${subject}_correct`] || 0) + correctAdded
  };
  
  Object.assign(currentProfile, updates);
  const { error } = await supabaseClient.from('profiles').update(updates).eq('id', currentUser.id);
  if (error) console.error("Помилка збереження статистики предмета:", error);
}

function finishSession() {
  alert(`Сесію завершено! Правильних відповідей: ${sessionState.correctStats} з ${sessionState.questions.length}.`);
  window.location.href = "dashboard.html";
}

async function finishTest() {
  if (!currentProfile || !currentUser) return;
  let correctAnswers = 0;
  sessionState.questions.forEach(q => { if(q.userAnswer === q.correct_index) correctAnswers++; });
  
  const subj = sessionState.currentSubject;
  const scaledScore = 100 + Math.round((correctAnswers / sessionState.questions.length) * 100);
  const newHistory = [...(currentProfile[`${subj}_history`] || []), scaledScore];
  
  const updates = {
    [`${subj}_score`]: scaledScore,
    [`${subj}_history`]: newHistory,
    xp: (currentProfile.xp || 0) + 50
  };

  const { error } = await supabaseClient.from('profiles').update(updates).eq('id', currentUser.id);
  if (error) {
    console.error("Помилка збереження тесту:", error);
  } else {
    alert(`Тест завершено! Ваш бал: ${scaledScore}.`);
  }
  
  window.location.href = "dashboard.html";
}

// Авторизация
const authSubmitBtn = document.getElementById("auth-submit-btn");
if (authSubmitBtn) {
  authSubmitBtn.addEventListener("click", async () => {
    const email = document.getElementById("email-input").value.trim();
    const password = document.getElementById("password-input").value;
    if (!email || !password) return;
    
    try {
      let res = authMode === "login" 
        ? await supabaseClient.auth.signInWithPassword({ email, password })
        : await supabaseClient.auth.signUp({ email, password });
      if (res.error) throw res.error;
      currentUser = res.data.user;
      await checkAndLoadProfile();
    } catch (err) { 
      document.getElementById("auth-note").textContent = err.message; 
    }
  });
}

window.addEventListener("DOMContentLoaded", async () => {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session && session.user) { 
    currentUser = session.user; 
    await checkAndLoadProfile(); 
  }
});
