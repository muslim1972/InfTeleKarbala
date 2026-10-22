import http.server
import socketserver
import os
import urllib.parse

PORT = 3001
DIR_MAIN = "/home/muslim/inftelekarbala/dist"
DIR_BAND = "/home/muslim/intkarbala/dist"

STATIC_EXTENSIONS = (
    ".js", ".css", ".woff2", ".woff", ".ttf", ".png", ".jpg", 
    ".jpeg", ".webp", ".svg", ".ico", ".webmanifest", ".mp4", 
    ".bin", ".json"
)

class MultiSPARequestHandler(http.server.SimpleHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def get_context(self):
        host = (
            self.headers.get("X-Forwarded-Host", "") or 
            self.headers.get("Host", "") or 
            self.headers.get("X-Original-Host", "") or
            ""
        ).lower()
        
        raw_path = urllib.parse.urlparse(self.path).path
        parsed_path = urllib.parse.unquote(raw_path)
        
        if "band" in host:
            return DIR_BAND, parsed_path, True

        if parsed_path == "/band" or parsed_path.startswith("/band/"):
            sub_path = parsed_path[5:]
            if not sub_path.startswith("/"):
                sub_path = "/" + sub_path
            return DIR_BAND, sub_path, True

        return DIR_MAIN, parsed_path, False

    def send_response(self, code, message=None):
        self._response_code = code
        super().send_response(code, message)

    def end_headers(self):
        self.send_header("X-Content-Type-Options", "nosniff")
        
        # Security headers for ALL paths including static files and favicon.ico
        csp = (
            "default-src 'self'; "
            "script-src 'self' https://edge-consumer-static.azureedge.net https://cdn.onesignal.com; "
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
            "font-src 'self' data: https://fonts.gstatic.com; "
            "img-src 'self' data: blob: https://edge-consumer-static.azureedge.net https://cdn.onesignal.com; "
            "connect-src 'self' wss://khr-itpc.egov.iq https://cdn.onesignal.com https://onesignal.com https://edge-consumer-static.azureedge.net https://maps.mail.ru https://overpass.kumi.systems https://overpass.private.coffee; "
            "media-src 'self' blob:; "
            "object-src 'none'; "
            "frame-ancestors 'self' https://khr-itpc.egov.iq; "
            "worker-src 'self' blob:; "
            "frame-src 'self'; "
            "form-action 'self'"
        )
        self.send_header("Content-Security-Policy", csp)
        self.send_header("Referrer-Policy", "strict-origin-when-cross-origin")

        status = getattr(self, "_response_code", 200)
        raw_path = urllib.parse.urlparse(self.path).path
        parsed_path = urllib.parse.unquote(raw_path)
        
        if status in (200, 206) and any(parsed_path.endswith(ext) for ext in STATIC_EXTENSIONS):
            self.send_header("Cache-Control", "public, max-age=604800, immutable")
            self.send_header("Accept-Ranges", "bytes")
        else:
            self.send_header("Cache-Control", "no-cache, no-store, must-revalidate, max-age=0")
            self.send_header("Pragma", "no-cache")
            self.send_header("Expires", "0")
        
        super().end_headers()

    def _serve_file_with_range(self, local_path, method):
        try:
            file_size = os.path.getsize(local_path)
            ctype = self.guess_type(local_path)
            range_header = self.headers.get("Range")
            
            if range_header and range_header.startswith("bytes="):
                try:
                    ranges = range_header[6:].split("-")
                    start = int(ranges[0]) if ranges[0] else 0
                    end = int(ranges[1]) if len(ranges) > 1 and ranges[1] else file_size - 1
                    
                    if start >= file_size or end >= file_size or start > end:
                        self.send_response(416, "Requested Range Not Satisfiable")
                        self.send_header("Content-Range", f"bytes */{file_size}")
                        self.end_headers()
                        return

                    length = end - start + 1
                    self.send_response(206, "Partial Content")
                    self.send_header("Content-Type", ctype)
                    self.send_header("Content-Range", f"bytes {start}-{end}/{file_size}")
                    self.send_header("Content-Length", str(length))
                    self.end_headers()
                    
                    if method == "GET":
                        with open(local_path, "rb") as f:
                            f.seek(start)
                            remaining = length
                            chunk_size = 64 * 1024
                            while remaining > 0:
                                read_bytes = min(remaining, chunk_size)
                                data = f.read(read_bytes)
                                if not data:
                                    break
                                self.wfile.write(data)
                                remaining -= len(data)
                    return
                except (BrokenPipeError, ConnectionResetError):
                    return
                except Exception:
                    pass

            self.send_response(200, "OK")
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(file_size))
            self.send_header("Accept-Ranges", "bytes")
            self.end_headers()
            if method == "GET":
                with open(local_path, "rb") as f:
                    chunk_size = 64 * 1024
                    while True:
                        data = f.read(chunk_size)
                        if not data:
                            break
                        self.wfile.write(data)
            return
        except (BrokenPipeError, ConnectionResetError):
            pass
        except Exception as e:
            self.send_error(500, f"Internal server error: {e}")

    def _handle_spa(self, method):
        root, clean_path, is_band = self.get_context()
        self.directory = root
        
        local_path = os.path.normpath(os.path.join(root, clean_path.lstrip("/")))
        
        if os.path.isfile(local_path):
            return self._serve_file_with_range(local_path, method)
        
        if "." in os.path.basename(clean_path):
            self.send_error(404, "File not found")
            return

        index_path = os.path.join(root, "index.html")
        if os.path.isfile(index_path):
            return self._serve_file_with_range(index_path, method)

        self.send_error(404, "Index not found")

    def do_GET(self):
        return self._handle_spa("GET")

    def do_HEAD(self):
        return self._handle_spa("HEAD")

if __name__ == "__main__":
    server = http.server.ThreadingHTTPServer(("0.0.0.0", PORT), MultiSPARequestHandler)
    server.daemon_threads = True
    print(f"Multi-SPA Threaded Server running on port {PORT}")
    server.serve_forever()
