const express = require('express');
const app = express();

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', '*');
  next();
});

// Health check
app.get('/', (req, res) => res.json({ status: 'ok', service: 'sentinel-proxy' }));

app.get('/twitter/:handle', async (req, res) => {
  const handle = req.params.handle;
  try {
    // Use Syndication API — different endpoint, works from server IPs
    const url = `https://cdn.syndication.twimg.com/timeline/profile?screen_name=${handle}&count=10&lang=en`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/javascript, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://platform.twitter.com/',
        'Origin': 'https://platform.twitter.com',
      }
    });

    if (!response.ok) {
      return res.json({ tweets: [], error: `Syndication ${response.status}` });
    }

    const data = await response.json();
    const tweets = [];

    // Parse syndication timeline response
    const items = data?.timeline?.instructions?.[0]?.addEntries?.entries || 
                  data?.globalObjects?.tweets ? Object.values(data.globalObjects.tweets) : [];

    if (items.length === 0 && data.body) {
      // Try alternate parsing
      const bodyItems = data.body?.value?.timeline?.instructions?.[0]?.addEntries?.entries || [];
      for (const entry of bodyItems) {
        try {
          const content = entry?.content?.item?.content?.tweet;
          if (!content) continue;
          const tweet = data.body?.value?.globalObjects?.tweets?.[content.id];
          if (!tweet) continue;
          if (tweet.retweeted_status_id_str) continue;
          const text = (tweet.full_text || tweet.text || '').replace(/https:\/\/t\.co\/\S+/g, '').trim();
          if (!text) continue;
          tweets.push({
            text,
            time: tweet.created_at,
            url: `https://x.com/${handle}/status/${tweet.id_str}`
          });
          if (tweets.length >= 6) break;
        } catch (e) {}
      }
    } else {
      for (const tweet of items.slice(0, 10)) {
        try {
          if (tweet.retweeted_status_id_str) continue;
          const text = (tweet.full_text || tweet.text || '').replace(/https:\/\/t\.co\/\S+/g, '').trim();
          if (!text) continue;
          tweets.push({
            text,
            time: tweet.created_at,
            url: `https://x.com/${handle}/status/${tweet.id_str}`
          });
          if (tweets.length >= 6) break;
        } catch (e) {}
      }
    }

    res.json({ tweets, ok: true, count: tweets.length });
  } catch (e) {
    res.json({ tweets: [], error: e.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Sentinel proxy running on ${PORT}`));
