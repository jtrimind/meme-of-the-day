import type { APIRoute, GetStaticPaths } from 'astro';
import fs from 'node:fs';
import path from 'node:path';

const mediaDir = path.resolve(process.cwd(), 'data/media');

export const getStaticPaths: GetStaticPaths = () => {
  if (!fs.existsSync(mediaDir)) return [];
  const files = fs.readdirSync(mediaDir).filter(f => f !== '.gitkeep' && !f.startsWith('.'));
  return files.map(file => ({
    params: { file }
  }));
};

export const GET: APIRoute = ({ params, request }) => {
  const fileName = params.file;
  if (!fileName) {
    return new Response('File name required', { status: 400 });
  }

  const filePath = path.join(mediaDir, fileName);
  if (!fs.existsSync(filePath)) {
    return new Response('File not found', { status: 404 });
  }

  const ext = path.extname(fileName).toLowerCase();

  const mimeTypes: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
  };

  const contentType = mimeTypes[ext] || 'application/octet-stream';
  const stat = fs.statSync(filePath);
  const fileSize = stat.size;

  if (import.meta.env.DEV && contentType.startsWith('video/')) {
    const range = request.headers.get('range');
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = end - start + 1;

      const stream = fs.createReadStream(filePath, { start, end });
      const readableStream = new ReadableStream({
        start(controller) {
          stream.on('data', chunk => controller.enqueue(chunk));
          stream.on('end', () => controller.close());
          stream.on('error', err => controller.error(err));
        }
      });

      return new Response(readableStream, {
        status: 206,
        headers: {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': String(chunksize),
          'Content-Type': contentType,
        },
      });
    }
  }

  const buffer = fs.readFileSync(filePath);

  return new Response(buffer, {
    headers: {
      'Content-Type': contentType,
      'Content-Length': String(fileSize),
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
};
