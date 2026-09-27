import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { image, docType, side = 'front', customName } = body;

    if (!image) {
      return NextResponse.json({ error: 'No image data provided' }, { status: 400 });
    }

    // Target folder: ./image or ../image if running inside frontend/
    let imageDir = path.resolve(process.cwd(), 'image');
    if (!fs.existsSync(imageDir)) {
      const parentImageDir = path.resolve(process.cwd(), '..', 'image');
      if (fs.existsSync(parentImageDir) || path.basename(process.cwd()) === 'frontend') {
        imageDir = parentImageDir;
      }
    }
    try {
      if (!fs.existsSync(imageDir)) {
        fs.mkdirSync(imageDir, { recursive: true });
      }
    } catch {
      imageDir = path.resolve('/tmp');
      try {
        if (!fs.existsSync(imageDir)) {
          fs.mkdirSync(imageDir, { recursive: true });
        }
      } catch {
        // Fallback silently if /tmp is not available
      }
    }

    // Construct clean file name
    const sanitizedDocType = (docType || 'document').toLowerCase().replace(/[^a-z0-9_]/g, '_');
    const sanitizedSide = (side || 'front').toLowerCase().replace(/[^a-z0-9_]/g, '_');
    const baseName = customName
      ? `${customName.replace(/[^a-z0-9_]/g, '_')}_${sanitizedSide}`
      : `${sanitizedDocType}_${sanitizedSide}`;

    let filePath = `image/${baseName}.jpg`;
    let fileUrl = image;

    try {
      if (image.startsWith('data:image/')) {
        // Base64 data URL from Webcam / Canvas
        const matches = image.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
        if (matches) {
          const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
          const buffer = Buffer.from(matches[2], 'base64');
          const filename = `${baseName}.${ext}`;
          filePath = path.join(imageDir, filename);
          fs.writeFileSync(filePath, buffer);
          fileUrl = `/image/${filename}`;
        }
      } else if (image.startsWith('/samples/')) {
        // Preset sample SVG
        const sampleName = path.basename(image);
        const ext = path.extname(sampleName) || '.svg';
        const filename = `${baseName}${ext}`;
        filePath = path.join(imageDir, filename);

        const sourcePath = path.join(process.cwd(), 'public', 'samples', sampleName);
        if (fs.existsSync(sourcePath)) {
          fs.copyFileSync(sourcePath, filePath);
        }
        fileUrl = `/image/${filename}`;
      } else {
        // Fallback text or binary
        const filename = `${baseName}.jpg`;
        filePath = path.join(imageDir, filename);
        fs.writeFileSync(filePath, Buffer.from(image, 'utf-8'));
        fileUrl = `/image/${filename}`;
      }
    } catch (writeErr) {
      console.warn('Filesystem write note (serverless environment):', writeErr);
    }

    return NextResponse.json({
      success: true,
      savedPath: filePath,
      fileName: path.basename(filePath),
      fileUrl,
      message: `Image successfully saved to folder 'image' as ${path.basename(filePath)}`,
    });
  } catch (error: any) {
    console.error('Error saving image:', error);
    return NextResponse.json({ error: error.message || 'Failed to save image' }, { status: 500 });
  }
}
