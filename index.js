const express = require('express');
const fetch = require('node-fetch');
const app = express();

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  next();
});

app.get('/', (req, res) => res.json({ status: 'ok', service: 'sentinel-proxy v4' }));

// Cache to avoid hammering Twitter
const cache = {};
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

app.get('/twitter/:handle', async (req, res) => {
  const handle = req.params.handle;
  
  // Return cache if fresh
  if (cache[handle] && Date.now() - cache[handle].ts < CACHE_TTL) {
    return res.json(cache[handle].data);
  }

  try {
    const tweets = [];
    
    // Try multiple public tweet sources
    const sources = [
      // Nitter public instances - RSS
      `https://nitter.privacydev.net/${handle}/rss`,
      `https://nitter.poast.org/${handle}/rss`,
      `https://nitter.net/${handle}/rss`,
      `https://nitter.cz/${handle}/rss`,
    ];

    for (const src of sources) {
      try {
        const r = await fetch(src, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Referer': 'https://www.google.com/',
          },
          timeout: 8000
        });
        
        if (!r.ok) continue;
        const xml = await r.text();
        if (!xml || !xml.includes('<item')) continue;

        // Parse RSS
        const items = xml.match(/<item>([\s\S]*?)<\/item>/gi) || [];
        for (const item of items.slice(0, 6)) {
          const titleMatch = item.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/);
          const linkMatch = item.match(/<link>(.*?)<\/link>/);
          const dateMatch = item.match(/<pubDate>(.*?)<\/pubDate>/);
          
          if (!titleMatch) continue;
          let text = titleMatch[1]
            .replace(/^R @\S+: /i, '')
            .replace(/^RT @\S+: /i, '')
            .trim();
          
          if (!text || text.length < 5) continue;
          tweets.push({
            text,
            time: dateMatch ? dateMatch[1] : new Date().toISOString(),
            url: linkMatch ? linkMatch[1].trim() : `https://x.com/${handle}`
          });
        }
        
        if (tweets.length > 0) break; // Got tweets, stop trying sources
      } catch (e) { continue; }
    }

    const result = { tweets, ok: true, count: tweets.length };
    cache[handle] = { ts: Date.now(), data: result };
    res.json(result);
  } catch (e) {
    res.json({ tweets: [], error: e.message });
  }
});

app.listen(process.env.PORT || 3000, () => console.log('Sentinel proxy v4 running'));
