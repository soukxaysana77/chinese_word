// question-store.js — where the word list comes from.
//
// Load after js/config.js and data/questions.js. Order of preference:
//   1. the list saved on the server by the admin page (Supabase)
//   2. the last server list this browser downloaded (if offline)
//   3. the built-in list in data/questions.js
// Pages wait for `questionsReady` before using allQuestions.

const QUESTIONS_CACHE_KEY = "chineseWordQuestionsCache";
const SERVER_TIMEOUT_MS = 5000;

// The list that ships with the site.
const BUILT_IN_QUESTIONS = JSON.parse(JSON.stringify(allQuestions));

const SERVER_URL = (SERVER_CONFIG.supabaseUrl || "").trim().replace(/\/+$/, "");
const SERVER_KEY = (SERVER_CONFIG.supabaseKey || "").trim();
const SERVER_ENABLED = !!(SERVER_URL && SERVER_KEY);

function isValidQuestion(q) {
  return !!q &&
    Number.isInteger(q.level) && q.level >= 1 && q.level <= 5 &&
    Array.isArray(q.answer) && q.answer.length >= 2 &&
    q.answer.every(function (w) { return typeof w === "string" && w.trim() !== ""; }) &&
    Array.isArray(q.words) && q.words.length === q.answer.length &&
    typeof q.chinese === "string" &&
    typeof q.pinyin === "string" &&
    typeof q.en === "string" &&
    typeof q.th === "string";
}

function isValidQuestionList(list) {
  return Array.isArray(list) && list.length > 0 && list.every(isValidQuestion);
}

function sameQuestions(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

// Replace the contents in place: allQuestions is a const array.
function useQuestions(list) {
  allQuestions.splice(0, allQuestions.length, ...list);
}

/* ---------- server calls (Supabase REST, no library needed) ---------- */

function serverHeaders(withJsonBody) {
  const headers = { apikey: SERVER_KEY };
  // legacy "anon" keys are JWTs and also go in Authorization;
  // the newer "publishable" keys only go in the apikey header
  if (SERVER_KEY.startsWith("eyJ")) headers.Authorization = "Bearer " + SERVER_KEY;
  if (withJsonBody) headers["Content-Type"] = "application/json";
  return headers;
}

async function serverFetch(path, options) {
  const controller = new AbortController();
  const timer = setTimeout(function () { controller.abort(); }, SERVER_TIMEOUT_MS);
  try {
    const res = await fetch(SERVER_URL + path, Object.assign({ signal: controller.signal, cache: "no-store" }, options));
    if (!res.ok) throw new Error("Server responded " + res.status);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

// { questions, updatedAt } from the server, or null if nothing saved yet.
// Throws if the server can't be reached or sends something unusable.
async function fetchServerQuestions() {
  const rows = await serverFetch("/rest/v1/game_data?id=eq.main&select=questions,updated_at", {
    headers: serverHeaders(false)
  });
  if (!Array.isArray(rows) || rows.length === 0) return null;
  if (!isValidQuestionList(rows[0].questions)) throw new Error("Server word list is not valid");
  return { questions: rows[0].questions, updatedAt: rows[0].updated_at };
}

// Calls one of the admin_* database functions. Returns its status text:
// "ok", "wrong", "locked" or "invalid". Throws on network/server errors.
async function callAdminFunction(name, args) {
  return serverFetch("/rest/v1/rpc/" + name, {
    method: "POST",
    headers: serverHeaders(true),
    body: JSON.stringify(args)
  });
}

/* ---------- local copy for when the server is unreachable ---------- */

function readCachedQuestions() {
  try {
    const list = JSON.parse(localStorage.getItem(QUESTIONS_CACHE_KEY) || "null");
    return isValidQuestionList(list) ? list : null;
  } catch (e) {
    return null;
  }
}

function writeCachedQuestions(list) {
  try { localStorage.setItem(QUESTIONS_CACHE_KEY, JSON.stringify(list)); } catch (e) {}
}

function clearCachedQuestions() {
  try { localStorage.removeItem(QUESTIONS_CACHE_KEY); } catch (e) {}
}

/* ---------- startup ---------- */

// Resolves to where the list came from: "server", "cache" or "built-in".
const questionsReady = (async function loadQuestions() {
  if (!SERVER_ENABLED) return "built-in";
  try {
    const data = await fetchServerQuestions();
    if (!data) {
      clearCachedQuestions(); // admin hasn't saved anything yet
      return "built-in";
    }
    useQuestions(data.questions);
    writeCachedQuestions(data.questions);
    return "server";
  } catch (e) {
    const cached = readCachedQuestions();
    if (cached) {
      useQuestions(cached);
      return "cache";
    }
    return "built-in";
  }
})();
