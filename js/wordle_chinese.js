// Question list comes from data/questions.js (the global `allQuestions`
// array). That file has to be loaded before this one — see play.html.

const TOTAL_LEVELS = 5;
let questions = []; // rebuilt each playthrough, randomized within each level, levels 1 -> 5

// Each word in a sentence gets its own color so the same word looks the
// same across the sentence, the word bank, and the answer slot.
const WORD_COLORS = [
  "#d32f2f", // red
  "#1565c0", // blue
  "#2e7d32", // green
  "#d84315", // orange
  "#7b1fa2", // purple
  "#00695c", // teal
  "#c2185b"  // pink
];

let currentWordColors = []; // colors for the question currently on screen

function assignRandomColors(q) {
  const shuffled = shuffleArray(WORD_COLORS);
  currentWordColors = q.words.map((_, i) => shuffled[i % shuffled.length]);
}

function colorForWord(word, q) {
  const idx = q.words.indexOf(word);
  const safeIdx = idx === -1 ? 0 : idx;
  return currentWordColors[safeIdx] || WORD_COLORS[safeIdx % WORD_COLORS.length];
}

// Light tinted background derived from a word's color, so the button
// background matches its border/text.
function tintForColor(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const mix = (c) => Math.round(c + (255 - c) * 0.88); // 88% of the way to white
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// admin.html's "▶ ทดลอง" opens play.html?try=<sentence>: start with that
// sentence (at its level) instead of a random one. Only for the first round.
let trySentence = new URLSearchParams(location.search).get("try");

function buildQuestionOrder() {
  const order = [];
  for (let lvl = 1; lvl <= TOTAL_LEVELS; lvl++) {
    const levelQs = shuffleArray(allQuestions.filter(q => q.level === lvl));
    order.push(...levelQs);
  }
  questions = order;

  if (trySentence) {
    const i = order.findIndex(q => q.chinese === trySentence);
    if (i !== -1) {
      const first = order[i];
      questions = [first].concat(order.filter((q, k) => k !== i && q.level >= first.level));
    }
    trySentence = null;
  }
}

let currentLanguage = "th";

const translations = {
  en: {
    title: " Chinese Word Order",
    instruction: "Click the words in the correct order.",
    answer: "Click the words below...",
    clear: "↩ Clear",
    check: "✓ Check Answer",
    correct: "✅ Correct! +10 XP ⭐",
    wrong: "❌ Wrong! Try again",
    complete: "⚠️ Please select all words",
    result: "🎉 Complete!",
    resultSubtitle: "Great job! You reached Level {n} 🏅",
    scoreLabel: "Score",
    xpLabel: "XP Earned",
    heartsLabel: "Hearts Left",
    score: "Score:",
    playAgain: "🔄 Play Again",
    home: "🏠 Home",
    homeShort: "Home",
    next: "➡ Next",
    tutorialSkip: "Skip Tutorial",
    tutorialStep: "Step {n} / {total}",
    level: "Level",
    levelUp: "🎉 Level {n} unlocked!",
    tutorial: [
      { icon: "👋", title: "How to Play", text: "Arrange the Chinese words to make the correct sentence. There are 5 levels — sentences get harder as you go!", button: "Start Tutorial" },
      { icon: "🔤", title: "1. Check Pinyin", text: "Click the Pinyin in the middle. The Chinese sentence will appear for 2 seconds and you can hear the pronunciation.", button: "Next" },
      { icon: "🧩", title: "2. Arrange Words", text: "Click the words below in the correct order. Example: 你 → 好 = 你好", button: "Next" },
      { icon: "✅", title: "3. Check Answer", text: "After arranging all words, click Check Answer. A correct answer gives +10 XP ⭐.", button: "Start Game" }
    ]
  },
  th: {
    title: " เรียงคำภาษาจีน",
    instruction: "กดคำศัพท์ให้เรียงเป็นประโยคที่ถูกต้อง",
    answer: "กดคำศัพท์ด้านล่าง...",
    clear: "↩ ล้าง",
    check: "✓ ตรวจคำตอบ",
    correct: "✅ ถูกต้อง! +10 XP ⭐",
    wrong: "❌ ผิด! ลองใหม่",
    complete: "⚠️ กรุณาเลือกคำให้ครบ",
    result: "🎉 เสร็จสิ้น!",
    resultSubtitle: "คุณทำได้ดีมาก! ผ่านด่าน {n} แล้ว 🏅",
    scoreLabel: "คะแนน",
    xpLabel: "XP ที่ได้รับ",
    heartsLabel: "หัวใจที่เหลือ",
    score: "คะแนน:",
    playAgain: "🔄 เล่นอีกครั้ง",
    home: "🏠 หน้าหลัก",
    homeShort: "หน้าหลัก",
    next: "➡ ต่อไป",
    tutorialSkip: "ข้ามการสอน",
    tutorialStep: "ขั้นที่ {n} / {total}",
    level: "ด่าน",
    levelUp: "🎉 ปลดล็อกด่าน {n}!",
    tutorial: [
      { icon: "👋", title: "วิธีเล่น", text: "เรียงคำศัพท์ภาษาจีนให้เป็นประโยคที่ถูกต้อง มีทั้งหมด 5 ด่าน ยิ่งไปยิ่งยากขึ้น!", button: "เริ่มสอน" },
      { icon: "🔤", title: "1. ดู Pinyin", text: "กด Pinyin ตรงกลางหน้าจอ คำภาษาจีนจะแสดงเป็นเวลา 2 วินาที และสามารถฟังเสียงได้", button: "ต่อไป" },
      { icon: "🧩", title: "2. เรียงคำ", text: "กดคำศัพท์ด้านล่างตามลำดับที่ถูกต้อง ตัวอย่าง: 你 → 好 = 你好", button: "ต่อไป" },
      { icon: "✅", title: "3. ตรวจคำตอบ", text: "เมื่อเรียงคำครบแล้ว ให้กด ตรวจคำตอบ ถ้าถูกต้องจะได้ +10 XP ⭐", button: "เริ่มเล่น" }
    ]
  }
};

let currentQuestion = 0;
let selectedWords = [];
let hearts = 5;
let xp = 0;
let score = 0;
let answered = false;
let currentLevel = 1;
let highestLevel = 1;

let tutorialStep = 0;
let tutorialActive = true;
let tutorialWordIndex = 0;
let revealTimer = null;
let levelUpTimer = null;
let checkCount = 0; // bumps on every Check and every new question, so late sound callbacks can tell they're stale

function changeLanguage(lang) {
  currentLanguage = lang;
  setAppLang(lang); // shared key, so home/settings pick it up too
  updateLanguage();
}

function updateLanguage() {
  const t = translations[currentLanguage];
  document.getElementById("title").textContent = t.title;
  document.getElementById("instruction").textContent = t.instruction;
  document.getElementById("clearBtn").textContent = t.clear;
  document.getElementById("checkBtn").textContent = t.check;
  document.getElementById("resultTitle").textContent = t.result;
  document.getElementById("scoreLabel").textContent = t.scoreLabel;
  document.getElementById("xpLabel").textContent = t.xpLabel;
  document.getElementById("heartsLabel").textContent = t.heartsLabel;
  document.getElementById("playAgainBtn").textContent = t.playAgain;
  document.getElementById("homeBtn").textContent = t.home;
  const topHome = document.getElementById("topHomeBtn");
  document.getElementById("topHomeLabel").textContent = t.homeShort;
  topHome.title = t.homeShort;
  topHome.setAttribute("aria-label", t.homeShort);
  document.getElementById("nextBtn").textContent = t.next;
  document.getElementById("tutorialSkip").textContent = t.tutorialSkip;

  const thaiBtn = document.getElementById("thaiBtn");
  const englishBtn = document.getElementById("englishBtn");
  if (thaiBtn) thaiBtn.classList.toggle("active", currentLanguage === "th");
  if (englishBtn) englishBtn.classList.toggle("active", currentLanguage === "en");

  updateAnswerArea();
  updateLevelBadge();
  renderTutorial();

  if (document.getElementById("resultScreen").style.display === "block") {
    document.getElementById("resultSubtitle").textContent =
      t.resultSubtitle.replace("{n}", highestLevel);
  }
}

function renderLevelDots() {
  const container = document.getElementById("levelDots");
  container.innerHTML = "";
  for (let i = 1; i <= TOTAL_LEVELS; i++) {
    const dot = document.createElement("div");
    dot.className = "level-dot";
    if (i < currentLevel) dot.classList.add("done");
    if (i === currentLevel) dot.classList.add("current");
    container.appendChild(dot);
  }
}

function updateLevelBadge() {
  const t = translations[currentLanguage];
  document.getElementById("levelBadge").textContent = `🏅 ${t.level} ${currentLevel} / ${TOTAL_LEVELS}`;
  renderLevelDots();
}

function showLevelUpBanner(level) {
  const t = translations[currentLanguage];
  const banner = document.getElementById("levelUpBanner");
  banner.textContent = t.levelUp.replace("{n}", level);
  banner.style.display = "block";
  clearTimeout(levelUpTimer);
  levelUpTimer = setTimeout(() => {
    banner.style.display = "none";
  }, 1800);
}

function loadQuestion() {
  if (currentQuestion >= questions.length) {
    showResult();
    return;
  }

  answered = false;
  selectedWords = [];
  checkCount++;

  const q = questions[currentQuestion];

  if (q.level !== currentLevel) {
    currentLevel = q.level;
    if (currentLevel > highestLevel) highestLevel = currentLevel;
    updateLevelBadge();
    if (currentQuestion > 0) showLevelUpBanner(currentLevel);
  } else {
    updateLevelBadge();
  }

  const questionEl = document.getElementById("question");
  const pinyinEl = document.getElementById("pinyin");

  assignRandomColors(q);
  renderColoredQuestion(questionEl, q);
  questionEl.classList.remove("show-chinese");
  pinyinEl.textContent = q.pinyin;

  updateProgress();
  createWordButtons();
  updateAnswerArea();
  clearMessage();
  clearTranslation();
  hideNextButton();

  setTimeout(() => {
    speak(q.chinese);
  }, 500);
}

function renderColoredQuestion(questionEl, q) {
  questionEl.innerHTML = "";
  // one wrapper line, so the words wrap as text inside .question's flex column
  const line = document.createElement("div");
  line.className = "question-text";
  q.words.forEach((word, i) => {
    const span = document.createElement("span");
    span.textContent = word;
    span.style.color = colorForWord(word, q);
    if (i < q.words.length - 1) span.style.marginRight = "10px";
    span.style.display = "inline-block";
    line.appendChild(span);
  });
  questionEl.appendChild(line);
}

function createWordButtons() {
  const container = document.getElementById("words");
  container.innerHTML = "";

  const q = questions[currentQuestion];
  const shuffled = [...q.words].sort(() => Math.random() - 0.5);

  shuffled.forEach(word => {
    const button = document.createElement("button");
    button.className = "word";
    button.textContent = word;
    button.dataset.word = word;
    const c = colorForWord(word, q);
    button.style.color = c;
    button.style.background = tintForColor(c);
    button.style.borderColor = c;
    button.style.boxShadow = `0 4px 0 ${c}`;
    button.onclick = () => selectWord(button, word);
    container.appendChild(button);
  });
}

function selectWord(button, word) {
  if (answered) return;

  selectedWords.push(word);
  button.classList.add("selected");
  clearMessage(); // drop a leftover "please select all words"

  tutorialWordClicked(word);
  updateAnswerArea();
  hopBlock(document.getElementById("answerArea").lastElementChild); // jumps as it's spoken
  unlockSpeech();
  speak(word);
}

// One jump of a placed word block (CSS .word.hop); restarts if mid-jump.
function hopBlock(el) {
  if (!el) return;
  el.classList.remove("hop");
  void el.offsetWidth;
  el.classList.add("hop");
}

// The words are read with a short pause between them. Reading each word as
// its own clip left long gaps, because Chrome's online Chinese voice fetches
// every clip separately; one clip with a comma between words ("我，爱你")
// gives the same word-by-word reading with only a short natural pause.
const WORD_PAUSE = "，";

// How long the read-back takes compared with the words said alone. Starts
// as a guess and is corrected after every read-back, then remembered.
const SPEED_RATIO_KEY = "chineseWordPausedReadRatio";
let sentenceSpeedRatio = (function () {
  try {
    const saved = parseFloat(localStorage.getItem(SPEED_RATIO_KEY));
    if (saved >= 0.4 && saved <= 1.6) return saved;
  } catch (e) {}
  return 0.95;
})();

// Read the placed blocks in the player's order, word by word with a short
// pause ("wǒ, ài nǐ"), each block jumping when its own word comes up.
//   - Voices that report their position (phones, Safari, local voices):
//     jump exactly there.
//   - Others (e.g. Chrome's online voice): time it from how long each word
//     took when the player tapped it, scaled by sentenceSpeedRatio.
// onFinished runs after the reading ends.
function readPlacedSentence(thisCheck, onFinished) {
  const blocks = Array.from(document.querySelectorAll("#answerArea .answer-word"));
  const words = blocks.map(b => b.textContent);
  const firstChar = [];
  let pos = 0;
  words.forEach(function (w) { firstChar.push(pos); pos += w.length + WORD_PAUSE.length; });
  const aloneMs = words.map(w => measuredSpeechMs.get(w) || 420 * w.length);

  let lastJumped = -1;
  let gotBoundary = false;
  let started = false;
  let startedAt = 0;
  const timers = [];

  function jump(i) {
    if (thisCheck !== checkCount || i <= lastJumped) return;
    lastJumped = i;
    hopBlock(blocks[i]);
  }

  function startTimedJumps() {
    if (started) return;
    started = true;
    startedAt = performance.now();
    jump(0);
    let at = 0;
    for (let i = 1; i < blocks.length; i++) {
      at += aloneMs[i - 1] * sentenceSpeedRatio;
      const n = i;
      timers.push(setTimeout(function () { if (!gotBoundary) jump(n); }, at));
    }
  }

  // if the device never says the voice started, jump on a timer anyway
  const noStartTimer = setTimeout(startTimedJumps, 700);

  speak(words.join(WORD_PAUSE), {
    onStart: function () {
      clearTimeout(noStartTimer);
      startTimedJumps();
    },
    onBoundary: function (charIndex) {
      gotBoundary = true;
      let i = firstChar.length - 1;
      while (i > 0 && firstChar[i] > charIndex) i--;
      jump(i);
    },
    onDone: function (ok) {
      clearTimeout(noStartTimer);
      timers.forEach(clearTimeout);
      if (thisCheck !== checkCount) return; // player already moved on

      // learn this device's sentence speed for next time
      if (ok && startedAt) {
        const sumAlone = aloneMs.reduce((a, b) => a + b, 0);
        const actual = performance.now() - startedAt;
        const ratio = Math.min(1.6, Math.max(0.4, actual / sumAlone));
        sentenceSpeedRatio = 0.5 * sentenceSpeedRatio + 0.5 * ratio;
        try { localStorage.setItem(SPEED_RATIO_KEY, sentenceSpeedRatio.toFixed(3)); } catch (e) {}
      }
      onFinished();
    }
  });
}

function updateAnswerArea() {
  const area = document.getElementById("answerArea");
  area.innerHTML = "";

  if (selectedWords.length === 0) {
    area.classList.add("empty");
    area.textContent = translations[currentLanguage].answer;
    return;
  }

  area.classList.remove("empty");

  const q = questions[currentQuestion];
  selectedWords.forEach((word, index) => {
    const button = document.createElement("button");
    button.className = "word answer-word";
    button.textContent = word;
    const c = colorForWord(word, q);
    button.style.color = c;
    button.style.background = tintForColor(c);
    button.style.borderColor = c;
    button.style.boxShadow = `0 4px 0 ${c}`;
    button.onclick = () => removeWord(index);
    area.appendChild(button);
  });
}

function removeWord(index) {
  if (answered) return;

  selectedWords.splice(index, 1);
  clearMessage();
  createWordButtons();

  const used = {};
  selectedWords.forEach(word => {
    used[word] = (used[word] || 0) + 1;
  });

  document.querySelectorAll("#words .word").forEach(btn => {
    const word = btn.dataset.word;
    if (used[word] > 0) {
      btn.classList.add("selected");
      used[word]--;
    }
  });

  updateAnswerArea();
}

function checkAnswer() {
  if (answered || !questions.length) return;

  const q = questions[currentQuestion];
  const t = translations[currentLanguage];

  if (selectedWords.length !== q.answer.length) {
    showMessage(t.complete, "wrong");
    clearTranslation();
    return;
  }

  const correct = selectedWords.every((word, index) => word === q.answer[index]);
  answered = true;
  const thisCheck = ++checkCount;

  // Read the placed words back as one sentence in the player's order, each
  // block jumping with its own word, then play the right/wrong tone (so the
  // sounds don't overlap). A wrong answer stays on screen until the reading
  // has finished, then the board resets.
  unlockSpeech();
  readPlacedSentence(thisCheck, function () {
    if (correct) {
      playCorrectSound();
      // right answer: all blocks jump together once more
      document.querySelectorAll("#answerArea .answer-word").forEach(hopBlock);
      return;
    }
    playWrongSound();
    setTimeout(() => {
      if (thisCheck !== checkCount) return;
      if (hearts <= 0) {
        showResult();
        return;
      }
      answered = false;
      selectedWords = [];
      createWordButtons();
      updateAnswerArea();
      clearMessage();
    }, 900);
  });

  if (correct) {
    xp += 10;
    score++;
    showMessage(t.correct, "correct");
    showTranslation(q);
    showNextButton();
  } else {
    hearts--;
    updateHearts();
    showMessage(t.wrong, "wrong");
    clearTranslation();
  }

  updateXP();
}

function showNextButton() {
  const buttonsRow = document.getElementById("buttonsRow");
  const nextBtn = document.getElementById("nextBtn");
  if (buttonsRow) buttonsRow.style.display = "none";
  if (nextBtn) {
    nextBtn.style.display = "block";
    // long sentences don't fit on a phone screen — bring Next into view
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    nextBtn.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "nearest" });
  }
}

