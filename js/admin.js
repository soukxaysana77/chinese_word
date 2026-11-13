// admin.js — PIN screen + word editor for admin.html.
// Needs js/config.js, data/questions.js and js/question-store.js first.
//
// Everything goes through the server (Supabase): the PIN is checked there,
// and every add / edit / delete saves the whole list there, so players get
// it the next time they open the game. See supabase/setup.sql.

const ADMIN_SESSION_KEY = "chineseWordAdminPin"; // this tab only — needed for each save
const LEVELS = [1, 2, 3, 4, 5];
const MAX_WORDS = 8; // more than this doesn't fit well as buttons on a phone

const LEVEL_INFO = {
  1: { th: "คำทักทาย · 2–3 คำ", en: "greetings (2–3 chunks)" },
  2: { th: "ประธาน + กริยา + กรรม · 3 คำ", en: "subject + verb + object (3 chunks)" },
  3: { th: "ประโยคคำถาม · 3 คำ", en: "questions (3 chunks)" },
  4: { th: "ประโยคยาวขึ้น · 4–5 คำ", en: "longer sentences (4–5 chunks)" },
  5: { th: "ประโยคซับซ้อน · 6–7 คำ", en: "complex sentences (6–7 chunks)" }
};

const $ = (id) => document.getElementById(id);
const clone = (x) => JSON.parse(JSON.stringify(x));

let adminPin = null;        // PIN the server accepted for this tab
let draft = [];             // the list as saved on the server, grouped by level 1 → 5
let serverHasList = false;  // false = server has nothing yet, showing the built-in list
let serverUpdatedAt = null;
let currentLevel = 1;
let editingIndex = -1;      // index in `draft`, or -1 for a new sentence
let busy = false;

/* ==================== messages for server answers ==================== */

const PIN_MESSAGES = {
  wrong: "รหัสไม่ถูกต้อง ลองใหม่อีกครั้ง",
  locked: "ใส่รหัสผิดหลายครั้ง ระบบล็อกไว้ 10 นาที",
  network: "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่"
};

function sessionPin(value) {
  try {
    if (value === undefined) return sessionStorage.getItem(ADMIN_SESSION_KEY);
    if (value) sessionStorage.setItem(ADMIN_SESSION_KEY, value);
    else sessionStorage.removeItem(ADMIN_SESSION_KEY);
  } catch (e) {}
  return null;
}

/* ==================== PIN screen ==================== */

function showLock(message) {
  $("adminScreen").hidden = true;
  $("lockScreen").hidden = false;
  $("pinInput").value = "";
  $("pinMsg").textContent = message || "";
  if (SERVER_ENABLED) $("pinInput").focus();
}

function showAdmin() {
  $("lockScreen").hidden = true;
  $("adminScreen").hidden = false;
  render();
}

function setLockBusy(isBusy) {
  $("pinSubmit").disabled = isBusy;
  $("pinInput").disabled = isBusy;
  $("pinSubmit").textContent = isBusy ? "กำลังตรวจสอบ…" : "เข้าสู่ระบบ";
}

function shakeLockCard() {
  const card = $("lockCard");
  card.classList.remove("shake");
  void card.offsetWidth; // restart the animation
  card.classList.add("shake");
}

// Loads the list from the server into `draft`. Returns false if it can't.
async function loadServerList() {
  try {
    const data = await fetchServerQuestions();
    if (data) {
      draft = clone(data.questions);
      serverHasList = true;
      serverUpdatedAt = data.updatedAt;
    } else {
      draft = clone(BUILT_IN_QUESTIONS);
      serverHasList = false;
      serverUpdatedAt = null;
    }
    return true;
  } catch (e) {
    return false;
  }
}

