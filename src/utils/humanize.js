async function randomDelay(min = 1000, max = 3000) {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise(resolve => setTimeout(resolve, delay));
}

async function humanType(page, selector, text) {
  await page.click(selector);
  for (const char of text) {
    await page.type(selector, char, { delay: Math.floor(Math.random() * 150) + 50 });
  }
}

async function humanScroll(page) {
  const distance = Math.floor(Math.random() * 400) + 200;
  await page.evaluate((scrollDistance) => {
    window.scrollBy({ top: scrollDistance, behavior: 'smooth' });
  }, distance);
  await randomDelay(800, 1500);
}

async function simulateHumanBehavior(page) {
  // Random page scroll and mouse movement simulation
  await humanScroll(page);
  await randomDelay(1000, 2500);
  await humanScroll(page);
}

module.exports = {
  randomDelay,
  humanType,
  humanScroll,
  simulateHumanBehavior,
};
