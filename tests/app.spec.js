const { test, expect } = require('@playwright/test');
const {
  QUIZ_BANK, CATS, SPOTLIGHT, COMMISSIONS, CHAPTERS, PREAMBLE_PHRASES, article,
  openApp, soundCount, spoken, nativeCalls, currentQuestion, startQuiz, answerCurrent
} = require('./helpers');

test.describe('in the browser', () => {
  test.beforeEach(async ({ page }) => {
    page.on('pageerror', (err) => { throw err; });
    await openApp(page);
  });

  test.describe('control booth and navigation', () => {
    test('A+ and A− change text size, stop at the limits, and remember the setting', async ({ page }) => {
      const scale = () => page.evaluate(() => document.documentElement.style.getPropertyValue('--scale'));
      expect(await scale()).toBe('1.00');
      for (let i = 0; i < 10; i++) await page.locator('#sizeUp').click();
      expect(await scale()).toBe('1.50');
      for (let i = 0; i < 20; i++) await page.locator('#sizeDown').click();
      expect(await scale()).toBe('0.85');
      await page.reload();
      expect(await scale()).toBe('0.85');
    });

    test('High contrast turns on and is remembered', async ({ page }) => {
      await page.locator('#contrastBtn').click();
      await expect(page.locator('html')).toHaveClass(/contrast/);
      await page.reload();
      await expect(page.locator('#contrastBtn')).toHaveAttribute('aria-pressed', 'true');
    });

    test('Sound off silences the instruments, and the setting is remembered', async ({ page }) => {
      await page.locator('.note-btn[data-key="legislative"]').click();
      expect(await soundCount(page)).toBeGreaterThan(0);
      await page.locator('#soundBtn').click();
      await page.reload();
      await expect(page.locator('#soundBtn')).toHaveText('🔈 Sound off');
      for (const key of ['executive', 'judicial', 'devolved']) await page.locator(`.note-btn[data-key="${key}"]`).click();
      await page.locator('#playPreamble').click();
      await page.clock.runFor(10_000);
      expect(await soundCount(page)).toBe(0);
    });

    test('Sound off also silences Read aloud', async ({ page }) => {
      await page.locator('#soundBtn').click();
      await page.locator('#readPreamble').click();
      expect(await spoken(page)).toEqual([]);
    });

    test('section tabs jump to each section', async ({ page }) => {
      for (const id of ['preamble', 'branches', 'rights', 'katiba', 'quiz']) {
        await page.locator(`.navtab[href="#${id}"]`).click();
        await expect(page).toHaveURL(new RegExp(`#${id}$`));
        await expect(page.locator(`#${id} h2`)).toBeInViewport();
      }
    });

    test('footer shows the build number', async ({ page }) => {
      await expect(page.locator('#buildId')).toHaveText(/^Build /);
    });
  });

  test.describe('Preamble', () => {
    test('shows each clause of the Preamble from the constitution data', async ({ page }) => {
      await expect(page.locator('.phrase')).toHaveText(PREAMBLE_PHRASES);
    });

    test('Play lights up each clause in turn, then resets', async ({ page }) => {
      const play = page.locator('#playPreamble');
      await play.click();
      await expect(play).toHaveText('♪ Singing…');
      await page.clock.runFor(100);
      await expect(page.locator('#phrase-0')).toHaveClass(/active/);
      await page.clock.runFor(PREAMBLE_PHRASES.length * 720 + 500);
      await expect(page.locator('.phrase.done')).toHaveCount(PREAMBLE_PHRASES.length);
      await expect(play).toHaveText('▶ Play the song');
    });

    test('Read it aloud speaks the whole Preamble', async ({ page }) => {
      await page.locator('#readPreamble').click();
      expect(await spoken(page)).toEqual([PREAMBLE_PHRASES.join(' ')]);
    });
  });

  test.describe('Government', () => {
    test('shows the four pillars and all commissions', async ({ page }) => {
      await expect(page.locator('.branch-name')).toHaveText(['The Legislature', 'The Executive', 'The Judiciary', 'Devolved Government']);
      await expect(page.locator('.commission-chip')).toHaveText(COMMISSIONS);
    });

    test('seesaw balances after the three national branches; counties do not count toward it', async ({ page }) => {
      const msg = page.locator('#balanceMsg');
      await page.locator('.note-btn[data-key="devolved"]').click();
      await expect(msg).toHaveText(/Tap the Legislature/);
      await page.locator('.note-btn[data-key="legislative"]').click();
      await expect(msg).toHaveText('Tapped 1 of 3 — keep going!');
      await page.locator('.note-btn[data-key="executive"]').click();
      await page.locator('.note-btn[data-key="judicial"]').click();
      await expect(msg).toContainText('Balanced!');
    });

    test('Devolved Government lights up all 47 counties', async ({ page }) => {
      await expect(page.locator('.county-dot')).toHaveCount(47);
      await page.locator('.note-btn[data-key="devolved"]').click();
      await page.clock.runFor(47 * 28 + 200);
      await expect(page.locator('.county-dot.on')).toHaveCount(47);
      await expect(page.locator('#countiesMsg')).toContainText('All 47 counties');
    });
  });

  test.describe('Bill of Rights', () => {
    test('arrows move through every spotlight article and wrap around', async ({ page }) => {
      const num = page.locator('.amend-num');
      await expect(num).toHaveText(`ART.${SPOTLIGHT[0].num}`);
      await page.locator('#prevAmend').click();
      await expect(num).toHaveText(`ART.${SPOTLIGHT[SPOTLIGHT.length - 1].num}`);
      await page.locator('#nextAmend').click();
      for (const s of SPOTLIGHT.slice(1)) {
        await page.locator('#nextAmend').click();
        await expect(num).toHaveText(`ART.${s.num}`);
      }
    });

    test('each card shows the real article text, not a loading message', async ({ page }) => {
      for (let i = 0; i < SPOTLIGHT.length; i++) {
        await page.locator(`#dot-${i}`).click();
        await expect(page.locator('.amend-full')).not.toContainText('loading');
        await expect(page.locator('.amend-full')).toContainText(article(SPOTLIGHT[i].num).clauses[0].slice(0, 40));
      }
    });

    test('Read aloud speaks the article shown', async ({ page }) => {
      await page.locator('#dot-14').click();
      await page.locator('#readAmend').click();
      const said = await spoken(page);
      expect(said).toHaveLength(1);
      expect(said[0]).toMatch(new RegExp(`^Article ${SPOTLIGHT[14].num}\\. `));
    });
  });

  test.describe('Read the Katiba', () => {
    test('lists all 18 chapters, closed', async ({ page }) => {
      await expect(page.locator('.chapter-item')).toHaveCount(18);
      await expect(page.locator('.chapter-item[open]')).toHaveCount(0);
    });

    test('opening a chapter shows its articles', async ({ page }) => {
      const ch = CHAPTERS[3];
      const item = page.locator('.chapter-item').nth(3);
      await item.locator('summary').click();
      await expect(item.locator('.article-block h4')).toHaveCount(ch.articles.length);
      await expect(item.locator('.article-block h4').first()).toHaveText(`Article ${ch.articles[0].num} — ${ch.articles[0].title}`);
    });

    test('search by word finds matching articles and opens their chapters', async ({ page }) => {
      await page.locator('#katibaSearch').fill('fair trial');
      await page.clock.runFor(300);
      await expect(page.locator('.chapter-item').first()).toHaveAttribute('open', '');
      await expect(page.locator('.article-block h4', { hasText: 'Article 50' })).toBeVisible();
    });

    test('search by article number works', async ({ page }) => {
      await page.locator('#katibaSearch').fill('Article 43');
      await page.clock.runFor(300);
      await expect(page.locator('.article-block h4', { hasText: /^Article 43 —/ })).toHaveCount(1);
    });

    test('nonsense search says no matches; clearing it brings everything back', async ({ page }) => {
      await page.locator('#katibaSearch').fill('zzqxv');
      await page.clock.runFor(300);
      await expect(page.locator('.katiba-empty')).toContainText('No matches');
      await page.locator('#katibaSearch').fill('');
      await page.clock.runFor(300);
      await expect(page.locator('.chapter-item')).toHaveCount(18);
    });
  });

  test.describe('Katiba Quiz', () => {
    test('setup shows seven topics (all on) with question counts, and 15 min selected', async ({ page }) => {
      for (const c of CATS) {
        const chip = page.locator(`.cat-chip[data-cat="${c.key}"]`);
        await expect(chip).toHaveAttribute('aria-pressed', 'true');
        await expect(chip).toContainText(`(${QUIZ_BANK.filter((q) => q.cat === c.key).length})`);
      }
      await expect(page.locator('.time-chip[aria-pressed="true"]')).toHaveText('15 min');
    });

    test('the last remaining topic cannot be switched off', async ({ page }) => {
      for (const c of CATS.slice(1)) await page.locator(`.cat-chip[data-cat="${c.key}"]`).click();
      const last = page.locator(`.cat-chip[data-cat="${CATS[0].key}"]`);
      await last.click();
      await expect(last).toHaveAttribute('aria-pressed', 'true');
    });

    test('each time choice starts the timer at that many minutes', async ({ page }) => {
      for (const m of [10, 15, 20, 25, 30]) {
        await startQuiz(page, { minutes: m });
        await expect(page.locator('#timerDisplay')).toHaveText(`${m}:00`);
        await page.locator('#finishNow').click();
        await page.locator('#changeSettings').click();
      }
    });

    test('correct and wrong answers are marked and scored', async ({ page }) => {
      await startQuiz(page);
      let q = await answerCurrent(page);
      await expect(page.locator(`.quiz-opt[data-i="${q.correct}"]`)).toHaveClass(/correct/);
      await expect(page.locator('#quizFeedback')).toContainText('Sawa kabisa!');
      await page.clock.runFor(1_400);
      q = await answerCurrent(page, { correct: false });
      await expect(page.locator('.quiz-opt.wrong')).toHaveCount(1);
      await expect(page.locator(`.quiz-opt[data-i="${q.correct}"]`)).toHaveClass(/correct/);
      await expect(page.locator('#hudScore')).toHaveText('Correct 1 · Answered 2');
    });

    test('only questions from the chosen topic appear, and the deck reshuffles when used up', async ({ page }) => {
      const n = QUIZ_BANK.filter((q) => q.cat === 'devolution').length;
      await startQuiz(page, { onlyCats: ['devolution'] });
      for (let i = 0; i < n + 2; i++) {
        await expect(page.locator('.quiz-cat-badge')).toHaveText('Devolution & Counties');
        expect((await currentQuestion(page)).cat).toBe('devolution');
        await answerCurrent(page);
        await page.clock.runFor(1_400);
      }
      await expect(page.locator('#hudScore')).toHaveText(`Correct ${n + 2} · Answered ${n + 2}`);
    });

    test('timer runs out and shows the result and badge', async ({ page }) => {
      await startQuiz(page, { minutes: 10 });
      await answerCurrent(page);
      await page.clock.runFor(1_400);
      await page.clock.runFor(600_000);
      await expect(page.locator('.quiz-done')).toContainText('You answered 1 question and got 1 right (100%)');
      await expect(page.locator('.quiz-done')).toContainText('Katiba Champion');
    });

    test('Play again starts fresh; Change topics goes back to setup', async ({ page }) => {
      await startQuiz(page);
      await answerCurrent(page, { correct: false });
      await page.locator('#finishNow').click();
      await expect(page.locator('.quiz-done')).toContainText('Rising Wananchi Scholar');
      await page.locator('#replayQuiz').click();
      await expect(page.locator('#hudScore')).toHaveText('Correct 0 · Answered 0');
      await page.locator('#finishNow').click();
      await page.locator('#changeSettings').click();
      await expect(page.locator('#startQuiz')).toBeVisible();
    });
  });
});

