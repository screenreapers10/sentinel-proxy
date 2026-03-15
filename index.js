const express = require('express');
const app = express();

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  next();
});

const BEARER = 'AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA';

app.get('/twitter/:handle', async (req, res) => {
  const handle = req.params.handle;
  try {
    const userRes = await fetch(
      `https://x.com/i/api/graphql/xmU6X_CKVnQ5lSrsBuKdhQ/UserByScreenName?variables=${encodeURIComponent(JSON.stringify({screen_name:handle,withSafetyModeUserFields:true}))}&features=${encodeURIComponent(JSON.stringify({hidden_profile_likes_enabled:true,hidden_profile_subscriptions_enabled:true,responsive_web_graphql_exclude_directive_enabled:true,verified_phone_label_enabled:false,subscriptions_verification_info_is_identity_verified_enabled:true,subscriptions_verification_info_verified_since_enabled:true,highlights_tweets_tab_ui_enabled:true,responsive_web_twitter_article_notes_tab_enabled:false,creator_subscriptions_tweet_preview_api_enabled:true,responsive_web_graphql_skip_user_profile_image_extensions_enabled:false,responsive_web_graphql_timeline_navigation_enabled:true}))}`,
      { headers: { 'Authorization': `Bearer ${BEARER}`, 'x-twitter-active-user': 'yes', 'x-twitter-client-language': 'en', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } }
    );
    const userData = await userRes.json();
    const userId = userData?.data?.user?.result?.rest_id;
    if (!userId) return res.json({ tweets: [], error: 'User not found' });

    const tlRes = await fetch(
      `https://x.com/i/api/graphql/V1ze5q3ijDS1VeLwLY0m7g/UserTweets?variables=${encodeURIComponent(JSON.stringify({userId,count:8,includePromotedContent:false,withQuickPromoteEligibilityTweetFields:true,withVoice:true,withV2Timeline:true}))}&features=${encodeURIComponent(JSON.stringify({rweb_lists_timeline_redesign_enabled:true,responsive_web_graphql_exclude_directive_enabled:true,verified_phone_label_enabled:false,creator_subscriptions_tweet_preview_api_enabled:true,responsive_web_graphql_timeline_navigation_enabled:true,responsive_web_graphql_skip_user_profile_image_extensions_enabled:false,tweetypie_unmention_optimization_enabled:true,responsive_web_edit_tweet_api_enabled:true,graphql_is_translatable_rweb_tweet_is_translatable_enabled:true,view_counts_everywhere_api_enabled:true,longform_notetweets_consumption_enabled:true,responsive_web_twitter_article_tweet_consumption_enabled:false,tweet_awards_web_tipping_enabled:false,freedom_of_speech_not_reach_fetch_enabled:true,standardized_nudges_misinfo:true,tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled:true,longform_notetweets_rich_text_read_enabled:true,longform_notetweets_inline_media_enabled:true,responsive_web_enhance_cards_enabled:false}))}`,
      { headers: { 'Authorization': `Bearer ${BEARER}`, 'x-twitter-active-user': 'yes', 'x-twitter-client-language': 'en', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } }
    );
    const tlData = await tlRes.json();
    const entries = tlData?.data?.user?.result?.timeline_v2?.timeline?.instructions?.find(i => i.type === 'TimelineAddEntries')?.entries || [];
    const tweets = [];
    for (const entry of entries) {
      try {
        const tw = entry?.content?.itemContent?.tweet_results?.result;
        const legacy = tw?.legacy || tw?.tweet?.legacy;
        if (!legacy || legacy.retweeted_status_id_str) continue;
        const text = (legacy.full_text || '').replace(/https:\/\/t\.co\/\S+/g, '').trim();
        if (!text) continue;
        tweets.push({ text, time: legacy.created_at, url: `https://x.com/${handle}/status/${legacy.id_str}` });
        if (tweets.length >= 6) break;
      } catch (e) {}
    }
    res.json({ tweets, ok: true });
  } catch (e) {
    res.json({ tweets: [], error: e.message });
  }
});

app.listen(process.env.PORT || 3000, () => console.log('Proxy running'));
