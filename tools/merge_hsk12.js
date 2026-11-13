// Rebuilds data/questions.js = the original sentences + tools/hsk12_sentences.json.
// Safe to run again: sentences tagged with "hsk" are replaced, the rest kept.
// Run: node tools/merge_hsk12.js
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const file = path.join(root, "data", "questions.js");
const src = fs.readFileSync(file, "utf8");
const original = new Function(src + "; return allQuestions;")().filter(q => !q.hsk);
const added = JSON.parse(fs.readFileSync(path.join(__dirname, "hsk12_sentences.json"), "utf8"))
  .map(q => {
    const out = {
      level: q.level,
      words: q.answer.slice(),
      answer: q.answer.slice(),
      chinese: q.answer.join(""),
      pinyin: q.pinyin,
      en: q.en,
      th: q.th,
      hsk: q.hsk
    };
    if (q.alts) out.alts = q.alts;
    return out;
  });

const LEVEL_INFO = {
  1: "greetings and short sentences (2–3 chunks)",
  2: "subject + verb + object (3 chunks)",
  3: "questions (2–3 chunks)",
  4: "longer sentences (4–5 chunks)",
  5: "complex sentences (6–7 chunks)"
};

const str = JSON.stringify;
const arr = (a) => "[" + a.map(w => str(w)).join(", ") + "]";
function line(q) {
  let s = "  { level: " + q.level +
    ", words: " + arr(q.words) +
    ", answer: " + arr(q.answer) +
    ", chinese: " + str(q.chinese) +
    ", pinyin: " + str(q.pinyin) +
    ", en: " + str(q.en) +
    ", th: " + str(q.th);
  if (q.hsk) s += ", hsk: " + q.hsk;
  if (q.alts) s += ", alts: [" + q.alts.map(arr).join(", ") + "]";
  return s + " }";
}

const all = [];
const out = [
  "// Built-in question list for the Chinese Word Order game. The game uses the",
  "// list saved on the server by the admin page when there is one; this file is",
  "// the starting set and the fallback when the server can't be reached.",
  "//",
  "// Each entry: level 1–5, the words in the correct order (the game shuffles",
  "// them), the full sentence, pinyin, and the English/Thai meaning.",
  "// hsk: 1 or 2 = sentence from the HSK 1–2 set (tools/hsk12_sentences.json).",
  "// alts: other block orders that are also correct (e.g. a time word moved).",
  "",
  "const allQuestions = ["
];
[1, 2, 3, 4, 5].forEach((lvl) => {
  const items = original.filter(q => q.level === lvl).concat(added.filter(q => q.level === lvl));
  out.push("", "  /* ---------- LEVEL " + lvl + ": " + LEVEL_INFO[lvl] + " ---------- */");
  items.forEach(q => { all.push(q); out.push(line(q) + ","); });
});
out[out.length - 1] = out[out.length - 1].replace(/,$/, "");
out.push("", "];", "");
fs.writeFileSync(file, out.join("\n"), "utf8");

const check = new Function(fs.readFileSync(file, "utf8") + "; return allQuestions;")();
console.log("data/questions.js:", check.length, "sentences (", original.length, "original +", added.length, "HSK 1–2 )");
