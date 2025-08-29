#!/usr/bin/env python3
import os
import http.server
import socketserver
from urllib.parse import urlparse

class CustomHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        # Parse the path
        parsed_path = urlparse(self.path)
        
        # If requesting index.html or root, inject environment variables
        if self.path == '/' or self.path == '/index.html':
            try:
                with open('index.html', 'r') as f:
                    content = f.read()
                
                # Replace environment variable placeholders
                supabase_url = os.getenv('SUPABASE_URL', '')
                supabase_anon_key = os.getenv('SUPABASE_ANON_KEY', '')
                
                content = content.replace('{{SUPABASE_URL}}', supabase_url)
                content = content.replace('{{SUPABASE_ANON_KEY}}', supabase_anon_key)
                
                # Send response
                self.send_response(200)
                self.send_header('Content-Type', 'text/html')
                self.send_header('Cache-Control', 'no-cache')
                self.end_headers()
                self.wfile.write(content.encode())
                return
            except Exception as e:
                print(f"Error serving index.html: {e}")
        
        # For all other requests, use the default handler
        super().do_GET()

# Start the server
PORT = 5000
Handler = CustomHTTPRequestHandler

# Allow address reuse to prevent "Address already in use" errors
socketserver.TCPServer.allow_reuse_address = True

with socketserver.TCPServer(("", PORT), Handler) as httpd:
    print(f"Serving at http://0.0.0.0:{PORT}")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped.")