const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('CONSOLE:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.toString()));
  
  await page.goto('https://aureoos.it');
  
  // wait 2 seconds
  await new Promise(r => setTimeout(r, 2000));
  
  await browser.close();
})();
