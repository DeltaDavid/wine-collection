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

    // Vivino uses React on Rails - wine data is in ExplorePage component
    const jsonPattern = /<script[^>]*data-component-name="ExplorePage"[^>]*>([\s\S]*?)<\/script>/;
    const jsonMatch = html.match(jsonPattern);
    if (!jsonMatch) {
      return new Response(JSON.stringify({ results: [], error: 'No ExplorePage data found' }), { headers });
    }

    const data = JSON.parse(jsonMatch[1]);
    const props = data.props || data;
    
    // Wine results are in initialExploreResults
    const exploreResults = props.initialExploreResults || {};
    const matches = exploreResults.matches || 
                   exploreResults.explore_vintage?.matches || 
                   exploreResults.records?.matches || [];

    const typeMap = {1:'red',2:'white',3:'sparkling',4:'rosé',24:'dessert',7:'fortified'};
    const results = matches.slice(0, 8).map(match => {
      const vintage = match.vintage || match;
      const wine = vintage.wine || vintage;
      return {
        wine: wine.name || '',
        winery: wine.winery?.name || '',
        type: typeMap[wine.type_id] || '',
        country: wine.region?.country?.name || '',
        region: wine.region?.name || '',
        grape: (wine.grapes || []).map(g => g.name).join(', ') || '',
        rating: Math.round((wine.statistics?.wine_ratings_average || 0) * 10) / 10,
        image: vintage.image?.location || wine.image?.location || '',
        vivino_url: wine.id ? 'https://www.vivino.com/w/' + wine.id : ''
      };
    }).filter(m => m.wine);

    if (results.length) {
      return new Response(JSON.stringify({ results }), { headers });
    }

    // Debug: show what's actually in initialExploreResults
    return new Response(JSON.stringify({ 
      results: [], 
      explore_keys: Object.keys(exploreResults),
      explore_sample: JSON.stringify(exploreResults).substring(0, 500)
    }), { headers });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers });
  }
};
