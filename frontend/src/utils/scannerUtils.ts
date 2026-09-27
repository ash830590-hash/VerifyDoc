/**
 * scannerUtils.ts
 * 
 * Scanner utility functions integrating advanced OpenCV / Homography
 * perspective deskewing and CamScanner-grade enhancement filters.
 */

import {
  Point,
  ScanFilter,
  detectDocumentCorners,
  warpPerspectiveDocument,
  orderPoints,
} from './opencvScanner';
import { getApiBaseUrl } from '@/services/verificationService';

export type { Point, ScanFilter };

export interface CornerDetectionResult {
  corners: Point[];
  confidence: number;
  imageWidth: number;
  imageHeight: number;
}

/**
 * Loads an image from a data URL, object URL, or image path
 */
function loadImageElement(imageSrc: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = imageSrc;
  });
}

/**
 * Detects document corners using OpenCV contour detection / adaptive contrast profiling,
 * with backend /detect-corners compatibility if available.
 */
export async function detectCornersWithFallback(
  imageSrc: string
): Promise<CornerDetectionResult> {
  // 1. Try backend /detect-corners if online with quick timeout
  try {
    const rawBlob = await fetch(imageSrc).then((r) => r.blob());
    const formData = new FormData();
    formData.append('file', rawBlob);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 600);

    const res = await fetch(`${getApiBaseUrl()}/detect-corners`, {
      method: 'POST',
      headers: { 'X-Pinggy-No-Screen': '1' },
      body: formData,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data && data.corners && data.corners.length === 4) {
        return {
          corners: data.corners,
          confidence: data.confidence || 0.94,
          imageWidth: data.image_width || 640,
          imageHeight: data.image_height || 480,
        };
      }
    }
  } catch {
    // Backend offline; continue to client-side OpenCV / Canvas engine
  }

  // 2. In-browser client-side OpenCV & Canvas edge detection
  try {
    const img = await loadImageElement(imageSrc);
    const detection = await detectDocumentCorners(img);

    return {
      corners: detection.corners,
      confidence: detection.confidence,
      imageWidth: detection.width,
      imageHeight: detection.height,
    };
  } catch (err) {
    console.warn('Fallback corner estimation due to image load error:', err);
    return {
      corners: [
        { x: 40, y: 40 },
        { x: 600, y: 40 },
        { x: 600, y: 440 },
        { x: 40, y: 440 },
      ],
      confidence: 0.85,
      imageWidth: 640,
      imageHeight: 480,
    };
  }
}

/**
 * Processes document scan using 4-point perspective warp and CamScanner enhancement filters.
 * Replaces axis-aligned cropping with real projective homography deskewing.
 */
export async function processScanWithFallback(
  imageSrc: string,
  corners: Point[],
  horizontalTilt: number = 0,
  verticalTilt: number = 0,
  filter: ScanFilter = 'original'
): Promise<string> {
  // 1. Try backend /scan-pro if available with quick timeout
  try {
    const rawBlob = await fetch(imageSrc).then((r) => r.blob());
    const formData = new FormData();
    formData.append('file', rawBlob, 'document_scan.jpg');
    formData.append('corners', JSON.stringify(corners));
    formData.append('horizontal_tilt', horizontalTilt.toString());
    formData.append('vertical_tilt', verticalTilt.toString());

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1200);

    const res = await fetch(`${getApiBaseUrl()}/scan-pro`, {
      method: 'POST',
      headers: { 'X-Pinggy-No-Screen': '1' },
      body: formData,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const blob = await res.blob();
      return URL.createObjectURL(blob);
    }
  } catch {
    // Backend offline; proceed to client-side homography warp
  }

  // 2. In-browser 4-Point Homography Perspective Warp + CamScanner Enhancement
  try {
    const img = await loadImageElement(imageSrc);
    const ordered = orderPoints(corners);

    // Apply 4-point homography perspective warp with selected CamScanner filter
    const resultDataUrl = await warpPerspectiveDocument(img, ordered, filter);
    return resultDataUrl;
  } catch (err) {
    console.error('Client-side perspective warp error:', err);
    return imageSrc;
  }
}
