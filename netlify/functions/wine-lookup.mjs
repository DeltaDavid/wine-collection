export default async (req) => {
  const url = new URL(req.url);
  const query = url.searchParams.get('q');
  const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };

  if (!query) {
    return new Response(JSON.stringify({ error: 'Missing q parameter' }), { status: 400, headers });
  }

  try {
    // Vivino explore endpoint with POST body (their app uses this format)
    const vivinoResp = await fetch('https://www.vivino.com/api/explore/explore', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Vivino/8.18.12 (iPhone; iOS 17.0; Scale/3.00)',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        q: query,
        limit: 8,
        page: 1,
        currency_code: 'USD',
        language: 'en'
      })
    });

    if (vivinoResp.ok) {
      const data = await vivinoResp.json();
      const matches = (data.explore_vintage?.matches || []).map(match => {
        const wine = match.vintage?.wine || {};
        const vintage = match.vintage || {};
        const typeMap = {1:'red',2:'white',3:'sparkling',4:'rosé',24:'dessert',7:'fortified'};
        return {
          wine: wine.name || '',
          winery: wine.winery?.name || '',
          type: typeMap[wine.type_id] || 'unknown',
          country: wine.region?.country?.name || '',
          region: wine.region?.name || '',
          grape: (wine.grapes || []).map(g => g.name).join(', ') || 'Blend',
          rating: Math.round((wine.statistics?.wine_ratings_average || 0) * 10) / 10,
          image: vintage.image?.location || wine.image?.location || '',
          vivino_url: wine.id ? 'https://www.vivino.com/w/' + wine.id : ''
        };
      }).filter(m => m.wine);

      if (matches.length) {
        return new Response(JSON.stringify({ results: matches }), { headers });
      }
    }

    // Fallback: GET with query params
    const fallbackUrl = 'https://www.vivino.com/api/explore/explore?' + new URLSearchParams({
      q: query, limit: '8', page: '1', currency_code: 'USD', language: 'en'
    });
    const fallbackResp = await fetch(fallbackUrl, {
      headers: {
        'User-Agent': 'Vivino/8.18.12 (iPhone; iOS 17.0; Scale/3.00)',
        'Accept': 'application/json'
      }
    });

    if (fallbackResp.ok) {
      const data = await fallbackResp.json();
      const matches = (data.explore_vintage?.matches || []).map(match => {
        const wine = match.vintage?.wine || {};
        const vintage = match.vintage || {};
        const typeMap = {1:'red',2:'white',3:'sparkling',4:'rosé',24:'dessert',7:'fortified'};
        return {
          wine: wine.name || '',
          winery: wine.winery?.name || '',
          type: typeMap[wine.type_id] || 'unknown',
          country: wine.region?.country?.name || '',
          region: wine.region?.name || '',
          grape: (wine.grapes || []).map(g => g.name).join(', ') || 'Blend',
          rating: Math.round((wine.statistics?.wine_ratings_average || 0) * 10) / 10,
          image: vintage.image?.location || wine.image?.location || '',
          vivino_url: wine.id ? 'https://www.vivino.com/w/' + wine.id : ''
        };
      }).filter(m => m.wine);

      if (matches.length) {
        return new Response(JSON.stringify({ results: matches }), { headers });
      }
    }

    // Final fallback: search HTML page and extract __NEXT_DATA__
    const htmlResp = await fetch('https://www.vivino.com/search/wines?q=' + encodeURIComponent(query), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml'
      }
    });

    if (htmlResp.ok) {
      const html = await htmlResp.text();
      const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
      if (nextDataMatch) {
        const nextData = JSON.parse(nextDataMatch[1]);
        const wines = nextData?.props?.pageProps?.wines || nextData?.props?.pageProps?.results || [];
        const matches = wines.slice(0, 8).map(w => ({
          wine: w.name || w.vintage?.wine?.name || '',
          winery: w.winery?.name || w.vintage?.wine?.winery?.name || '',
          type: '',
          country: w.region?.country?.name || '',
          region: w.region?.name || '',
          grape: '',
          rating: w.statistics?.wine_ratings_average || 0,
          image: w.image?.location || w.vintage?.image?.location || '',
          vivino_url: ''
        })).filter(m => m.wine);

        if (matches.length) {
          return new Response(JSON.stringify({ results: matches }), { headers });
        }
      }
    }

    return new Response(JSON.stringify({ results: [], message: 'No results found' }), { headers });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers });
  }
};