function hideNextButton() {
  const buttonsRow = document.getElementById("buttonsRow");
  const nextBtn = document.getElementById("nextBtn");
  if (buttonsRow) buttonsRow.style.display = "flex";
  if (nextBtn) nextBtn.style.display = "none";
}

function goToNextQuestion() {
  hideNextButton();
  currentQuestion++;
  loadQuestion();
  window.scrollTo(0, 0); // we may have scrolled down to reach Next
}

function clearAnswer() {
  if (answered || !questions.length) return;
  selectedWords = [];
  clearMessage();
  createWordButtons();
  updateAnswerArea();
}

function updateHearts() {
  document.getElementById("hearts").textContent =
    "🩷".repeat(hearts) + "🩶".repeat(5 - hearts);
}

function updateXP() {
  document.getElementById("xp").textContent = xp;
}

function updateProgress() {
  const percent = (currentQuestion / questions.length) * 100;
  document.getElementById("progress").style.width = percent + "%";
}

function clearMessage() {
  const message = document.getElementById("message");
  message.textContent = "";
  message.className = "message";
}

function showMessage(text, type) {
  const message = document.getElementById("message");
  message.textContent = text;
  // reset the class first so the animation replays even if the same
  // message type shows twice in a row
  message.className = "message";
  void message.offsetWidth;
  message.className = "message " + type;
}