async function unlockWith(pin, fromSession) {
  setLockBusy(true);
  let result;
  try {
    result = await callAdminFunction("admin_check_pin", { p_pin: pin });
  } catch (e) {
    result = "network";
  }

  if (result === "ok" && !(await loadServerList())) result = "network";
  setLockBusy(false);

  if (result === "ok") {
    adminPin = pin;
    sessionPin(pin);
    showAdmin();
    return;
  }

  if (result !== "network") sessionPin(null);
  showLock(fromSession && result === "wrong"
    ? "กรุณาเข้าสู่ระบบอีกครั้ง"
    : (PIN_MESSAGES[result] || "เกิดข้อผิดพลาด (" + result + ")"));
  if (!fromSession) shakeLockCard();
}

$("pinForm").addEventListener("submit", function (e) {
  e.preventDefault();
  const pin = $("pinInput").value;
  if (!/^[0-9]{4,12}$/.test(pin)) {
    $("pinMsg").textContent = "กรุณาใส่รหัสเป็นตัวเลขอย่างน้อย 4 หลัก";
    shakeLockCard();
    return;
  }
  unlockWith(pin, false);
});

$("pinInput").addEventListener("input", function () {
  const input = $("pinInput");
  input.value = input.value.replace(/\D/g, "").slice(0, 12);
  $("pinMsg").textContent = "";
});

function logout(message) {
  adminPin = null;
  sessionPin(null);
  draft = [];
  if (dialog.open) dialog.close();
  showLock(message);
}

$("logoutBtn").addEventListener("click", function () { logout(); });

/* ==================== saving ==================== */

function setBusy(isBusy) {
  busy = isBusy;
  document.body.classList.toggle("is-busy", isBusy);
  $("saveBtn").disabled = isBusy;
  $("saveBtn").textContent = isBusy ? "กำลังบันทึก…" : "💾 บันทึก";
}

// Saves `next` as the whole list on the server. On success `draft`
// becomes `next`. Returns an error message, or "" if it worked.
async function saveList(next) {
  if (busy) return "กำลังบันทึกอยู่ รอสักครู่";
  setBusy(true);
  try {
    const result = await callAdminFunction("admin_save_questions", { p_pin: adminPin, p_questions: next });
    if (result === "ok") {
      draft = next;
      serverHasList = true;
      serverUpdatedAt = new Date().toISOString();
      return "";
    }
    if (result === "wrong" || result === "locked") {
      logout("รหัสแอดมินถูกเปลี่ยน กรุณาเข้าสู่ระบบใหม่");
      return "รหัสแอดมินถูกเปลี่ยน";
    }
    return "บันทึกไม่สำเร็จ (" + result + ")";
  } catch (e) {
    return "บันทึกไม่สำเร็จ — ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่";
  } finally {
    setBusy(false);
  }
}

/* ==================== list ==================== */

function render() {
  renderTabs();
  renderList();
  renderStatus();
}

function renderTabs() {
  const tabs = $("levelTabs");
  tabs.innerHTML = "";
  LEVELS.forEach(function (lvl) {
    const count = draft.filter(q => q.level === lvl).length;
    const tab = document.createElement("button");
    tab.type = "button";
    tab.className = "level-tab";
    tab.setAttribute("role", "tab");
    tab.setAttribute("aria-selected", lvl === currentLevel ? "true" : "false");

    const name = document.createElement("span");
    name.className = "lt-name";
    name.textContent = "ด่าน " + lvl;
    const num = document.createElement("span");
    num.className = "lt-count";
    num.textContent = count + " ประโยค";
    tab.append(name, num);

    tab.addEventListener("click", function () {
      currentLevel = lvl;
      render();
    });
    tabs.appendChild(tab);
  });
  $("levelHint").textContent = "ด่าน " + currentLevel + ": " + LEVEL_INFO[currentLevel].th;
}

