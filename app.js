// Core / Support Bingo
// Plain HTML/CSS/JS. Deterministic daily shuffle (Europe/Warsaw) + localStorage progress.
//
// YouTube celebration: https://www.youtube.com/watch?v=y5T5YZ6mYLA

const YT_VIDEO_ID = "y5T5YZ6mYLA";
const BOARDS_COUNT = 3;
const SIZE = 3; // 3x3

const PHRASES = [
  "nie buduje mi się",
  "konfiguracja IAPów",
  "jenkins nie działa",
  "opóźniamy release'a",
  "HCSDK mention",
  "BBSDK mention",
  "deprecated unity",
  "PlayFab nie działa",
  "o jednak działa",
  "u mnie działa",
  "logi w docx",
  "marcin na supporcie",
  "please prioritize this ticket",
  "komuś nie działają IAPy",
  "Race condition",
  "Trzeba wydać hotfixa",
  "External nie ma ustawionych idików",
  "Za dużo CP w grze",
  "Musisz zaktualizać Xcode'a",
  "MOLOCO",
  "Podsy padły",
  "Artifactory padło",
];

// ---------- utils: date in Warsaw ----------
function getWarsawDateISO() {
  // en-CA gives YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Warsaw",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

// ---------- seeded RNG ----------
function xmur3(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function () {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

function mulberry32(a) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededShuffle(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---------- storage ----------
function lsKey(dateISO, boardIndex) {
  return `coreSupportBingo:v1:${dateISO}:b${boardIndex}`;
}

function loadState(dateISO, boardIndex) {
  try {
    const raw = localStorage.getItem(lsKey(dateISO, boardIndex));
    if (!raw) return { selected: Array(9).fill(false), won: false };
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.selected) || parsed.selected.length !== 9) throw new Error("bad state");
    return { selected: parsed.selected.map(Boolean), won: Boolean(parsed.won) };
  } catch {
    return { selected: Array(9).fill(false), won: false };
  }
}

function saveState(dateISO, boardIndex, state) {
  localStorage.setItem(lsKey(dateISO, boardIndex), JSON.stringify(state));
}

// ---------- bingo logic ----------
const LINES = [
  [0,1,2],[3,4,5],[6,7,8],
  [0,3,6],[1,4,7],[2,5,8],
  [0,4,8],[2,4,6],
];

function findWinningLine(selected) {
  for (const line of LINES) {
    if (line.every(i => selected[i])) return line;
  }
  return null;
}

// ---------- chime (no external audio needed) ----------
function playChime() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return;

  const ctx = new AudioCtx();
  const now = ctx.currentTime;

  const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
  notes.forEach((freq, idx) => {
    const t0 = now + idx * 0.12;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, t0);

    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(0.25, t0 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.18);

    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + 0.2);
  });

  // close after a bit
  setTimeout(() => ctx.close().catch(() => {}), 1200);
}

// ---------- app ----------
const todayISO = getWarsawDateISO();
document.getElementById("todayLabel").textContent = todayISO;

const gridEl = document.getElementById("grid");
const tabs = Array.from(document.querySelectorAll(".tab"));
const resetBtn = document.getElementById("resetBtn");
const autoOpenToggle = document.getElementById("autoOpenToggle");

// modal
const modal = document.getElementById("modal");
const openYoutubeBtn = document.getElementById("openYoutubeBtn");
const embedYoutubeBtn = document.getElementById("embedYoutubeBtn");
const closeModalBtn = document.getElementById("closeModalBtn");
const embedWrap = document.getElementById("embedWrap");
const ytFrame = document.getElementById("ytFrame");

let currentBoardIndex = 0;
let boards = [];
let state = loadState(todayISO, currentBoardIndex);