function showTranslation(q) {
  const box = document.getElementById("translation");
  if (!box) return;
  // English is optional for admin-added sentences — fall back to Thai.
  const translated = currentLanguage === "th" ? q.th : (q.en || q.th);
  box.innerHTML = `${q.chinese} <span style="color:#94a3b8;">→</span> ${translated}`;
  box.style.display = "block";
}

function clearTranslation() {
  const box = document.getElementById("translation");
  if (!box) return;
  box.textContent = "";
  box.style.display = "none";
}

function revealChinese() {
  if (!questions.length) return; // word list still loading
  const question = document.getElementById("question");
  question.classList.add("show-chinese");
  speakCurrent();

  clearTimeout(revealTimer);
  revealTimer = setTimeout(() => {
    question.classList.remove("show-chinese");
  }, 2000);
}

// Sound (mascot mouth animation, TTS, correct/wrong tones) lives in
// js/audio.js, loaded before this file — see play.html.

function showResult() {
  const t = translations[currentLanguage];

  document.getElementById("gameScreen").style.display = "none";
  document.getElementById("resultScreen").style.display = "block";

  document.getElementById("resultTitle").textContent = t.result;
  document.getElementById("resultSubtitle").textContent =
    t.resultSubtitle.replace("{n}", highestLevel);
  document.getElementById("finalScore").textContent = score + " / " + questions.length;
  document.getElementById("finalXP").textContent = "+" + xp;
  document.getElementById("finalHearts").textContent = hearts;
  document.getElementById("progress").style.width = "100%";

  renderConfetti();
}

