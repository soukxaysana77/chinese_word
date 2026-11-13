// audio.js — mascot talking animation, Chinese TTS, and the little
// correct/wrong tones.
//
// Load this before wordle_chinese.js — that file calls speak(),
// speakCurrent(), playCorrectSound() and playWrongSound(), all defined
// here. speakCurrent() also reads `questions`/`currentQuestion` from
// wordle_chinese.js, but not until the game has actually started, so
// load order is the only thing that matters.

let mouthInterval = null;
let mouthIsOpen = false;

function startTalking() {
  const closedMouth = document.getElementById("mouthClosed");
  const openMouth = document.getElementById("mouthOpen");
  if (!closedMouth || !openMouth) return;

  stopTalking();

  mouthIsOpen = false;
  mouthInterval = setInterval(() => {
    mouthIsOpen = !mouthIsOpen;
    closedMouth.style.display = mouthIsOpen ? "none" : "";
    openMouth.style.display = mouthIsOpen ? "" : "none";
  }, 150);
}

function stopTalking() {
  if (mouthInterval) {
    clearInterval(mouthInterval);
    mouthInterval = null;
  }
  mouthIsOpen = false;
  const closedMouth = document.getElementById("mouthClosed");
  const openMouth = document.getElementById("mouthOpen");
  if (closedMouth) closedMouth.style.display = "";
  if (openMouth) openMouth.style.display = "none";
}

// Voice list can load asynchronously on some browsers, so cache it and
// refresh whenever the browser tells us it changed.
let cachedVoices = [];
function refreshVoices() {
  if ("speechSynthesis" in window) {
    cachedVoices = speechSynthesis.getVoices();
  }
}
if ("speechSynthesis" in window) {
  refreshVoices();
  speechSynthesis.onvoiceschanged = refreshVoices;
}

// Android reports "zh_CN", some engines "cmn-Hans-CN" — normalise first.
function voiceLang(v) {
  return (v.lang || "").toLowerCase().replace(/_/g, "-");
}

function isChineseVoice(v) {
  const lang = voiceLang(v);
  return lang.startsWith("zh") || lang.startsWith("cmn");
}

function pickChineseVoice() {
  if (!cachedVoices.length) refreshVoices();
  return (
    cachedVoices.find(v => voiceLang(v) === "zh-cn") ||
    cachedVoices.find(isChineseVoice) ||
    null
  );
}

