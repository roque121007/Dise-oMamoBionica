import http.server
import socketserver
import webbrowser
import os
import sys

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DIRECTORY = os.path.join(BASE_DIR, "simulador-mano-protesica")

if not os.path.exists(DIRECTORY):
    # Intentar buscar en la carpeta actual
    if os.path.exists("simulador-mano-protesica"):
        DIRECTORY = os.path.abspath("simulador-mano-protesica")
    else:
        print(f"Error: No se encontró la carpeta '{DIRECTORY}'")
        sys.exit(1)

class CustomTCPServer(socketserver.TCPServer):
    allow_reuse_address = True

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)
        
    def end_headers(self):
        # Asegurar compatibilidad CORS y caché
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        super().end_headers()

# Buscar un puerto disponible empezando en 8085
port = 8085
max_port = 8100
httpd = None

while port <= max_port:
    try:
        httpd = CustomTCPServer(("", port), Handler)
        break
    except OSError:
        port += 1

if not httpd:
    print("No se encontró ningún puerto libre entre 8085 y 8100.")
    sys.exit(1)

url = f"http://localhost:{port}"
print("=" * 70)
print(" INICIANDO BIONICHAND 3D STUDIO - SIMULADOR DE MANO PROTÉSICA")
print("=" * 70)
print(f"📁 Directorio de archivos: {DIRECTORY}")
print(f"🌐 Servidor activo en:    {url}")
print("🚀 Abriendo navegador automáticamente...")
print("⚠️  Presione Ctrl+C en esta consola cuando desee cerrar el simulador.")
print("=" * 70)

webbrowser.open(url)

try:
    httpd.serve_forever()
except KeyboardInterrupt:
    print("\nServidor cerrado correctamente.")
    httpd.server_close()
    sys.exit(0)
