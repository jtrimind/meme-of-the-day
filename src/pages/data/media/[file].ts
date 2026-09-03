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

export const GET: APIRoute = ({ params }) => {
  const fileName = params.file;
  if (!fileName) {
    return new Response('File name required', { status: 400 });
  }

  const filePath = path.join(mediaDir, fileName);
  if (!fs.existsSync(filePath)) {
    return new Response('File not found', { status: 404 });
  }

  const buffer = fs.readFileSync(filePath);
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

  return new Response(buffer, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
};
