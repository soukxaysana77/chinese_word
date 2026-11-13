// home.js — text/language handling and bottom nav for the home screen

const homeTranslations = {
  th: {
    speechBubble: "ฝึกสมองให้สดใสทุกวัน!",
    appTitle: "เกมฝึกความจำ",
    appSubtitle: "เรียนรู้ภาษาจีน สนุก ได้สมอง",
    modesTitle: "เลือกเกม",
    modeMemory: "จำภาพ", modeMemorySub: "(Memory)",
    modeNumbers: "จำตัวเลข", modeNumbersSub: "(Numbers)",
    modeMatching: "จับคู่รูปภาพ", modeMatchingSub: "(Matching)",
    modeCharacters: "ตัวอักษร", modeCharactersSub: "(Characters)",
    modeWordOrder: "จัดเรียงคำ", modeWordOrderSub: "เรียงคำภาษาจีนให้เป็นประโยค · 5 ด่าน",
    modeListening: "จำเสียง", modeListeningSub: "(Listening)",
    navHome: "หน้าหลัก",
    navStats: "สถิติ",
    navSettings: "ตั้งค่า",
    navAdmin: "แอดมิน"
  },
  en: {
    speechBubble: "Train your brain every day!",
    appTitle: "Memory Training Game",
    appSubtitle: "Learn Chinese, have fun, train your brain",
    modesTitle: "Choose a game",
    modeMemory: "Memory", modeMemorySub: "(Images)",
    modeNumbers: "Numbers", modeNumbersSub: "(Numbers)",
    modeMatching: "Matching", modeMatchingSub: "(จับคู่)",
    modeCharacters: "Characters", modeCharactersSub: "(ตัวอักษร)",
    modeWordOrder: "Word Order", modeWordOrderSub: "Build Chinese sentences · 5 levels",
    modeListening: "Listening", modeListeningSub: "(ฟังเสียง)",
    navHome: "Home",
    navStats: "Stats",
    navSettings: "Settings",
    navAdmin: "Admin"
  }
};

// Repaints text only — doesn't touch localStorage, so it's safe to call
// from the cross-tab listener below.
function renderHomeLang(lang) {
  if (!homeTranslations[lang]) lang = "th";
  const t = homeTranslations[lang];

  Object.keys(t).forEach(function (id) {
    const el = document.getElementById(id);
    if (el) el.textContent = t[id];
  });
}

renderHomeLang(getAppLang());

// Bottom-nav Home / Settings / Admin buttons.
(function wireBottomNav() {
  const navButtons = document.querySelectorAll(".bottom-nav .nav-item");
  const destinations = ["./index.html", "./setting.html", "./admin.html"];

  navButtons.forEach(function (btn, i) {
    btn.addEventListener("click", function () {
      if (btn.classList.contains("active")) return;
      const target = destinations[i];
      if (target) window.location.href = target;
    });
  });
})();

// Another tab/page changed the language — repaint only.
window.addEventListener(APP_LANG_EVENT, function (e) {
  renderHomeLang(e.detail);
});
