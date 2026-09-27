"use client";
import React, { useState, useRef, useEffect, useCallback } from 'react';
import Webcam from 'react-webcam';
import {
  Camera,
  Image as ImageIcon,
  Zap,
  ZapOff,
  RefreshCw,
  ShieldCheck,
  FolderCheck,
  Check,
  Plus,
  ArrowRight,
  Pencil,
  X,
  RotateCcw,
  CheckCircle2,
} from 'lucide-react';
import {
  detectCornersWithFallback,
  processScanWithFallback,
  Point,
  ScanFilter,
} from '@/utils/scannerUtils';
import { loadOpenCV } from '@/utils/opencvScanner';
import { saveCapturedImageToDisk } from '@/services/verificationService';
import { DocumentType } from '@/types';

export type DocPreset =
  | 'passport'
  | 'aadhaar'
  | 'pan'
  | 'voter_id'
  | 'driving_license'
  | 'proof_of_address'
  | 'bank_statement'
  | 'employment_letter'
  | 'tax_documents'
  | 'birth_certificate'
  | 'visa'
  | 'residence_permit';
export type DocSide = 'front' | 'back' | 'single';

export interface CapturedDoc {
  id: string;
  docType: DocumentType;
  side: DocSide;
  fileName: string;
  rawImage: string;
  processedImage: string;
  savedPath: string;
  isSuspicious: boolean;
  qualityScore: number;
  corners: Point[];
  filterUsed?: ScanFilter;
}

export interface ScanSessionPayload {
  documents: CapturedDoc[];
  primaryDoc: CapturedDoc;
}

interface WebCamScannerProps {
  onSessionComplete: (payload: ScanSessionPayload) => void;
  onRequestManualCrop?: (rawImage: string, corners: Point[]) => void;
}

interface PendingScan {
  rawSrc: string;
  corners: Point[];
  filter: ScanFilter;
  confidence: number;
}

const PRESET_META: Record<
  DocPreset,
  {
    label: string;
    docType: DocumentType;
    sides: DocSide[];
    sampleImages: Partial<Record<DocSide, string>>;
    isSuspicious?: boolean;
  }
> = {
  passport: { label: 'Passport', docType: 'passport', sides: ['single'], sampleImages: { single: '/samples/passport_front.svg' } },
  aadhaar: { label: 'Aadhaar Card', docType: 'aadhaar', sides: ['front', 'back'], sampleImages: { front: '/samples/aadhaar_front.svg', back: '/samples/aadhaar_back.svg' } },
  pan: { label: 'PAN Card', docType: 'pan', sides: ['single'], sampleImages: { single: '/samples/driving_license_front.svg' } },
  voter_id: { label: 'Voter ID (EPIC)', docType: 'voter_id', sides: ['front', 'back'], sampleImages: { front: '/samples/driving_license_front.svg', back: '/samples/driving_license_back.svg' } },
  driving_license: { label: 'Driving Licence', docType: 'driving_license', sides: ['front', 'back'], sampleImages: { front: '/samples/driving_license_front.svg', back: '/samples/driving_license_back.svg' } },
  proof_of_address: { label: 'Proof of Address', docType: 'proof_of_address', sides: ['front'], sampleImages: { front: '/samples/driving_license_front.svg' } },
  bank_statement: { label: 'Bank Statement', docType: 'bank_statement', sides: ['front', 'back'], sampleImages: { front: '/samples/driving_license_front.svg', back: '/samples/driving_license_back.svg' } },
  employment_letter: { label: 'Employment Letter', docType: 'employment_letter', sides: ['front'], sampleImages: { front: '/samples/visa_front.svg' } },
  tax_documents: { label: 'Tax Documents', docType: 'tax_documents', sides: ['front', 'back'], sampleImages: { front: '/samples/aadhaar_front.svg', back: '/samples/aadhaar_back.svg' } },
  birth_certificate: { label: 'Birth Certificate', docType: 'birth_certificate', sides: ['single'], sampleImages: { single: '/samples/visa_front.svg' } },
  visa: { label: 'Visa', docType: 'visa', sides: ['single'], sampleImages: { single: '/samples/visa_front.svg' } },
  residence_permit: { label: 'Residence Permit', docType: 'residence_permit', sides: ['front', 'back'], sampleImages: { front: '/samples/driving_license_front.svg', back: '/samples/driving_license_back.svg' } },
};