function renderList() {
  const list = $("qList");
  list.innerHTML = "";

  const items = [];
  draft.forEach(function (q, i) { if (q.level === currentLevel) items.push({ q: q, i: i }); });

  if (items.length === 0) {
    const empty = document.createElement("li");
    empty.className = "q-empty";
    empty.textContent = "ยังไม่มีประโยคในด่านนี้ — กด “เพิ่มประโยคในด่านนี้” เพื่อเริ่ม";
    list.appendChild(empty);
    return;
  }

  items.forEach(function (item, n) {
    const q = item.q;
    const li = document.createElement("li");
    li.className = "q-item";

    const num = document.createElement("div");
    num.className = "q-num";
    num.textContent = n + 1;

    const body = document.createElement("div");
    body.className = "q-body";
    const chips = document.createElement("div");
    chips.className = "chips";
    q.answer.forEach(function (w) {
      const chip = document.createElement("span");
      chip.className = "chip";
      chip.lang = "zh-CN";
      chip.textContent = w;
      chips.appendChild(chip);
    });
    const pinyin = document.createElement("div");
    pinyin.className = "q-pinyin";
    pinyin.textContent = q.pinyin;
    const meaning = document.createElement("div");
    meaning.className = "q-meaning";
    meaning.textContent = q.en ? q.th + " · " + q.en : q.th;
    body.append(chips, pinyin, meaning);

    const actions = document.createElement("div");
    actions.className = "q-actions";
    // the game shuffles each level, so open it with this sentence first
    const tryLink = document.createElement("a");
    tryLink.className = "btn btn-secondary btn-small";
    tryLink.href = "./play.html?try=" + encodeURIComponent(q.chinese);
    tryLink.textContent = "▶ ทดลอง";
    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "btn btn-secondary btn-small";
    editBtn.textContent = "✏️ แก้ไข";
    editBtn.addEventListener("click", function () { openEditor(item.i); });
    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "btn btn-danger btn-small";
    delBtn.textContent = "🗑 ลบ";
    delBtn.addEventListener("click", function () { deleteQuestion(item.i); });
    actions.append(tryLink, editBtn, delBtn);

    li.append(num, body, actions);
    list.appendChild(li);
  });
}

function formatTime(iso) {
  try {
    return new Date(iso).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" });
  } catch (e) {
    return iso;
  }
}

function renderStatus() {
  $("status").textContent = serverHasList
    ? "🟢 เชื่อมต่อเซิร์ฟเวอร์แล้ว — บันทึกแล้วผู้เล่นทุกคนจะเห็นเมื่อเปิดเกมครั้งถัดไป" +
      (serverUpdatedAt ? " · อัปเดตล่าสุด " + formatTime(serverUpdatedAt) : "")
    : "🟢 เชื่อมต่อเซิร์ฟเวอร์แล้ว — ตอนนี้ใช้ชุดคำศัพท์เริ่มต้น การบันทึกครั้งแรกจะเก็บขึ้นเซิร์ฟเวอร์";
}

// Position for a sentence of `level` in `list`, so it stays grouped by level.
function insertIndexFor(list, level) {
  const i = list.findIndex(q => q.level > level);
  return i === -1 ? list.length : i;
}

async function deleteQuestion(index) {
  if (busy) return;
  if (draft.length <= 1) {
    toast("ต้องมีอย่างน้อย 1 ประโยคในเกม", true);
    return;
  }
  const q = draft[index];
  if (!window.confirm("ลบประโยค “" + q.chinese + "” (" + q.th + ") ใช่ไหม?")) return;
  const next = clone(draft);
  next.splice(index, 1);
  toast("กำลังบันทึก…");
  const error = await saveList(next);
  if (error) { toast(error, true); return; }
  render();
  toast("ลบแล้ว");
}

$("addBtn").addEventListener("click", function () { openEditor(-1); });

/* ==================== add / edit dialog ==================== */

const dialog = $("editDialog");

function splitWords(text) {
  // spaces (incl. the full-width 　), commas, 、 or / all separate words
  return text.split(/[\s　,，、/|]+/).map(w => w.trim()).filter(Boolean);
}

function openEditor(index) {
  if (busy) return;
  editingIndex = index;
  const q = index >= 0
    ? draft[index]
    : { level: currentLevel, answer: [], pinyin: "", th: "", en: "" };

  $("dialogTitle").textContent = index >= 0 ? "แก้ไขประโยค" : "เพิ่มประโยคใหม่";
  $("fLevel").value = String(q.level);
  $("fWords").value = q.answer.join(" ");
  $("fPinyin").value = q.pinyin;
  $("fTh").value = q.th;
  $("fEn").value = q.en;
  $("formError").textContent = "";
  updateChips();
  dialog.showModal();
  $("fWords").focus();
}

