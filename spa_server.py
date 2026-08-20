import http.server
import socketserver
import os
import urllib.parse

PORT = 3001
DIR_MAIN = '/home/muslim/inftelekarbala/dist'
DIR_BAND = '/home/muslim/intkarbala/dist'

class MultiSPARequestHandler(http.server.SimpleHTTPRequestHandler):
    # Enable HTTP/1.1 keep-alive
    protocol_version = 'HTTP/1.1'

    def get_directory(self):
        # Check all possible host headers from Kong and Reverse Proxies
        host = (
            self.headers.get('X-Forwarded-Host', '') or 
            self.headers.get('Host', '') or 
            self.headers.get('X-Original-Host', '') or
            ''
        ).lower()
        
        if 'band' in host:
            return DIR_BAND
        return DIR_MAIN

    def end_headers(self):
        # Add basic caching for static assets
        if any(self.path.endswith(ext) for ext in ['.js', '.css', '.woff2', '.woff', '.ttf', '.png', '.jpg', '.webp', '.svg', '.ico']):
            self.send_header('Cache-Control', 'public, max-age=86400')
        else:
            self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        super().end_headers()

    def do_GET(self):
        root = self.get_directory()
        self.directory = root
        
        # Parse URL path
        parsed_path = urllib.parse.urlparse(self.path).path
        local_path = os.path.normpath(os.path.join(root, parsed_path.lstrip('/')))
        
        # If path exists and is a file, serve it
        if os.path.isfile(local_path):
            return super().do_GET()
        
        # If it's a static file request with an extension that does not exist, return standard
        if '.' in os.path.basename(parsed_path):
            return super().do_GET()

        # Otherwise SPA fallback to index.html
        self.path = '/index.html'
        return super().do_GET()

if __name__ == '__main__':
    # Use ThreadingHTTPServer for high performance concurrent request handling
    server = http.server.ThreadingHTTPServer(('0.0.0.0', PORT), MultiSPARequestHandler)
    server.daemon_threads = True
    print(f'Multi-SPA Threaded Server running on port {PORT}')
    print(f'  - Main app: {DIR_MAIN}')
    print(f'  - Band app: {DIR_BAND}')
    server.serve_forever()