const SIDE_LABEL: Record<DocSide, string> = {
  front: 'Front',
  back: 'Back',
  single: 'Page',
};

const FILTERS: { id: ScanFilter; label: string; icon: string }[] = [
  { id: 'original', label: 'Original', icon: '📷' },
  { id: 'bw_clean', label: 'B&W', icon: '📄' },
  { id: 'grayscale', label: 'Grayscale', icon: '🌓' },
];

function shortId() {
  return Math.random().toString(36).slice(2, 8);
}

export default function WebCamScanner({
  onSessionComplete,
  onRequestManualCrop,
}: WebCamScannerProps) {
  const webcamRef = useRef<Webcam>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cropContainerRef = useRef<HTMLDivElement>(null);
  const cropImgRef = useRef<HTMLImageElement>(null);

  const [hasCamera, setHasCamera] = useState<boolean | null>(null);
  const [flashOn, setFlashOn] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<'environment' | 'user'>('environment');
  const [isProcessing, setIsProcessing] = useState(false);

  const [captured, setCaptured] = useState<CapturedDoc[]>([]);

  const [activePreset, setActivePreset] = useState<DocPreset>('passport');
  const [activeSide, setActiveSide] = useState<DocSide>('single');
  const [activeFileName, setActiveFileName] = useState<string>('passport_single');
  const [isEditingName, setIsEditingName] = useState(false);

  const [pendingScan, setPendingScan] = useState<PendingScan | null>(null);
  const [displayPoints, setDisplayPoints] = useState<Point[]>([]);
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const draggingIdxRef = useRef<number | null>(null);

  const [toast, setToast] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    loadOpenCV().catch(() => {});
  }, []);

  useEffect(() => {
    navigator.mediaDevices
      ?.getUserMedia?.({ video: true })
      .then((s) => {
        setHasCamera(true);
        s.getTracks().forEach((t) => t.stop());
      })
      .catch(() => setHasCamera(false));
  }, []);

  useEffect(() => {
    setActiveFileName(`${activePreset}_${activeSide}`);
  }, [activePreset, activeSide]);

  const handlePresetChange = (p: DocPreset) => {
    setActivePreset(p);
    setActiveSide(PRESET_META[p].sides[0]);
  };

  const meta = PRESET_META[activePreset];
  const sampleImage = meta.sampleImages[activeSide] || Object.values(meta.sampleImages)[0];

  const initDisplayPoints = useCallback((corners: Point[], imgEl: HTMLImageElement) => {
    if (!cropContainerRef.current) return;
    const containerRect = cropContainerRef.current.getBoundingClientRect();
    const imgRect = imgEl.getBoundingClientRect();

    const offsetX = imgRect.left - containerRect.left;
    const offsetY = imgRect.top - containerRect.top;
    const scaleX = imgRect.width / imgEl.naturalWidth;
    const scaleY = imgRect.height / imgEl.naturalHeight;

    setDisplayPoints(
      corners.map((pt) => ({
        x: pt.x * scaleX + offsetX,
        y: pt.y * scaleY + offsetY,
      }))
    );
  }, []);

  const getEventPos = useCallback((e: MouseEvent | TouchEvent) => {
    if (!cropContainerRef.current) return { x: 0, y: 0 };
    const rect = cropContainerRef.current.getBoundingClientRect();
    if ('touches' in e && e.touches.length > 0) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    }
    const me = e as MouseEvent;
    return {
      x: me.clientX - rect.left,
      y: me.clientY - rect.top,
    };
  }, []);

  const handleDragMove = useCallback(
    (e: MouseEvent | TouchEvent) => {
      if (draggingIdxRef.current === null || !cropImgRef.current || !cropContainerRef.current) return;
      if (e.cancelable) e.preventDefault();

      const pos = getEventPos(e);
      const imgRect = cropImgRef.current.getBoundingClientRect();
      const containerRect = cropContainerRef.current.getBoundingClientRect();
      const ox = imgRect.left - containerRect.left;
      const oy = imgRect.top - containerRect.top;

      const clampedX = Math.max(ox, Math.min(pos.x, ox + imgRect.width));
      const clampedY = Math.max(oy, Math.min(pos.y, oy + imgRect.height));

      setDisplayPoints((prev) => {
        const next = [...prev];
        next[draggingIdxRef.current!] = { x: clampedX, y: clampedY };
        return next;
      });
    },
    [getEventPos]
  );

  const handleDragEnd = useCallback(() => {
    draggingIdxRef.current = null;
    setDraggingIdx(null);
  }, []);

  useEffect(() => {
    document.addEventListener('mousemove', handleDragMove);
    document.addEventListener('mouseup', handleDragEnd);
    document.addEventListener('touchmove', handleDragMove, { passive: false });
    document.addEventListener('touchend', handleDragEnd);

    return () => {
      document.removeEventListener('mousemove', handleDragMove);
      document.removeEventListener('mouseup', handleDragEnd);
      document.removeEventListener('touchmove', handleDragMove);
      document.removeEventListener('touchend', handleDragEnd);
    };
  }, [handleDragMove, handleDragEnd]);

  const getScaledCorners = (): Point[] => {
    if (!cropImgRef.current || !cropContainerRef.current || displayPoints.length !== 4) {
      return pendingScan?.corners || [];
    }
    const img = cropImgRef.current;
    const imgRect = img.getBoundingClientRect();
    const containerRect = cropContainerRef.current.getBoundingClientRect();
    const offsetX = imgRect.left - containerRect.left;
    const offsetY = imgRect.top - containerRect.top;

    const scaleX = img.naturalWidth / imgRect.width;
    const scaleY = img.naturalHeight / imgRect.height;

    return displayPoints.map((pt) => ({
      x: (pt.x - offsetX) * scaleX,
      y: (pt.y - offsetY) * scaleY,
    }));
  };

  const handleCapture = async () => {
    if (isProcessing) return;
    setIsProcessing(true);

    try {
      let rawSrc: string | null = webcamRef.current?.getScreenshot() ?? null;
      if (!rawSrc) rawSrc = sampleImage!;

      const { corners, confidence } = await detectCornersWithFallback(rawSrc);

      setPendingScan({
        rawSrc,
        corners,
        filter: 'original',
        confidence,
      });
    } catch (err) {
      console.error('Capture error:', err);
      showToast('Capture failed. Try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleGalleryUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const src = ev.target?.result as string;
      if (src) {
        setIsProcessing(true);
        try {
          const { corners, confidence } = await detectCornersWithFallback(src);
          setPendingScan({
            rawSrc: src,
            corners,
            filter: 'original',
            confidence,
          });
        } finally {
          setIsProcessing(false);
        }
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleConfirmScan = async () => {
    if (!pendingScan || isProcessing) return;
    setIsProcessing(true);

    try {
      const finalCorners = getScaledCorners();
      const processed = await processScanWithFallback(
        pendingScan.rawSrc,
        finalCorners,
        0,
        0,
        pendingScan.filter
      );

      const saveResult = await saveCapturedImageToDisk(
        processed || pendingScan.rawSrc,
        meta.docType,
        activeSide === 'single' ? 'front' : activeSide,
        activeFileName
      );

      const doc: CapturedDoc = {
        id: shortId(),
        docType: meta.docType,
        side: activeSide,
        fileName: activeFileName,
        rawImage: pendingScan.rawSrc,
        processedImage: processed,
        savedPath: saveResult.savedPath,
        isSuspicious: !!meta.isSuspicious,
        qualityScore: Math.round(pendingScan.confidence * 100) || 98,
        corners: finalCorners,
        filterUsed: pendingScan.filter,
      };

      setCaptured((prev) => [...prev, doc]);
      showToast(`Saved → image/${saveResult.fileName}`);

      if (activeSide === 'front' && PRESET_META[activePreset].sides.includes('back')) {
        setActiveSide('back');
        setActiveFileName(`${activePreset}_back`);
      }

      setPendingScan(null);
    } catch (err) {
      console.error('Save error:', err);
      showToast('Could not process scan. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const removeDoc = (id: string) => setCaptured((prev) => prev.filter((d) => d.id !== id));

  const handleProceed = () => {
    if (captured.length === 0) return;
    const primary = captured.find((d) => !d.isSuspicious) ?? captured[0];
    onSessionComplete({ documents: captured, primaryDoc: primary });
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 text-white select-none">
      <div className="flex items-center justify-between px-4 py-3 bg-slate-950 border-b border-slate-800 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded bg-blue-700 flex items-center justify-center">
            <ShieldCheck className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="font-semibold text-sm text-white">Document Scanner</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setFlashOn(!flashOn)}
            className={`p-2 rounded transition ${
              flashOn ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            {flashOn ? <Zap className="w-4 h-4 fill-current" /> : <ZapOff className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={() => setCameraFacing((f) => (f === 'environment' ? 'user' : 'environment'))}
            className="p-2 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white transition"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="px-3 py-2.5 bg-slate-900 border-b border-slate-800 flex-shrink-0">
        <div className="flex gap-2 overflow-x-auto pb-1.5 scrollbar-none mb-1.5">
          {(Object.keys(PRESET_META) as DocPreset[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => handlePresetChange(p)}
              className={`px-3 py-1.5 rounded text-[11px] font-medium whitespace-nowrap flex-shrink-0 transition ${
                activePreset === p
                  ? 'bg-blue-700 text-white border border-blue-700'
                  : 'bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700 hover:text-slate-200'
              }`}
            >
              {PRESET_META[p].label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 mt-1">
          {meta.sides.length > 1 && (
            <div className="flex items-center gap-1 bg-slate-800 p-1 rounded border border-slate-700">
              {meta.sides.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    setActiveSide(s);
                    setActiveFileName(`${activePreset}_${s}`);
                  }}
                  className={`px-2.5 py-1 rounded text-[10px] font-semibold transition flex items-center gap-1 ${
                    activeSide === s ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-300'
                  }`}
                >
                  {captured.some((d) => d.docType === meta.docType && d.side === s) && (
                    <Check className="w-3 h-3" />
                  )}
                  {SIDE_LABEL[s]}
                </button>
              ))}
            </div>
          )}

          <div className="flex-1 flex items-center gap-1.5 bg-slate-800 rounded px-3 py-1.5 border border-slate-700">
            <span className="text-[10px] text-slate-500 font-mono flex-shrink-0">File:</span>
            {isEditingName ? (
              <input
                type="text"
                autoFocus
                value={activeFileName}
                onChange={(e) => setActiveFileName(e.target.value.replace(/[^a-zA-Z0-9_-]/g, '_'))}
                onBlur={() => setIsEditingName(false)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') setIsEditingName(false);
                }}
                className="flex-1 bg-transparent text-[11px] font-mono text-white focus:outline-none min-w-0"
              />
            ) : (
              <button
                type="button"
                onClick={() => setIsEditingName(true)}
                className="flex-1 text-left text-[11px] font-mono text-blue-400 hover:text-blue-300 flex items-center gap-1.5 truncate"
              >
                <span className="truncate">{activeFileName}</span>
                <Pencil className="w-3 h-3 text-slate-500 flex-shrink-0" />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="relative flex-1 flex items-center justify-center overflow-hidden bg-black min-h-0">
        {flashOn && <div className="absolute inset-0 bg-white/10 z-10 pointer-events-none" />}

        <div className="relative w-full h-full bg-slate-900 flex items-center justify-center">
          {pendingScan === null ? (
            <>
              {hasCamera !== false ? (
                <Webcam
                  ref={webcamRef}
                  audio={false}
                  screenshotFormat="image/jpeg"
                  screenshotQuality={1}
                  videoConstraints={{
                    facingMode: cameraFacing,
                    width: { ideal: 1920 },
                    height: { ideal: 1080 },
                  }}
                  onUserMedia={() => setHasCamera(true)}
                  onUserMediaError={() => setHasCamera(false)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center p-4 bg-slate-900">
                  <img
                    src={sampleImage}
                    alt="Sample"
                    className="w-full h-auto max-h-full object-contain rounded border border-slate-800"
                  />
                </div>
              )}

              <div className="absolute inset-4 border border-blue-500/40 pointer-events-none transition-all">
                <div className="absolute -top-1 -left-1 w-6 h-6 border-t-2 border-l-2 border-blue-500" />
                <div className="absolute -top-1 -right-1 w-6 h-6 border-t-2 border-r-2 border-blue-500" />
                <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-2 border-l-2 border-blue-500" />
                <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-2 border-r-2 border-blue-500" />
              </div>

              <div className="absolute top-4 inset-x-4 flex justify-center pointer-events-none z-10">
                <div className="bg-slate-900/80 border border-slate-700 text-blue-400 px-4 py-1.5 rounded text-[11px] font-medium backdrop-blur-md flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                  {PRESET_META[activePreset].label} ({SIDE_LABEL[activeSide]})
                </div>
              </div>
            </>
          ) : (
            <div
              ref={cropContainerRef}
              className="relative w-full h-full flex flex-col items-center justify-center bg-slate-950 select-none overflow-hidden"
            >
              <img
                ref={cropImgRef}
                src={pendingScan.rawSrc}
                alt="Captured document"
                onLoad={(e) => initDisplayPoints(pendingScan.corners, e.currentTarget)}
                className="max-w-full max-h-full object-contain pointer-events-none"
              />

              {displayPoints.length === 4 && (
                <svg className="absolute inset-0 w-full h-full pointer-events-none z-20">
                  <polygon
                    points={displayPoints.map((p) => `${p.x},${p.y}`).join(' ')}
                    fill="rgba(37, 99, 235, 0.2)"
                    stroke="#2563eb"
                    strokeWidth="2"
                  />
                  <line
                    x1={displayPoints[0].x}
                    y1={displayPoints[0].y}
                    x2={displayPoints[2].x}
                    y2={displayPoints[2].y}
                    stroke="rgba(37, 99, 235, 0.4)"
                    strokeWidth="1"
                    strokeDasharray="4 2"
                  />
                  <line
                    x1={displayPoints[1].x}
                    y1={displayPoints[1].y}
                    x2={displayPoints[3].x}
                    y2={displayPoints[3].y}
                    stroke="rgba(37, 99, 235, 0.4)"
                    strokeWidth="1"
                    strokeDasharray="4 2"
                  />
                </svg>
              )}

              {displayPoints.map((pt, idx) => (
                <div
                  key={idx}
                  style={{
                    left: `${pt.x}px`,
                    top: `${pt.y}px`,
                    transform: 'translate(-50%, -50%)',
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    draggingIdxRef.current = idx;
                    setDraggingIdx(idx);
                  }}
                  onTouchStart={(e) => {
                    e.preventDefault();
                    draggingIdxRef.current = idx;
                    setDraggingIdx(idx);
                  }}
                  className={`absolute z-30 w-8 h-8 rounded-full flex items-center justify-center cursor-grab active:cursor-grabbing transition-transform ${
                    draggingIdx === idx ? 'scale-110' : ''
                  }`}
                >
                  <div className="w-4 h-4 rounded-full bg-blue-600 border-2 border-white shadow-md flex items-center justify-center" />
                </div>
              ))}

              <div className="absolute top-4 inset-x-4 z-30 flex items-center justify-center">
                <div className="flex gap-1.5 bg-slate-900/90 backdrop-blur-md p-1.5 rounded border border-slate-700">
                  {FILTERS.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setPendingScan((p) => (p ? { ...p, filter: f.id } : null))}
                      className={`px-3 py-1 rounded text-[11px] font-medium transition flex items-center gap-1.5 ${
                        pendingScan.filter === f.id
                          ? 'bg-blue-600 text-white'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                      }`}
                    >
                      <span>{f.icon}</span>
                      <span>{f.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="absolute bottom-4 inset-x-4 z-30 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setPendingScan(null)}
                  className="px-5 py-2.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium border border-slate-700 transition flex items-center gap-1.5"
                >
                  <RotateCcw className="w-4 h-4" />
                  Retake
                </button>

                <button
                  type="button"
                  onClick={handleConfirmScan}
                  disabled={isProcessing}
                  className="flex-1 py-2.5 px-4 rounded bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Apply & Save
                </button>
              </div>
            </div>
          )}

          {isProcessing && (
            <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm z-40 flex flex-col items-center justify-center">
              <div className="w-8 h-8 rounded-full border-2 border-blue-500/30 border-t-blue-500 animate-spin" />
              <p className="mt-3 text-xs font-medium text-slate-300">Processing scan...</p>
            </div>
          )}
        </div>
      </div>

      {toast && (
        <div className="absolute top-24 inset-x-4 flex justify-center z-50 pointer-events-none">
          <div className="bg-slate-800 border border-slate-700 text-slate-200 px-4 py-2 rounded text-[11px] font-medium shadow-lg flex items-center gap-2">
            <FolderCheck className="w-4 h-4 text-emerald-500" />
            {toast}
          </div>
        </div>
      )}

      {captured.length > 0 && (
        <div className="flex-shrink-0 bg-slate-900 border-t border-slate-800 px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
              Scanned Documents ({captured.length})
            </span>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-none">
            {captured.map((doc) => (
              <div key={doc.id} className="relative flex-shrink-0 w-20">
                <div
                  className={`w-20 h-14 rounded overflow-hidden border ${
                    doc.isSuspicious ? 'border-rose-500' : 'border-slate-700'
                  }`}
                >
                  <img
                    src={doc.processedImage}
                    alt={doc.fileName}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="text-center mt-1.5">
                  <p className="text-[9px] text-slate-400 font-mono truncate w-full">
                    {doc.fileName}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => removeDoc(doc.id)}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-slate-800 border border-slate-700 text-slate-400 hover:text-rose-400 rounded-full flex items-center justify-center transition"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}

            <button
              type="button"
              onClick={() => {}}
              className="flex-shrink-0 w-20 h-14 rounded border border-dashed border-slate-700 flex items-center justify-center text-slate-500 hover:border-slate-500 hover:text-slate-400 transition"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      <div className="flex-shrink-0 px-4 py-3 bg-slate-950 border-t border-slate-900 flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex flex-col items-center gap-1.5 text-slate-500 hover:text-slate-300 transition"
        >
          <div className="w-10 h-10 rounded bg-slate-900 border border-slate-800 flex items-center justify-center">
            <ImageIcon className="w-5 h-5" />
          </div>
          <span className="text-[10px] font-medium">Upload</span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleGalleryUpload}
        />

        <button
          type="button"
          onClick={handleCapture}
          disabled={isProcessing || pendingScan !== null}
          className="group p-1 active:scale-95 transition disabled:opacity-50"
        >
          <div className="w-16 h-16 rounded-full border-[3px] border-slate-700 group-hover:border-blue-500 flex items-center justify-center p-1 transition-colors">
            <div className="w-full h-full rounded-full bg-slate-200 group-hover:bg-white transition-colors flex items-center justify-center">
              <Camera className="w-6 h-6 text-slate-800" />
            </div>
          </div>
        </button>

        {captured.length > 0 ? (
          <button
            type="button"
            onClick={handleProceed}
            className="flex flex-col items-center gap-1.5 transition hover:opacity-80"
          >
            <div className="w-10 h-10 rounded bg-blue-700 flex items-center justify-center relative">
              <ArrowRight className="w-5 h-5 text-white" />
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-blue-900 text-blue-100 text-[9px] font-bold rounded flex items-center justify-center border border-blue-700">
                {captured.length}
              </span>
            </div>
            <span className="text-[10px] font-medium text-blue-400">Continue</span>
          </button>
        ) : (
          <div className="flex flex-col items-center gap-1.5 text-slate-600">
            <div className="w-10 h-10 rounded bg-slate-900 border border-slate-800 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-medium">Capture</span>
          </div>
        )}
      </div>
    </div>
  );
}
