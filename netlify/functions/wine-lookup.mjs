export default async (req) => {
  const url = new URL(req.url);
  const query = url.searchParams.get('q');
  const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };

  if (!query) {
    return new Response(JSON.stringify({ error: 'Missing q parameter' }), { status: 400, headers });
  }

  try {
    // Fetch Vivino search page (this works from Netlify - returns 200)
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

    // Try __NEXT_DATA__ first
    const nextMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (nextMatch) {
      try {
        const nd = JSON.parse(nextMatch[1]);
        // Navigate the Next.js data structure to find wine results
        const pageProps = nd?.props?.pageProps || {};
        const vintages = pageProps.vintages || pageProps.wines || pageProps.results || 
                        pageProps.searchResults?.vintages || pageProps.searchResults?.results || [];
        const results = vintages.slice(0, 8).map(v => {
          const w = v.wine || v;
          return {
            wine: w.name || v.name || '', winery: w.winery?.name || '',
            type: w.type_id ? ({1:'red',2:'white',3:'sparkling',4:'rosé',24:'dessert',7:'fortified'}[w.type_id] || '') : '',
            country: w.region?.country?.name || '',
            region: w.region?.name || '',
            grape: (w.grapes || []).map(g => g.name).join(', ') || '',
            rating: w.statistics?.wine_ratings_average || 0,
            image: v.image?.location || w.image?.location || '',
            vivino_url: w.id ? 'https://www.vivino.com/w/' + w.id : ''
          };
        }).filter(m => m.wine);
        if (results.length) return new Response(JSON.stringify({ results }), { headers });
        // If we found __NEXT_DATA__ but no results, return the keys for debugging
        return new Response(JSON.stringify({ results: [], debug_keys: Object.keys(pageProps) }), { headers });
      } catch(pe) {
        return new Response(JSON.stringify({ results: [], parse_error: pe.message }), { headers });
      }
    }

    // Fallback: scrape wine cards from HTML using regex
    // Vivino wine cards have data attributes or structured content we can parse
    const cardPattern = /<a[^>]*class="[^"]*wineCard[^"]*"[^>]*href="([^"]*)"[^>]*>[\s\S]*?<span[^>]*class="[^"]*wineCard__wineName[^"]*"[^>]*>([^<]*)<\/span>[\s\S]*?<span[^>]*class="[^"]*wineCard__winery[^"]*"[^>]*>([^<]*)<\/span>/gi;
    const cardResults = [];
    let cardMatch;
    while ((cardMatch = cardPattern.exec(html)) && cardResults.length < 8) {
      cardResults.push({
        wine: cardMatch[2].trim(), winery: cardMatch[3].trim(),
        type: '', country: '', region: '', grape: '', rating: 0,
        image: '', vivino_url: 'https://www.vivino.com' + cardMatch[1]
      });
    }
    if (cardResults.length) return new Response(JSON.stringify({ results: cardResults }), { headers });

    // Fallback 2: look for JSON-LD structured data
    const jsonLdMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    if (jsonLdMatch) {
      try {
        const ld = JSON.parse(jsonLdMatch[1]);
        if (ld.itemListElement) {
          const results = ld.itemListElement.slice(0, 8).map(item => ({
            wine: item.name || '', winery: item.brand?.name || '',
            type: '', country: '', region: '', grape: '',
            rating: item.aggregateRating?.ratingValue || 0,
            image: item.image || '', vivino_url: item.url || ''
          })).filter(m => m.wine);
          if (results.length) return new Response(JSON.stringify({ results }), { headers });
        }
      } catch(e) {}
    }

    // Nothing found - return debug info about what's in the HTML
    const scriptTags = (html.match(/<script[^>]*id="[^"]*"/g) || []).join(', ');
    return new Response(JSON.stringify({ 
      results: [], 
      htmlLen: html.length,
      hasNextData: html.includes('__NEXT_DATA__'),
      hasWineCard: html.includes('wineCard'),
      scriptIds: scriptTags.substring(0, 500),
      htmlSample: html.substring(0, 500)
    }), { headers });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers });
  }
};