function renderConfetti() {
  const container = document.getElementById("confetti");
  if (!container) return;

  container.innerHTML = "";
  const pieces = ["🎉", "⭐", "🎊", "💛", "💙", "💚", "✨"];

  for (let i = 0; i < 22; i++) {
    const span = document.createElement("span");
    span.textContent = pieces[Math.floor(Math.random() * pieces.length)];
    span.style.left = Math.random() * 100 + "%";
    span.style.fontSize = 14 + Math.random() * 14 + "px";
    span.style.animationDelay = (Math.random() * 2.2) + "s";
    span.style.animationDuration = (2.6 + Math.random() * 1.6) + "s";
    container.appendChild(span);
  }
}

function goHome() {
  window.location.href = "./index.html";
}

function playAgain() {
  buildQuestionOrder();
  currentQuestion = 0;
  selectedWords = [];
  hearts = 5;
  xp = 0;
  score = 0;
  answered = false;
  currentLevel = 1;
  highestLevel = 1;

  updateHearts();
  updateXP();
  updateLevelBadge();
  document.getElementById("gameScreen").style.display = "block";
  document.getElementById("resultScreen").style.display = "none";
  loadQuestion();
}

function renderTutorial() {
  const t = translations[currentLanguage];
  const data = t.tutorial[tutorialStep];
  document.getElementById("tutorialIcon").textContent = data.icon;
  document.getElementById("tutorialTitle").textContent = data.title;
  document.getElementById("tutorialText").textContent = data.text;
  document.getElementById("tutorialStep").textContent = t.tutorialStep
    .replace("{n}", tutorialStep + 1)
    .replace("{total}", t.tutorial.length);
  document.getElementById("tutorialButton").textContent = data.button;
}

