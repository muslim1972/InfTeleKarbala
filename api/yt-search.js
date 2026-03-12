export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    
    const { q } = req.query;
    if (!q) return res.status(400).json({ error: 'Missing query' });

    try {
        // Search YouTube for the video
        // sp=EgIQAQ%253D%253D filters for videos only
        const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}&sp=EgIQAQ%253D%253D`;
        
        const response = await fetch(searchUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept-Language': 'en-US,en;q=0.9',
            }
        });

        const html = await response.text();
        
        // Extract videoId using a robust regex that handles both quoted and unquoted formats
        // Looking for "videoId":"XXXXXXXXXXX" inside the ytInitialData JSON
        const match = html.match(/"videoId"\s*:\s*"([a-zA-Z0-9_-]{11})"/);
        
        if (match && match[1]) {
            return res.status(200).json({ videoId: match[1] });
        }

        // Fallback: try older format or different scraping logic
        const fallbackMatch = html.match(/\/watch\?v=([a-zA-Z0-9_-]{11})/);
        if (fallbackMatch && fallbackMatch[1]) {
            return res.status(200).json({ videoId: fallbackMatch[1] });
        }

        res.status(404).json({ error: 'No video found' });
    } catch (error) {
        console.error('YouTube search proxy error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}