function updateChips() {
  const words = splitWords($("fWords").value);
  const box = $("wordChips");
  box.innerHTML = "";
  words.forEach(function (w, i) {
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.lang = "zh-CN";
    chip.textContent = (i + 1) + ". " + w;
    box.appendChild(chip);
  });
  if (words.length) {
    const total = document.createElement("span");
    total.className = "chip-total";
    total.textContent = "= " + words.join("") + " (" + words.length + " คำ)";
    box.appendChild(total);
  }
}

$("fWords").addEventListener("input", updateChips);
$("editForm").addEventListener("input", function () { $("formError").textContent = ""; });
$("cancelBtn").addEventListener("click", function () { if (!busy) dialog.close(); });
dialog.addEventListener("cancel", function (e) { if (busy) e.preventDefault(); }); // Esc while saving

$("editForm").addEventListener("submit", async function (e) {
  e.preventDefault();
  if (busy) return;
  const words = splitWords($("fWords").value);
  const level = Number($("fLevel").value);
  const pinyin = $("fPinyin").value.trim().replace(/\s+/g, " ");
  const th = $("fTh").value.trim();
  const en = $("fEn").value.trim();

  let error = "";
  if (words.length < 2) error = "ต้องมีคำภาษาจีนอย่างน้อย 2 คำ (เว้นวรรคระหว่างคำ)";
  else if (words.length > MAX_WORDS) error = "ใส่ได้ไม่เกิน " + MAX_WORDS + " คำ เพื่อให้ปุ่มพอดีจอ";
  else if (!pinyin) error = "กรุณาใส่พินอิน";
  else if (!th) error = "กรุณาใส่คำแปลภาษาไทย";
  if (error) {
    $("formError").textContent = error;
    return;
  }

  const q = {
    level: level,
    words: words.slice(),
    answer: words.slice(),
    chinese: words.join(""),
    pinyin: pinyin,
    en: en,
    th: th
  };

  const isEdit = editingIndex >= 0;
  const next = clone(draft);
  if (isEdit && next[editingIndex].level === level) {
    next[editingIndex] = q;
  } else {
    if (isEdit) next.splice(editingIndex, 1);
    next.splice(insertIndexFor(next, level), 0, q);
  }

  const saveError = await saveList(next);
  if (saveError) {
    if (adminPin) $("formError").textContent = saveError; // still logged in: keep the form open
    else toast(saveError, true);
    return;
  }
  currentLevel = level;
  dialog.close();
  render();
  toast(isEdit ? "บันทึกการแก้ไขแล้ว" : "เพิ่มประโยคแล้ว");
});

// Hear the sentence with the browser's Chinese voice.
$("speakBtn").addEventListener("click", function () {
  const text = splitWords($("fWords").value).join("");
  if (!text || !("speechSynthesis" in window)) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "zh-CN";
  u.rate = 0.8;
  const voice = speechSynthesis.getVoices().find(v => v.lang && v.lang.toLowerCase().startsWith("zh"));
  if (voice) u.voice = voice;
  speechSynthesis.speak(u);
});

/* ==================== tools ==================== */

$("pinChangeForm").addEventListener("submit", async function (e) {
  e.preventDefault();
  if (busy) return;
  const msg = $("pinChangeMsg");
  const newPin = $("newPin").value;
  msg.className = "form-error";
  if (!/^[0-9]{4,12}$/.test(newPin)) { msg.textContent = "รหัสใหม่ต้องเป็นตัวเลข 4–12 หลัก"; return; }
  if (newPin !== $("newPin2").value) { msg.textContent = "รหัสใหม่ทั้งสองช่องไม่ตรงกัน"; return; }

  setBusy(true);
  let result;
  try {
    result = await callAdminFunction("admin_change_pin", { p_pin: adminPin, p_new_pin: newPin });
  } catch (err) {
    result = "network";
  }
  setBusy(false);

  if (result === "ok") {
    adminPin = newPin;
    sessionPin(newPin);
    $("newPin").value = "";
    $("newPin2").value = "";
    msg.className = "form-ok";
    msg.textContent = "เปลี่ยนรหัสแล้ว — ครั้งหน้าใช้รหัสใหม่";
  } else if (result === "wrong" || result === "locked") {
    logout("รหัสแอดมินถูกเปลี่ยน กรุณาเข้าสู่ระบบใหม่");
  } else {
    msg.textContent = result === "network" ? PIN_MESSAGES.network : "เปลี่ยนรหัสไม่สำเร็จ (" + result + ")";
  }
});

