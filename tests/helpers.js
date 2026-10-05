const fs = require('fs');
const path = require('path');
const vm = require('vm');

const WWW = path.join(__dirname, '..', 'www');
const HTML = fs.readFileSync(path.join(WWW, 'index.html'), 'utf8');

// Pull a JS array literal (e.g. QUIZ_BANK) out of index.html so tests always match the real content.
function extractArray(name) {
  const match = HTML.match(new RegExp(`var ${name} = (\\[[\\s\\S]*?\\n  \\]);`));
  if (!match) throw new Error(`Could not find ${name} in www/index.html`);
  return new Function(`return ${match[1]};`)();
}

const QUIZ_BANK = extractArray('QUIZ_BANK');
const CATS = extractArray('CATS');
const SPOTLIGHT = extractArray('rightsSpotlight');
const COMMISSIONS = extractArray('COMMISSIONS');

// Load the constitution data file the same way the page does.
const data = {};
vm.runInNewContext(fs.readFileSync(path.join(WWW, 'data', 'constitution.js'), 'utf8') +
  ';out.chapters = KENYA_CONSTITUTION; out.preamble = KENYA_CONSTITUTION_PREAMBLE;', { out: data });
const CHAPTERS = data.chapters;
const PREAMBLE_TEXT = data.preamble;
const PREAMBLE_PHRASES = PREAMBLE_TEXT.split(/\n\s*\n/).map((s) => s.replace(/\s+/g, ' ').trim()).filter(Boolean);

function article(num) {
  for (const c of CHAPTERS) {
    const a = c.articles.find((x) => x.num === num);
    if (a) return a;
  }
  return null;
}

// Stand-ins for the speaker and the browser speech engine, so tests can see what the app tried to play or say.
function installAudioSpy() {
  window.__sounds = 0;
  window.__speech = [];
  const node = () => ({ connect(n) { return n; }, start() {}, stop() {} });
  class FakeAudioContext {
    constructor() { this.state = 'running'; this.currentTime = 0; this.sampleRate = 44100; this.destination = {}; }
    resume() { return Promise.resolve(); }
    createOscillator() { window.__sounds++; return { ...node(), type: '', frequency: { value: 0 } }; }
    createBufferSource() { window.__sounds++; return node(); }
    createGain() { return { ...node(), gain: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} } }; }
    createBiquadFilter() { return { ...node(), type: '', frequency: { value: 0 } }; }
    createBuffer(_c, n) { return { getChannelData: () => new Float32Array(n) }; }
  }
  window.AudioContext = FakeAudioContext;
  window.webkitAudioContext = FakeAudioContext;
  window.SpeechSynthesisUtterance = function (text) { this.text = text; };
  Object.defineProperty(window, 'speechSynthesis', {
    configurable: true,
    value: { speak(u) { window.__speech.push(u.text); }, cancel() { window.__speech.push('<cancel>'); } }
  });
}

// Pretends to be the installed app: a Capacitor bridge with the TextToSpeech plugin.
function installNativeBridge(languages) {
  window.__native = [];
  window.Capacitor = {
    isNativePlatform: () => true,
    nativePromise: (plugin, method, options) => {
      window.__native.push({ plugin, method, options });
      if (method === 'getSupportedLanguages') return Promise.resolve({ languages });
      return Promise.resolve({});
    }
  };
}

// Opens the app with the audio spy and a paused fake clock (timers only move on page.clock.runFor).
// Pass nativeLanguages to simulate the installed app with those text-to-speech voices.
async function openApp(page, { nativeLanguages } = {}) {
  await page.addInitScript(installAudioSpy);
  if (nativeLanguages) await page.addInitScript(installNativeBridge, nativeLanguages);
  const t0 = new Date('2026-01-01T00:00:00Z');
  await page.clock.install({ time: t0 });
  await page.goto('/');
  await page.addStyleTag({ content: '*, *::before, *::after { animation: none !important; transition: none !important; scroll-behavior: auto !important; }' });
  await page.clock.pauseAt(new Date(t0.getTime() + 60_000));
}

const soundCount = (page) => page.evaluate(() => window.__sounds);
const spoken = (page) => page.evaluate(() => window.__speech.filter((s) => s !== '<cancel>'));
const nativeCalls = (page) => page.evaluate(() => window.__native);

// Finds the bank entry for the question currently on screen.
async function currentQuestion(page) {
  const text = (await page.locator('.quiz-q').innerText()).trim();
  const q = QUIZ_BANK.find((item) => item.q === text);
  if (!q) throw new Error(`Question on screen not found in QUIZ_BANK: ${text}`);
  return q;
}

async function startQuiz(page, { minutes, onlyCats } = {}) {
  await page.locator('#quiz').scrollIntoViewIfNeeded();
  if (onlyCats) {
    for (const c of CATS) {
      if (!onlyCats.includes(c.key)) await page.locator(`.cat-chip[data-cat="${c.key}"]`).click();
    }
  }
  if (minutes) await page.locator(`.time-chip[data-min="${minutes}"]`).click();
  await page.locator('#startQuiz').click();
  await page.locator('.quiz-q').waitFor();
}

async function answerCurrent(page, { correct = true } = {}) {
  const q = await currentQuestion(page);
  const index = correct ? q.correct : (q.correct + 1) % q.opts.length;
  await page.locator(`.quiz-opt[data-i="${index}"]`).click();
  return q;
}

module.exports = {
  HTML, QUIZ_BANK, CATS, SPOTLIGHT, COMMISSIONS, CHAPTERS, PREAMBLE_TEXT, PREAMBLE_PHRASES, article,
  openApp, soundCount, spoken, nativeCalls, currentQuestion, startQuiz, answerCurrent
};
