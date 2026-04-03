export default async (req) => {
  const url = new URL(req.url);
  const query = url.searchParams.get('q');
  const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };

  if (!query) {
    return new Response(JSON.stringify({ error: 'Missing q parameter' }), { status: 400, headers });
  }

  try {
    const r = await fetch(`https://www.vivino.com/search/wines?q=${encodeURIComponent(query)}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      redirect: 'follow'
    });

    if (!r.ok) {
      return new Response(JSON.stringify({ results: [], error: 'Vivino returned ' + r.status }), { headers });
    }

    const html = await r.text();
    const jsonPattern = /<script[^>]*data-component-name="ExplorePage"[^>]*>([\s\S]*?)<\/script>/;
    const jsonMatch = html.match(jsonPattern);
    if (!jsonMatch) {
      return new Response(JSON.stringify({ results: [], error: 'No wine data found' }), { headers });
    }

    const data = JSON.parse(jsonMatch[1]);
    const props = data.props || data;
    const exploreResults = props.initialExploreResults || {};
    const matches = exploreResults.matches || exploreResults.explore_vintage?.matches || [];

    const typeMap = {1:'red',2:'white',3:'sparkling',4:'rosé',24:'dessert',7:'fortified'};
    const seen = new Set();
    const results = [];

    for (const match of matches) {
      const vintage = match.vintage || match;
      const wine = vintage.wine || vintage;
      const name = wine.name || '';
      const winery = wine.winery?.name || '';
      const key = name + '|' + winery;
      if (!name || seen.has(key)) continue;
      seen.add(key);

      let img = vintage.image?.location || wine.image?.location || '';
      if (img && img.startsWith('//')) img = 'https:' + img;

      results.push({
        wine: name,
        winery: winery,
        type: typeMap[wine.type_id] || '',
        country: wine.region?.country?.name || '',
        region: wine.region?.name || '',
        grape: (wine.grapes || []).map(g => g.name).join(', ') || '',
        rating: Math.round((wine.statistics?.wine_ratings_average || 0) * 10) / 10,
        image: img,
        vivino_url: wine.id ? 'https://www.vivino.com/w/' + wine.id : ''
      });
      if (results.length >= 8) break;
    }

    return new Response(JSON.stringify({ results }), { headers });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers });
  }
};
