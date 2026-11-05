const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const PORT = 8085;
const STATIC_DIR = path.join(__dirname, 'simulador-mano-protesica');

const MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.stl': 'model/stl',
    '.ino': 'text/plain'
};

const server = http.createServer((req, res) => {
    // Manejar CORS y Caché
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

    let reqUrl = req.url.split('?')[0];
    if (reqUrl === '/') reqUrl = '/index.html';

    const filePath = path.join(STATIC_DIR, decodeURIComponent(reqUrl));

    // Seguridad: evitar directory traversal
    if (!filePath.startsWith(STATIC_DIR)) {
        res.writeHead(403);
        res.end('Acceso denegado');
        return;
    }

    fs.stat(filePath, (err, stats) => {
        if (err || !stats.isFile()) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end(`Archivo no encontrado: ${reqUrl}`);
            return;
        }

        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';

        res.writeHead(200, { 'Content-Type': contentType });
        const stream = fs.createReadStream(filePath);
        stream.pipe(res);
    });
});

server.listen(PORT, () => {
    const url = `http://localhost:${PORT}`;
    console.log('='.repeat(70));
    console.log(' BIONICHAND 3D STUDIO - TALLER Y SIMULADOR DIDÁCTICO');
    console.log('='.repeat(70));
    console.log(`📁 Directorio: ${STATIC_DIR}`);
    console.log(`🌐 Servidor:   ${url}`);
    console.log('🚀 Abriendo navegador...');
    console.log('='.repeat(70));

    // Abrir navegador en Windows
    exec(`start ${url}`);
});