function clearTutorialHighlight() {
  document.querySelectorAll(".tutorial-highlight").forEach(el => {
    el.classList.remove("tutorial-highlight");
  });
  document.getElementById("tutorialOverlay").classList.remove("spotlight-mode");
}

function setTutorialHighlight(el) {
  clearTutorialHighlight();
  if (el) {
    el.classList.add("tutorial-highlight");
    document.getElementById("tutorialOverlay").classList.add("spotlight-mode");
  }
}

function highlightPinyin() {
  setTutorialHighlight(document.getElementById("pinyin"));
}

function highlightFirstCorrectWord() {
  if (!questions.length) return;
  const needed = questions[currentQuestion].answer[tutorialWordIndex];
  const buttons = document.querySelectorAll("#words .word");

  for (const btn of buttons) {
    if (btn.dataset.word === needed && !btn.classList.contains("selected")) {
      setTutorialHighlight(btn);
      break;
    }
  }
}

function tutorialNext() {
  if (tutorialStep === 0) {
    tutorialStep = 1;
    renderTutorial();
    highlightPinyin();
    return;
  }

  if (tutorialStep === 1) {
    tutorialStep = 2;
    renderTutorial();
    highlightFirstCorrectWord();
    return;
  }

  if (tutorialStep === 2) {
    tutorialStep = 3;
    renderTutorial();
    setTutorialHighlight(document.querySelector(".check"));
    return;
  }

  closeTutorial();
}