// Simulates the installed app, where Read Aloud goes through the native TextToSpeech plugin.
test.describe('inside the installed app (simulated)', () => {
  test('Read aloud picks an English voice and sends the text to the native speech plugin', async ({ page }) => {
    const dialogs = [];
    page.on('dialog', (d) => { dialogs.push(d.message()); d.accept(); });
    await openApp(page, { nativeLanguages: ['sw-KE', 'en-GB', 'fr-FR'] });
    await page.locator('#readPreamble').click();
    await expect.poll(async () => (await nativeCalls(page)).some((c) => c.method === 'speak')).toBe(true);

    const speak = (await nativeCalls(page)).find((c) => c.method === 'speak');
    expect(speak.plugin).toBe('TextToSpeech');
    expect(speak.options.lang).toBe('en-GB');
    expect(speak.options.text).toBe(PREAMBLE_PHRASES.join(' '));
    expect(await spoken(page), 'browser speech must not be used in the app').toEqual([]);
  });

  test('with no voices installed, Read aloud explains how to fix it', async ({ page }) => {
    const dialogs = [];
    page.on('dialog', (d) => { dialogs.push(d.message()); d.accept(); });
    await openApp(page, { nativeLanguages: [] });
    await page.locator('#readPreamble').click();
    await expect.poll(() => dialogs.length).toBeGreaterThan(0);
    expect(dialogs[dialogs.length - 1]).toContain('Text-to-speech');
    expect((await nativeCalls(page)).some((c) => c.method === 'speak')).toBe(false);
  });

  test('turning Sound off stops native speech', async ({ page }) => {
    await openApp(page, { nativeLanguages: ['en-US'] });
    await page.locator('#soundBtn').click();
    expect((await nativeCalls(page)).some((c) => c.method === 'stop')).toBe(true);
  });
});
