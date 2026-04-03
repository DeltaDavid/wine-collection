export default async (req) => {
  const url = new URL(req.url);
  const query = url.searchParams.get('q');
  const debug = url.searchParams.get('debug');
  const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };

  if (!query) {
    return new Response(JSON.stringify({ error: 'Missing q parameter' }), { status: 400, headers });
  }

  const attempts = [];

  // Attempt 1: Vivino explore POST (mobile app style)
  try {
    const r1 = await fetch('https://www.vivino.com/api/explore/explore', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Vivino/8.18.12 CFNetwork/1568.200.51 Darwin/24.1.0',
        'Accept': 'application/json',
        'X-Requested-With': 'com.vivino.app'
      },
      body: JSON.stringify({ q: query, limit: 8, page: 1, currency_code: 'USD', language: 'en' })
    });
    attempts.push({ method: 'explore-post', status: r1.status });
    if (r1.ok) {
      const data = await r1.json();
      const results = parseExploreResults(data);
      if (results.length) return new Response(JSON.stringify({ results, via: 'explore-post' }), { headers });
    }
  } catch (e) { attempts.push({ method: 'explore-post', error: e.message }); }

  // Attempt 2: Vivino explore GET
  try {
    const r2 = await fetch(`https://www.vivino.com/api/explore/explore?q=${encodeURIComponent(query)}&limit=8`, {
      headers: {
        'User-Agent': 'Vivino/8.18.12 CFNetwork/1568.200.51 Darwin/24.1.0',
        'Accept': 'application/json'
      }
    });
    attempts.push({ method: 'explore-get', status: r2.status });
    if (r2.ok) {
      const data = await r2.json();
      const results = parseExploreResults(data);
      if (results.length) return new Response(JSON.stringify({ results, via: 'explore-get' }), { headers });
    }
  } catch (e) { attempts.push({ method: 'explore-get', error: e.message }); }

  // Attempt 3: Vivino autocomplete/search suggestions
  try {
    const r3 = await fetch(`https://www.vivino.com/api/search/suggestions?q=${encodeURIComponent(query)}&types[]=wine`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
        'Accept': 'application/json',
        'Referer': 'https://www.vivino.com/'
      }
    });
    attempts.push({ method: 'suggestions', status: r3.status });
    if (r3.ok) {
      const data = await r3.json();
      const results = parseSuggestionResults(data);
      if (results.length) return new Response(JSON.stringify({ results, via: 'suggestions' }), { headers });
    }
  } catch (e) { attempts.push({ method: 'suggestions', error: e.message }); }

  // Attempt 4: Vivino search wines page (scrape __NEXT_DATA__)
  try {
    const r4 = await fetch(`https://www.vivino.com/search/wines?q=${encodeURIComponent(query)}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      redirect: 'follow'
    });
    attempts.push({ method: 'html-scrape', status: r4.status });
    if (r4.ok) {
      const html = await r4.text();
      const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
      if (match) {
        try {
          const nd = JSON.parse(match[1]);
          const vintages = nd?.props?.pageProps?.vintages || nd?.props?.pageProps?.wines || [];
          const results = vintages.slice(0, 8).map(v => {
            const w = v.wine || v;
            return {
              wine: w.name || v.name || '', winery: w.winery?.name || '',
              type: '', country: w.region?.country?.name || '',
              region: w.region?.name || '', grape: '',
              rating: w.statistics?.wine_ratings_average || 0,
              image: v.image?.location || w.image?.location || '', vivino_url: ''
            };
          }).filter(m => m.wine);
          if (results.length) return new Response(JSON.stringify({ results, via: 'html-scrape' }), { headers });
        } catch(pe) { attempts.push({ method: 'html-parse', error: pe.message }); }
      } else {
        attempts.push({ method: 'html-scrape', note: 'no __NEXT_DATA__ found', htmlLen: (await r4.text()).length || 'consumed' });
      }
    }
  } catch (e) { attempts.push({ method: 'html-scrape', error: e.message }); }

  // Return debug info if nothing worked
  return new Response(JSON.stringify({ results: [], attempts, message: 'All search methods failed' }), { headers });
};

function parseExploreResults(data) {
  const typeMap = {1:'red',2:'white',3:'sparkling',4:'rosé',24:'dessert',7:'fortified'};
  return (data.explore_vintage?.matches || []).map(match => {
    const wine = match.vintage?.wine || {};
    const vintage = match.vintage || {};
    return {
      wine: wine.name || '', winery: wine.winery?.name || '',
      type: typeMap[wine.type_id] || 'unknown',
      country: wine.region?.country?.name || '',
      region: wine.region?.name || '',
      grape: (wine.grapes || []).map(g => g.name).join(', ') || 'Blend',
      rating: Math.round((wine.statistics?.wine_ratings_average || 0) * 10) / 10,
      image: vintage.image?.location || wine.image?.location || '',
      vivino_url: wine.id ? 'https://www.vivino.com/w/' + wine.id : ''
    };
  }).filter(m => m.wine);
}

function parseSuggestionResults(data) {
  const wines = data.wines || data.suggestions?.wines || data.results || [];
  return wines.slice(0, 8).map(w => ({
    wine: w.name || w.wine_name || '', winery: w.winery?.name || w.winery_name || '',
    type: w.type || '', country: w.country || w.region?.country?.name || '',
    region: w.region?.name || w.region_name || '', grape: w.grape || '',
    rating: w.rating || w.statistics?.wine_ratings_average || 0,
    image: w.image?.location || w.thumb || '', vivino_url: ''
  })).filter(m => m.wine);
}
