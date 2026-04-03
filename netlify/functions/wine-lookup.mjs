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

    // Vivino uses React on Rails - wine data is in ExplorePage component JSON
    const exploreMatch = html.match(/data-component-name="ExplorePage"[^>]*data-dom-id="[^"]*"[^>]*>/);
    if (exploreMatch) {
      // The JSON is in a separate script tag with the matching data-component-name
      // Format: <script type="application/json" class="js-react-on-rails-component" data-component-name="ExplorePage" ...>JSON_HERE</script>
      const jsonPattern = /<script[^>]*data-component-name="ExplorePage"[^>]*>([\s\S]*?)<\/script>/;
      const jsonMatch = html.match(jsonPattern);
      if (jsonMatch) {
        const data = JSON.parse(jsonMatch[1]);
        // Navigate the explore data structure
        const matches = data?.props?.explore_vintage?.matches || 
                       data?.explore_vintage?.matches ||
                       data?.props?.matches ||
                       data?.matches || [];
        
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

        // If we got the JSON but no matches, try top-level keys for debugging
        return new Response(JSON.stringify({ 
          results: [], 
          debug_keys: Object.keys(data?.props || data || {}),
          matchCount: matches.length
        }), { headers });
      }
    }

    // Fallback: try to find any JSON with wine data embedded in the page
    const allJsonScripts = html.matchAll(/<script type="application\/json"[^>]*>([\s\S]*?)<\/script>/g);
    for (const m of allJsonScripts) {
      try {
        const d = JSON.parse(m[1]);
        const str = JSON.stringify(d).substring(0, 200);
        if (str.includes('vintage') || str.includes('winery') || str.includes('wine_name')) {
          // Found wine data - try to extract
          return new Response(JSON.stringify({ results: [], found_json_sample: str }), { headers });
        }
      } catch(e) {}
    }

    return new Response(JSON.stringify({ results: [], message: 'Could not parse wine data from page' }), { headers });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers });
  }
};
