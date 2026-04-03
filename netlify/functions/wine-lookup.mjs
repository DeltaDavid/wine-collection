export default async (req) => {
  const url = new URL(req.url);
  const query = url.searchParams.get('q');

  if (!query) {
    return new Response(JSON.stringify({ error: 'Missing q parameter' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }

  try {
    // Search Vivino's API
    const vivinoUrl = `https://www.vivino.com/api/explore/explore?q=${encodeURIComponent(query)}&limit=5`;
    const resp = await fetch(vivinoUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'application/json'
      }
    });

    if (!resp.ok) {
      // Fallback: try a simpler Vivino search
      const fallbackUrl = `https://www.vivino.com/api/wines/search?q=${encodeURIComponent(query)}`;
      const fallbackResp = await fetch(fallbackUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Accept': 'application/json'
        }
      });
      if (!fallbackResp.ok) {
        return new Response(JSON.stringify({ error: 'Wine search unavailable', status: resp.status }), {
          status: 502,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }
      const fallbackData = await fallbackResp.json();
      return new Response(JSON.stringify(fallbackData), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    const data = await resp.json();

    // Parse Vivino explore results into clean format
    const matches = (data.explore_vintage?.matches || []).map(match => {
      const wine = match.vintage?.wine || {};
      const vintage = match.vintage || {};
      return {
        wine: wine.name || '',
        winery: wine.winery?.name || '',
        type: wine.type_id === 1 ? 'Red' : wine.type_id === 2 ? 'White' : wine.type_id === 3 ? 'Sparkling' : wine.type_id === 4 ? 'Rosé' : wine.type_id === 24 ? 'Dessert' : 'Unknown',
        country: wine.region?.country?.name || '',
        region: wine.region?.name || '',
        grape: (wine.grapes || []).map(g => g.name).join(', ') || 'Blend',
        rating: Math.round((wine.statistics?.wine_ratings_average || 0) * 10) / 10,
        image: vintage.image?.location || wine.image?.location || '',
        vivino_url: wine.seo_name ? `https://www.vivino.com/w/${wine.id}` : ''
      };
    }).filter(m => m.wine);

    return new Response(JSON.stringify({ results: matches }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
};
