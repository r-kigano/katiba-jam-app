// Checks the app's content itself. Runs once (no browser needed).
const { test, expect } = require('@playwright/test');
const { HTML, QUIZ_BANK, CATS, SPOTLIGHT, CHAPTERS, PREAMBLE_TEXT, PREAMBLE_PHRASES, article } = require('./helpers');

test.describe('constitution text', () => {
  test('has all 18 chapters, in order', () => {
    expect(CHAPTERS.map((c) => c.chapter)).toEqual(Array.from({ length: 18 }, (_, i) => i + 1));
    for (const c of CHAPTERS) expect(c.title.length, `Chapter ${c.chapter} title`).toBeGreaterThan(3);
  });

  test('has all 264 articles, numbered 1–264 in order, each with text', () => {
    const nums = CHAPTERS.flatMap((c) => c.articles.map((a) => a.num));
    expect(nums).toEqual(Array.from({ length: 264 }, (_, i) => i + 1));
    for (const c of CHAPTERS) {
      for (const a of c.articles) {
        expect(a.title.length, `Article ${a.num} title`).toBeGreaterThan(2);
        expect(a.clauses.length, `Article ${a.num} clauses`).toBeGreaterThan(0);
      }
    }
  });

  test('Preamble starts with "We, the people of Kenya" and ends with "GOD BLESS KENYA"', () => {
    expect(PREAMBLE_TEXT.startsWith('We, the people of Kenya')).toBe(true);
    expect(PREAMBLE_PHRASES[PREAMBLE_PHRASES.length - 1]).toBe('GOD BLESS KENYA');
    expect(PREAMBLE_PHRASES.length).toBe(10);
  });
});

test.describe('Bill of Rights spotlight', () => {
  test('every spotlight card points to a real Chapter 4 article with a matching title', () => {
    const ch4 = CHAPTERS.find((c) => c.chapter === 4);
    for (const s of SPOTLIGHT) {
      const a = ch4.articles.find((x) => x.num === s.num);
      expect(a, `Article ${s.num} missing from Chapter 4`).toBeTruthy();
      const words = (t) => t.toLowerCase().replace(/[^a-z ]/g, ' ').split(/\s+/).filter((w) => w.length > 3);
      const overlap = words(s.title).filter((w) => words(a.title).includes(w));
      expect(overlap.length, `Article ${s.num}: card "${s.title}" vs text "${a.title}"`).toBeGreaterThan(0);
    }
  });

  test('every card is short enough to read aloud in one go (Android limit ~3900 characters)', () => {
    for (const s of SPOTLIGHT) {
      const a = article(s.num);
      const text = `Article ${s.num}. ${s.title}. ${a.clauses.join(' ')}`;
      expect(text.length, `Article ${s.num} would be cut off mid-way`).toBeLessThanOrEqual(3900);
    }
  });
});

test.describe('quiz bank', () => {
  test('every question is well-formed', () => {
    const catKeys = CATS.map((c) => c.key);
    for (const [i, q] of QUIZ_BANK.entries()) {
      const where = `Q${i + 1} "${q.q.slice(0, 40)}"`;
      expect(catKeys, `${where} topic`).toContain(q.cat);
      expect(q.opts.length, `${where} options`).toBe(4);
      expect(q.correct, `${where} correct index`).toBeGreaterThanOrEqual(0);
      expect(q.correct, `${where} correct index`).toBeLessThan(q.opts.length);
      expect(new Set(q.opts).size, `${where} has duplicate options`).toBe(q.opts.length);
    }
  });

  test('all seven topics have questions and no question is repeated', () => {
    expect(CATS.length).toBe(7);
    for (const c of CATS) {
      expect(QUIZ_BANK.filter((q) => q.cat === c.key).length, c.label).toBeGreaterThanOrEqual(5);
    }
    const texts = QUIZ_BANK.map((q) => q.q.trim().toLowerCase());
    expect(texts.filter((t, i) => texts.indexOf(t) !== i)).toEqual([]);
  });

  test('correct answers are not always in the same position', () => {
    expect(new Set(QUIZ_BANK.map((q) => q.correct)).size).toBeGreaterThanOrEqual(3);
  });
});

test.describe('release readiness', () => {
  test('no temporary Read Aloud diagnostic pop-ups are left in the app', () => {
    expect(HTML, 'remove the TEMPORARY diagnostics alerts in speakText()').not.toContain('TEMPORARY diagnostics');
    expect(HTML).not.toContain("alert('[Katiba build");
  });

  test('build number placeholder is present for Codemagic to stamp', () => {
    expect(HTML).toContain("var BUILD_ID = '__BUILD__';");
  });
});
