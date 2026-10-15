const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { randomDelay, simulateHumanBehavior } = require('../utils/humanize');
puppeteer.use(StealthPlugin());

async function createStealthBrowser(proxyUrl = null) {
  const args = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-infobars',
    '--window-size=1280,800',
    '--disable-blink-features=AutomationControlled',
  ];

  if (proxyUrl) {
    args.push(`--proxy-server=${proxyUrl}`);
  }

  const browser = await puppeteer.launch({
    headless: 'new',
    args,
    ignoreHTTPSErrors: true,
  });

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36');

  return { browser, page };
}

/**
 * Perform platform-specific automated engagement (Follow / Like)
 * @param {import('puppeteer').Page} page
 * @param {string} platform - e.g., 'instagram', 'tiktok', 'twitter', 'youtube'
 * @param {string} targetUrl
 */
async function performPlatformAction(page, platform, targetUrl) {
  await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 30000 });
  await simulateHumanBehavior(page);

  // Platform-specific DOM Selectors & Action logic
  switch (platform.toLowerCase()) {
    case 'instagram': {
      // Example Instagram Follow button selector logic
      try {
        const followButtonSelector = 'button._acan._acap._acas._aj1-'; // Typical IG follow button class
        await page.waitForSelector(followButtonSelector, { timeout: 5000 });
        const buttonText = await page.$eval(followButtonSelector, el => el.innerText);
        if (buttonText.includes('Follow')) {
          await page.click(followButtonSelector);
          console.log('Instagram: Successfully clicked Follow button.');
          await randomDelay(2000, 4000);
        } else {
          console.log('Instagram: Already following or button not found.');
        }
      } catch (e) {
        console.warn('Instagram DOM action failed or login wall encountered:', e.message);
      }
      break;
    }
    case 'tiktok': {
      try {
        const tiktokFollowSelector = '[data-e2e="follow-button"]';
        await page.waitForSelector(tiktokFollowSelector, { timeout: 5000 });
        await page.click(tiktokFollowSelector);
        console.log('TikTok: Successfully clicked Follow button.');
        await randomDelay(2000, 4000);
      } catch (e) {
        console.warn('TikTok DOM action failed:', e.message);
      }
      break;
    }
    case 'youtube': {
      try {
        const ytSubscribeSelector = '#subscribe-button button';
        await page.waitForSelector(ytSubscribeSelector, { timeout: 5000 });
        await page.click(ytSubscribeSelector);
        console.log('YouTube: Successfully clicked Subscribe button.');
        await randomDelay(2000, 4000);
      } catch (e) {
        console.warn('YouTube DOM action failed:', e.message);
      }
      break;
    }
    default:
      console.log(`Generic platform action for ${platform}`);
      await randomDelay(2000, 3000);
      break;
  }
}

/**
 * Inject session cookies to bypass login walls
 * @param {import('puppeteer').Page} page
 * @param {Array} cookies
 */
async function injectSessionCookies(page, cookies = []) {
  if (cookies && cookies.length > 0) {
    await page.setCookie(...cookies);
    console.log('Injected session cookies successfully.');
  }
}

module.exports = {
  createStealthBrowser,
  performPlatformAction,
  injectSessionCookies,
};
