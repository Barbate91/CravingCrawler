import sharp from "sharp";
import { mkdir } from "fs/promises";
import path from "path";

const IMAGE_DIR = process.env.IMAGE_DIR ?? path.resolve(process.cwd(), "public", "images");
const MAX_WIDTH = 400;
const QUALITY = 80;

/**
 * Download an image URL, resize it to a reasonable thumbnail, and save as WebP.
 * Returns the local path relative to /public (e.g. "/images/crumbl/abc123.webp").
 */
export async function downloadAndResize(
  imageUrl: string,
  site: string,
  slug?: string,
): Promise<string> {
  const safeSite = site.replace(/[^a-z0-9_-]/gi, "-").toLowerCase();
  const outDir = path.join(IMAGE_DIR, safeSite);
  await mkdir(outDir, { recursive: true });

  // Generate a short filename from the URL
  const filename = (slug ?? hashUrl(imageUrl)) + ".webp";
  const outPath = path.join(outDir, filename);
  const publicPath = `/images/${safeSite}/${filename}`;

  try {
    const res = await fetch(imageUrl, {
      headers: { "user-agent": "CravingCrawler/0.1" },
    });
    if (!res.ok) throw new Error(`Image fetch HTTP ${res.status}`);
    const buffer = Buffer.from(await res.arrayBuffer());

    await sharp(buffer)
      .resize({ width: MAX_WIDTH, withoutEnlargement: true })
      .webp({ quality: QUALITY })
      .toFile(outPath);

    return publicPath;
  } catch (err) {
    console.warn(`[images] Failed to process ${imageUrl}:`, err);
    return imageUrl; // fall back to original URL
  }
}

function hashUrl(url: string): string {
  let h = 0;
  for (let i = 0; i < url.length; i++) {
    h = ((h << 5) - h + url.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(36);
}