$("newPin").addEventListener("input", function () { this.value = this.value.replace(/\D/g, ""); $("pinChangeMsg").textContent = ""; });
$("newPin2").addEventListener("input", function () { this.value = this.value.replace(/\D/g, ""); $("pinChangeMsg").textContent = ""; });

function buildQuestionsFile(list) {
  const str = JSON.stringify; // escapes quotes; keeps Thai/Chinese as-is
  const arr = (a) => "[" + a.map(w => str(w)).join(", ") + "]";
  const date = new Date().toISOString().slice(0, 10);

  const entries = [];
  LEVELS.forEach(function (lvl) {
    const items = list.filter(q => q.level === lvl);
    if (!items.length) return;
    entries.push({ comment: "  /* ---------- LEVEL " + lvl + ": " + LEVEL_INFO[lvl].en + " ---------- */" });
    items.forEach(function (q) {
      entries.push({
        line: "  { level: " + q.level +
          ", words: " + arr(q.words) +
          ", answer: " + arr(q.answer) +
          ", chinese: " + str(q.chinese) +
          ", pinyin: " + str(q.pinyin) +
          ", en: " + str(q.en) +
          ", th: " + str(q.th) + " }"
      });
    });
  });

  const lastLine = entries.map(e => !!e.line).lastIndexOf(true);
  const out = [
    "// Question list for the Chinese Word Order game.",
    "// Backup from the admin page (admin.html) on " + date + ".",
    "// Each entry: level 1–5, the words in the correct order (the game",
    "// shuffles them), the full sentence, pinyin, and the English/Thai meaning.",
    "",
    "const allQuestions = ["
  ];
  entries.forEach(function (e, i) {
    if (e.comment) out.push("", e.comment);
    else out.push(e.line + (i === lastLine ? "" : ","));
  });
  out.push("", "];", "");
  return out.join("\n");
}

$("downloadBtn").addEventListener("click", function () {
  const blob = new Blob([buildQuestionsFile(draft)], { type: "text/javascript;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "questions.js";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  toast("ดาวน์โหลดไฟล์สำรองแล้ว");
});

$("resetBtn").addEventListener("click", async function () {
  if (busy) return;
  if (!window.confirm("แทนที่คำศัพท์ทั้งหมดด้วยชุดเริ่มต้น (" + BUILT_IN_QUESTIONS.length + " ประโยค)?\nประโยคที่เพิ่มหรือแก้ไขไว้จะหายทั้งหมด")) return;
  toast("กำลังบันทึก…");
  const error = await saveList(clone(BUILT_IN_QUESTIONS));
  if (error) { toast(error, true); return; }
  render();
  toast("คืนค่าชุดเริ่มต้นแล้ว");
});

$("builtInCount").textContent = BUILT_IN_QUESTIONS.length;

/* ==================== toast ==================== */

let toastTimer = null;
function toast(message, isError) {
  const el = $("toast");
  el.textContent = message;
  el.className = "toast show" + (isError ? " toast-error" : "");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () { el.className = "toast"; }, 2800);
}

/* ==================== start ==================== */

if (!SERVER_ENABLED) {
  $("serverWarning").hidden = false;
  $("pinInput").disabled = true;
  $("pinSubmit").disabled = true;
  showLock();
} else if (sessionPin()) {
  unlockWith(sessionPin(), true);
} else {
  showLock();
}
