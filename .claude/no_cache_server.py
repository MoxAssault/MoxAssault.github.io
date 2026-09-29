"""Static file server that disables caching, for local dev/testing.

Usage: python .claude/no_cache_server.py [port]
"""
import http.server
import socket
import sys


class NoCacheHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()


class DualStackServer(http.server.ThreadingHTTPServer):
    """One thread per connection, so a client holding a connection open
    (a VS Code window did) cannot block every other request.
    Listens on IPv6 with IPv4 mapped in, so `localhost` works whether the
    browser resolves it to ::1 or 127.0.0.1."""
    address_family = socket.AF_INET6

    def server_bind(self):
        self.socket.setsockopt(socket.IPPROTO_IPV6, socket.IPV6_V6ONLY, 0)
        super().server_bind()


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8934
    with DualStackServer(('::', port), NoCacheHTTPRequestHandler) as httpd:
        print(f'Serving on port {port} with caching disabled')
        httpd.serve_forever()
