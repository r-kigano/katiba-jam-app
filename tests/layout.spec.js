// Phone-screen layout checks: nothing spills sideways at any text size.
const { test, expect } = require('@playwright/test');
const { openApp, startQuiz } = require('./helpers');

async function expectNoHorizontalScroll(page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, 'page is wider than the screen').toBeLessThanOrEqual(1);
}

async function setScale(page, ups) {
  for (let i = 0; i < ups; i++) await page.locator('#sizeUp').click();
}

test.beforeEach(async ({ page }) => {
  await openApp(page);
});

for (const [label, ups] of [['normal', 0], ['largest', 5]]) {
  test(`whole page fits the screen width at ${label} text size`, async ({ page }) => {
    await setScale(page, ups);
    await expectNoHorizontalScroll(page);
    await page.screenshot({ path: test.info().outputPath(`page-${label}.png`) });
  });

  test(`an open Katiba chapter fits the screen width at ${label} text size`, async ({ page }) => {
    await setScale(page, ups);
    await page.locator('.chapter-item summary').nth(3).click();
    await expectNoHorizontalScroll(page);
  });

  test(`quiz fits the screen width at ${label} text size`, async ({ page }) => {
    await setScale(page, ups);
    await startQuiz(page);
    await expectNoHorizontalScroll(page);
    await page.locator('#quizCard').screenshot({ path: test.info().outputPath(`quiz-${label}.png`) });
  });
}

test('Bill of Rights arrows and card stay on screen at the largest text size', async ({ page }) => {
  await setScale(page, 5);
  const vp = page.viewportSize();
  for (const sel of ['#prevAmend', '#amendCard', '#nextAmend']) {
    const box = await page.locator(sel).boundingBox();
    expect(box.x, `${sel} left edge`).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width, `${sel} right edge`).toBeLessThanOrEqual(vp.width + 1);
  }
});

test('the pinned section tabs do not grow when the text size is turned up', async ({ page }) => {
  const normal = (await page.locator('.navtabs').boundingBox()).height;
  await setScale(page, 5);
  const largest = (await page.locator('.navtabs').boundingBox()).height;
  expect(largest, 'pinned bar grew with the text size').toBeLessThanOrEqual(normal + 1);
});

test('on phones the Bill of Rights card uses the full width, with both arrows underneath', async ({ page }) => {
  await setScale(page, 5);
  const vp = page.viewportSize();
  const card = await page.locator('#amendCard').boundingBox();
  const prev = await page.locator('#prevAmend').boundingBox();
  const next = await page.locator('#nextAmend').boundingBox();
  expect(card.width, 'card should span the screen').toBeGreaterThanOrEqual(vp.width - 60);
  expect(prev.y, '← should sit below the card').toBeGreaterThanOrEqual(card.y + card.height);
  expect(next.y, '→ should sit below the card').toBeGreaterThanOrEqual(card.y + card.height);
  expect(prev.x + prev.width, '← should be left of →').toBeLessThan(next.x);
});

test('starting and finishing the quiz keep the question and result in view below the pinned bar', async ({ page }) => {
  const barBottom = () => page.locator('.navtabs').evaluate((el) => el.getBoundingClientRect().bottom);
  const topOf = (sel) => page.locator(sel).evaluate((el) => el.getBoundingClientRect().top);
  await page.locator('#startQuiz').evaluate((el) => el.scrollIntoView({ block: 'end' }));
  await page.locator('#startQuiz').click();
  expect(await topOf('#timerDisplay'), 'timer hidden behind the pinned bar').toBeGreaterThanOrEqual(await barBottom());
  await expect(page.locator('.quiz-q')).toBeInViewport();
  await page.locator('#finishNow').click();
  expect(await topOf('.quiz-done'), 'result hidden behind the pinned bar').toBeGreaterThanOrEqual(await barBottom());
  await expect(page.locator('.quiz-done .quiz-q')).toBeInViewport();
});
