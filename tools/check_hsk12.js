// Checks tools/hsk12_sentences.json before it is merged into data/questions.js.
// Run: node tools/check_hsk12.js
//  - every HSK 1–2 word appears in at least one sentence (new or existing)
//  - no new sentence repeats an existing one
//  - extra accepted orders ("alts") use exactly the same blocks
//  - block counts fit each level
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const words = JSON.parse(fs.readFileSync(path.join(__dirname, "hsk12_words.json"), "utf8"));
const added = JSON.parse(fs.readFileSync(path.join(__dirname, "hsk12_sentences.json"), "utf8"));
const src = fs.readFileSync(path.join(root, "data", "questions.js"), "utf8");
const existing = new Function(src + "; return allQuestions;")().filter(q => !q.hsk);

const CHUNKS = { 1: [2, 3], 2: [3, 3], 3: [2, 3], 4: [4, 5], 5: [6, 7] };
const problems = [];
const sorted = (a) => a.slice().sort().join("|");

const existingTexts = new Set(existing.map(q => q.chinese));
const seen = new Set();
added.forEach((q, i) => {
  const chinese = q.answer.join("");
  const where = `#${i + 1} ${chinese}`;
  if (existingTexts.has(chinese)) problems.push(`${where}: already in the existing list`);
  if (seen.has(chinese)) problems.push(`${where}: duplicated in the new list`);
  seen.add(chinese);
  const [lo, hi] = CHUNKS[q.level] || [0, 0];
  if (q.answer.length < lo || q.answer.length > hi) problems.push(`${where}: level ${q.level} wants ${lo}-${hi} blocks, has ${q.answer.length}`);
  if (!q.pinyin || !q.th || !q.en) problems.push(`${where}: missing pinyin/th/en`);
  if (![1, 2].includes(q.hsk)) problems.push(`${where}: hsk must be 1 or 2`);
  (q.alts || []).forEach((alt) => {
    if (sorted(alt) !== sorted(q.answer)) problems.push(`${where}: alt ${alt.join(" ")} uses different blocks`);
  });
});

const allText = existing.map(q => q.chinese).concat(added.map(q => q.answer.join(""))).join("\n");
const missing = [];
["hsk1", "hsk2"].forEach((list) => {
  words[list].forEach((w) => {
    const parts = w.split("…");
    if (!parts.every(p => allText.includes(p))) missing.push(`${list}: ${w}`);
  });
});

const perLevel = {};
added.forEach(q => { perLevel[q.level] = (perLevel[q.level] || 0) + 1; });
console.log("new sentences:", added.length, "| per level:", JSON.stringify(perLevel),
  "| with extra accepted orders:", added.filter(q => q.alts).length,
  "| existing:", existing.length);
console.log("HSK words:", words.hsk1.length, "+", words.hsk2.length, "| not used anywhere:", missing.length ? missing.join(", ") : "none");
if (problems.length) console.log("PROBLEMS:\n  " + problems.join("\n  "));
else console.log("no problems");
process.exitCode = problems.length || missing.length ? 1 : 0;
