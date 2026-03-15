const express = require('express');
const puppeteer = require('puppeteer');
const app = express();

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  next();
});

app.get('/', (req, res) => res.json({ status: 'ok', service: 'sentinel-proxy v2' }));

let browser;
async function getBrowser() {
  if (!browser) {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--disable-accelerated-2d-canvas','--no-first-run','--no-zygote','--single-process','--disable-gpu']
    });
  }
  return browser;
}

app.get('/twitter/:handle', async (req, res) => {
  const handle = req.params.handle;
  let page;
  try {
    const b = await getBrowser();
    page = await b.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36');
    await page.setExtraHTTPHeaders({'Accept-Language':'en-US,en;q=0.9'});

    const tweets = [];
    page.on('response', async response => {
      const url = response.url();
      if (url.includes('UserTweets') && response.status() === 200) {
        try {
          const json = await response.json();
          const entries = json?.data?.user?.result?.timeline_v2?.timeline?.instructions
            ?.find(i => i.type === 'TimelineAddEntries')?.entries || [];
          for (const entry of entries) {
            try {
              const tw = entry?.content?.itemContent?.tweet_results?.result;
              const legacy = tw?.legacy || tw?.tweet?.legacy;
              if (!legacy || legacy.retweeted_status_id_str) continue;
              const text = (legacy.full_text || '').replace(/https:\/\/t\.co\/\S+/g, '').trim();
              if (!text || tweets.length >= 6) continue;
              tweets.push({ text, time: legacy.created_at, url: `https://x.com/${handle}/status/${legacy.id_str}` });
            } catch(e) {}
          }
        } catch(e) {}
      }
    });

    await page.goto(`https://x.com/${handle}`, { waitUntil: 'networkidle2', timeout: 25000 });
    await new Promise(r => setTimeout(r, 3000));
    await page.close();
    res.json({ tweets: tweets.slice(0,6), ok: true });
  } catch(e) {
    if (page) await page.close().catch(()=>{});
    if (browser) { await browser.close().catch(()=>{}); browser = null; }
    res.json({ tweets: [], error: e.message });
  }
});

app.listen(process.env.PORT || 3000, () => console.log('Sentinel proxy v2 running'));