function closeTutorial() {
  tutorialActive = false;
  clearTutorialHighlight();
  document.getElementById("tutorialOverlay").style.display = "none";
}

function tutorialWordClicked(word) {
  if (!tutorialActive || tutorialStep !== 2 || !questions.length) return;

  const expected = questions[currentQuestion].answer[tutorialWordIndex];

  if (word === expected) {
    tutorialWordIndex++;

    if (tutorialWordIndex >= questions[currentQuestion].answer.length) {
      setTutorialHighlight(document.querySelector(".check"));
      tutorialStep = 3;
      renderTutorial();
    } else {
      highlightFirstCorrectWord();
    }
  }
}

// Another tab/page changed the language while this one is open — just
// repaint, setAppLang() was already called wherever the change happened.
window.addEventListener(APP_LANG_EVENT, function (e) {
  currentLanguage = e.detail;
  updateLanguage();
});

// Text first — it doesn't need the word list, so the tutorial shows in the
// right language straight away.
currentLanguage = getAppLang();
updateHearts();
updateXP();
updateLevelBadge();
renderTutorial();
updateLanguage();

// The word list may come from the server (js/question-store.js).
questionsReady.then(function () {
  const isTryRun = !!trySentence; // admin preview: skip the tutorial
  buildQuestionOrder();
  if (isTryRun) closeTutorial();
  loadQuestion();
});