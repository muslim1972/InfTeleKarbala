export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    
    try {
        const url = new URL(req.url, `http://${req.headers.host}`);
        const path = url.pathname.replace('/deezer-api', '');
        const query = url.search;
        
        const response = await fetch(`https://api.deezer.com${path}${query}`);
        const data = await response.json();
        res.status(200).json(data);
    } catch (error) {
        console.error('Deezer proxy error:', error);
        res.status(500).json({ error: 'Proxy error' });
    }
}
