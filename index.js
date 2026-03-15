const express = require('express');
const fetch = require('node-fetch');
const app = express();

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  next();
});

app.get('/', (req, res) => res.json({ status: 'ok', service: 'sentinel-proxy v3' }));

app.get('/twitter/:handle', async (req, res) => {
  const handle = req.params.handle;
  try {
    // Use Twitter's own embed oEmbed endpoint — works from any IP
    const tweets = [];
    
    // Fetch the Twitter profile page via a public scraping service
    const url = `https://publish.twitter.com/oembed?url=https://twitter.com/${handle}&omit_script=true`;
    const r = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)',
        'Accept': 'application/json'
      }
    });
    
    if (!r.ok) {
      return res.json({ tweets: [], error: `oEmbed ${r.status}` });
    }
    
    const data = await r.json();
    // oEmbed returns latest tweet HTML — extract text
    const html = data.html || '';
    const textMatch = html.match(/<p[^>]*>(.*?)<\/p>/s);
    if (textMatch) {
      const text = textMatch[1]
        .replace(/<a[^>]*>.*?<\/a>/gs, '')
        .replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&#39;/g, "'")
        .trim();
      
      if (text) {
        tweets.push({
          text,
          time: new Date().toISOString(),
          url: `https://x.com/${handle}`
        });
      }
    }
    
    res.json({ tweets, ok: true });
  } catch (e) {
    res.json({ tweets: [], error: e.message });
  }
});

app.listen(process.env.PORT || 3000, () => console.log('Sentinel proxy v3 running'));