function buildBoards() {
  // deterministic daily shuffle
  const seedFn = xmur3(`core-support-bingo:${todayISO}`);
  const rng = mulberry32(seedFn());

  const shuffled = seededShuffle(PHRASES, rng);

  // Create 3 distinct 9-item boards from the same shuffled list.
  // If phrases < 27, wrap around.
  boards = Array.from({ length: BOARDS_COUNT }, (_, b) => {
    const out = [];
    const start = b * 9;
    for (let i = 0; i < 9; i++) {
      out.push(shuffled[(start + i) % shuffled.length]);
    }
    return out;
  });
}

function render() {
  const board = boards[currentBoardIndex];

  gridEl.innerHTML = "";
  const winLine = findWinningLine(state.selected);

  board.forEach((text, idx) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "tile" + (state.selected[idx] ? " selected" : "");
    btn.setAttribute("aria-pressed", state.selected[idx] ? "true" : "false");

    const span = document.createElement("span");
    span.className = "tileText";
    span.textContent = text;

    btn.appendChild(span);

    if (winLine && winLine.includes(idx)) {
      btn.classList.add("win");
    }

    btn.addEventListener("click", () => onTileClick(idx));
    gridEl.appendChild(btn);
  });
}

function onTileClick(idx) {
  if (state.won) return;

  // toggle
  state.selected[idx] = !state.selected[idx];
  saveState(todayISO, currentBoardIndex, state);

  // re-render so win highlights update
  render();

  const winLine = findWinningLine(state.selected);
  if (winLine && !state.won) {
    state.won = true;
    saveState(todayISO, currentBoardIndex, state);

    // victory!
    playChime();
    showModal();

    // odśwież jeszcze raz, jeśli blokujesz kafelki gdy won
    render();

    // try to open YT if user wants (still within user gesture)
    if (autoOpenToggle.checked) {
      openYoutubeInNewTab();
    }
  }
}

function setBoard(index) {
  currentBoardIndex = index;
  state = loadState(todayISO, currentBoardIndex);

  tabs.forEach((t) => {
    const active = Number(t.dataset.board) === index;
    t.classList.toggle("active", active);
    t.setAttribute("aria-selected", active ? "true" : "false");
  });

  // close modal + reset embed
  hideModal();
  embedWrap.hidden = true;
  ytFrame.removeAttribute("src");

  render();
}

function resetBoard() {
  state = { selected: Array(9).fill(false), won: false };
  saveState(todayISO, currentBoardIndex, state);
  render();
}

function openYoutubeInNewTab() {
  const url = `https://www.youtube.com/watch?v=${YT_VIDEO_ID}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

function showModal() {
  modal.classList.add("show");
  modal.setAttribute("aria-hidden", "false");
}

function hideModal() {
  modal.classList.remove("show");
  modal.setAttribute("aria-hidden", "true");
  stopEmbeddedVideo();
}

function stopEmbeddedVideo() {
  ytFrame.removeAttribute("src"); // zatrzymuje odtwarzanie
  embedWrap.hidden = true;
}


tabs.forEach((t) => {
  t.addEventListener("click", () => setBoard(Number(t.dataset.board)));
});

resetBtn.addEventListener("click", resetBoard);

openYoutubeBtn.addEventListener("click", openYoutubeInNewTab);

embedYoutubeBtn.addEventListener("click", () => {
  embedWrap.hidden = false;
  // Autoplay may be blocked; muting sometimes helps, but you probably want audio.
  ytFrame.src = `https://www.youtube.com/embed/${YT_VIDEO_ID}?autoplay=1&mute=0&rel=0`;
});

closeModalBtn.addEventListener("click", hideModal);

// click outside closes modal
modal.addEventListener("click", (e) => {
  if (e.target === modal) hideModal();
});

// persist preference
const PREF_KEY = "coreSupportBingo:autoOpenYT:v1";

const pref = localStorage.getItem(PREF_KEY);
autoOpenToggle.checked = pref !== "0";

autoOpenToggle.addEventListener("change", () => {
  localStorage.setItem(PREF_KEY, autoOpenToggle.checked ? "1" : "0");
});

// init
buildBoards();
setBoard(0);