// Can this device read Chinese aloud? Calls back once with:
//   "no-speech"  — the browser can't speak at all (e.g. LINE/Facebook's
//                  in-app browser on Android)
//   "no-chinese" — it can speak, but has no Chinese voice
//   null         — fine, or can't tell yet (voice list never loaded): stay
//                  quiet rather than warn by mistake
function checkChineseVoice(callback) {
  if (!("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") {
    callback("no-speech");
    return;
  }
  let answered = false;
  function decide() {
    if (answered) return;
    const voices = speechSynthesis.getVoices();
    if (!voices.length) return; // not loaded yet
    answered = true;
    callback(voices.some(isChineseVoice) ? null : "no-chinese");
  }
  decide();
  speechSynthesis.addEventListener("voiceschanged", decide);
  setTimeout(decide, 3000);
}

// Lets the page show a message when speaking fails while playing
// (e.g. the online voice can't reach the internet).
let speechProblemHandler = null;
function onSpeechProblem(handler) {
  speechProblemHandler = handler;
}
const SPEECH_FAILURES = ["network", "synthesis-unavailable", "synthesis-failed",
  "language-unavailable", "voice-unavailable", "audio-hardware"];

// Mobile Safari won't play any speechSynthesis audio until it's been
// triggered once from a real tap/click. This "unlocks" it on the first
// touch so the later automatic speak() calls actually work.
let speechUnlocked = false;
function unlockSpeech() {
  // recorded clips play through Web Audio, which also needs a first tap
  try { getAudioCtx(); } catch (e) {}
  if (speechUnlocked || !("speechSynthesis" in window)) return;
  speechUnlocked = true;
  try {
    const primer = new SpeechSynthesisUtterance(" ");
    primer.volume = 0;
    speechSynthesis.speak(primer);
  } catch (e) {}
}
document.addEventListener("click", unlockSpeech, { once: true, capture: true });
document.addEventListener("touchend", unlockSpeech, { once: true, capture: true });

// How long the voice took to say each text on THIS device (ms, from start
// to end). Filled in by every speak() — e.g. each word as the player taps
// it — and used to time the block jumps when a whole sentence is read.
const measuredSpeechMs = new Map();
let latestSpeechId = 0; // a newer speak() cuts off older ones

/* ---------- recorded audio (audio/*.mp3, made by tools/make_audio.py) ---------- */

let clipFiles = {};            // text -> file name in audio/
const clipBuffers = new Map(); // text -> Promise<AudioBuffer>
let currentClip = null;        // { speechId, source, done } while a clip plays

// Resolves to true when recorded clips are available. Fails quietly (e.g.
// the page was opened straight from a file) — then the browser voice is used.
const audioReady = (async function () {
  try {
    const res = await fetch("./audio/manifest.json", { cache: "no-cache" });
    if (!res.ok) return false;
    clipFiles = (await res.json()).files || {};
    return Object.keys(clipFiles).length > 0;
  } catch (e) {
    return false;
  }
})();

function hasClip(text) {
  return Object.prototype.hasOwnProperty.call(clipFiles, text);
}

function loadClip(text) {
  if (!hasClip(text)) return Promise.reject(new Error("no clip"));
  if (!clipBuffers.has(text)) {
    const p = fetch("./audio/" + clipFiles[text])
      .then(res => {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.arrayBuffer();
      })
      // callback form: older Safari has no promise version
      .then(data => new Promise((resolve, reject) => getAudioCtx().decodeAudioData(data, resolve, reject)));
    p.catch(() => clipBuffers.delete(text)); // try again next time
    clipBuffers.set(text, p);
  }
  return clipBuffers.get(text);
}

// Start downloading the clips a question needs, so they play without delay.
function preloadClips(texts) {
  texts.forEach(t => { if (hasClip(t)) loadClip(t).catch(() => {}); });
}

function stopClip() {
  if (!currentClip) return;
  const clip = currentClip;
  currentClip = null;
  if (clip.source) {
    try { clip.source.onended = null; clip.source.stop(); } catch (e) {}
  }
  clip.done(false);
}

function playClip(text, opts, speechId) {
  let finished = false;
  function done(ok) {
    if (finished) return;
    finished = true;
    if (currentClip && currentClip.speechId === speechId) currentClip = null;
    stopTalking();
    if (opts.onDone) opts.onDone(ok);
  }
  currentClip = { speechId: speechId, source: null, done: done };

  loadClip(text).then(function (buffer) {
    const ctx = getAudioCtx();
    if (ctx.state === "running") return buffer;
    // sound may still be switching on after the first tap — wait a moment;
    // if it never does (no tap on this page yet), stay silent
    return Promise.race([
      ctx.resume().then(() => buffer),
      new Promise((resolve, reject) => setTimeout(reject, 400, new Error("audio locked")))
    ]);
  }).then(function (buffer) {
    if (finished || speechId !== latestSpeechId) return; // replaced while loading
    const ctx = getAudioCtx();
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.onended = function () { done(true); };
    currentClip.source = source;
    source.start();
    measuredSpeechMs.set(text, buffer.duration * 1000);
    startTalking();
    if (opts.onStart) opts.onStart();
  }).catch(function (err) {
    if (finished || speechId !== latestSpeechId) return;
    if (err && err.message === "audio locked") {
      done(false);
      return;
    }
    // file missing or broken: use the browser's voice for this one
    finished = true;
    if (currentClip && currentClip.speechId === speechId) currentClip = null;
    speakWithVoice(text, opts, speechId);
  });
}

// opts (all optional):
//   onStart()            the sound actually started
//   onBoundary(charIdx)  the voice reports it reached this character
//                        (only some browser voices do)
//   onDone(ok)           runs once at the end; ok = false if it was cut off,
//                        failed, or the device never reported the end
// Plays the recorded clip when there is one, otherwise the browser's voice.
function speak(text, opts) {
  opts = opts || {};
  const speechId = ++latestSpeechId;
  stopClip();
  if ("speechSynthesis" in window) speechSynthesis.cancel();
  if (hasClip(text)) playClip(text, opts, speechId);
  else speakWithVoice(text, opts, speechId);
}

// Browser text-to-speech. Some devices never report start/end (no Chinese
// voice, speech blocked), so onDone still runs if the voice hasn't started
// within 2.5s, or once it has run well past how long the text should take.
function speakWithVoice(text, opts, speechId) {
  let finished = false;
  let fallbackTimer = null;
  let startedAt = 0;
  function done(ok) {
    if (finished) return;
    finished = true;
    clearTimeout(fallbackTimer);
    if (opts.onDone) opts.onDone(ok);
  }
  if (opts.onDone) fallbackTimer = setTimeout(done, 2500, false);

  if (!("speechSynthesis" in window)) {
    if (speechProblemHandler) speechProblemHandler("no-speech");
    if (opts.onDone) setTimeout(done, 0, false);
    return;
  }
  const voices = speechSynthesis.getVoices();
  if (voices.length && !voices.some(isChineseVoice) && speechProblemHandler) {
    speechProblemHandler("no-chinese"); // this text has no recording, and no Chinese voice to read it
  }

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "zh-CN";
  utterance.rate = 0.8;
  utterance.pitch = 1;

  const zhVoice = pickChineseVoice();
  if (zhVoice) utterance.voice = zhVoice;
  // If the device has no zh voice we still try with lang="zh-CN" — some
  // engines can still synthesize it, some just stay silent. Nothing we
  // can fix from here.

  utterance.onstart = () => {
    startedAt = performance.now();
    startTalking();
    if (opts.onDone && !finished) {
      clearTimeout(fallbackTimer);
      fallbackTimer = setTimeout(done, 1500 + 450 * text.length, false);
    }
    if (opts.onStart) opts.onStart();
  };
  utterance.onboundary = (e) => {
    if (opts.onBoundary && typeof e.charIndex === "number") opts.onBoundary(e.charIndex);
  };
  utterance.onend = () => {
    // some browsers report "end" (not "error") when a newer speak() cut this
    // one off — don't count that as finished or measure it
    const cutOff = speechId !== latestSpeechId;
    const took = startedAt ? performance.now() - startedAt : 0;
    if (!cutOff && took > 150) measuredSpeechMs.set(text, took);
    stopTalking();
    done(!cutOff);
  };
  utterance.onerror = (e) => {
    stopTalking();
    // "interrupted"/"canceled" just mean a newer speak() took over
    if (e && SPEECH_FAILURES.includes(e.error) && speechProblemHandler) {
      speechProblemHandler(e.error === "network" ? "offline" : "failed");
    }
    done(false);
  };

  speechSynthesis.speak(utterance);
}

function speakCurrent() {
  if (!questions.length) return; // word list still loading
  unlockSpeech();
  speak(questions[currentQuestion].chinese);
}

// Correct/wrong feedback tones, plain Web Audio oscillators.
let audioCtx = null;
function getAudioCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  return audioCtx;
}

function playTone(freq, startTime, duration, type, peakGain) {
  const ctx = getAudioCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, startTime);
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(peakGain, startTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(startTime);
  osc.stop(startTime + duration + 0.02);
}

function playCorrectSound() {
  try {
    const ctx = getAudioCtx();
    const now = ctx.currentTime;
    playTone(523.25, now, 0.14, "sine", 0.25);
    playTone(659.25, now + 0.1, 0.14, "sine", 0.25);
    playTone(783.99, now + 0.2, 0.22, "sine", 0.25);
  } catch (e) {}
}

function playWrongSound() {
  try {
    const ctx = getAudioCtx();
    const now = ctx.currentTime;
    playTone(220, now, 0.18, "sawtooth", 0.2);
    playTone(174.61, now + 0.14, 0.22, "sawtooth", 0.2);
  } catch (e) {}
}
