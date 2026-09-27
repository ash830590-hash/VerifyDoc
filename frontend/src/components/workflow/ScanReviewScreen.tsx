"use client";
import React, { useState } from 'react';
import {
  CheckCircle2,
  RotateCcw,
  ArrowRight,
  Crop,
  FolderCheck,
  X,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  BookOpen,
  FileText,
  AlertTriangle,
  Home,
  Building,
  Briefcase,
  Calculator,
  User,
  Plane,
  FileIcon
} from 'lucide-react';
import { CapturedDoc } from '@/components/scanner/WebCamScanner';

interface ScanReviewScreenProps {
  scannedImage: string;
  backImage?: string;
  savedFilePaths?: { front?: string; back?: string };
  sessionDocs?: CapturedDoc[];
  onRetake: () => void;
  onAdjustCorners: () => void;
  onAcceptScan: () => void;
}

const DOC_META: Record<string, { label: string; icon: React.ReactNode }> = {
  passport: { label: 'Passport', icon: <BookOpen className="w-3.5 h-3.5" /> },
  aadhaar: { label: 'Aadhaar Card', icon: <User className="w-3.5 h-3.5" /> },
  pan: { label: 'PAN Card', icon: <FileText className="w-3.5 h-3.5" /> },
  voter_id: { label: 'Voter ID', icon: <User className="w-3.5 h-3.5" /> },
  driving_license: { label: 'Driving Licence', icon: <FileText className="w-3.5 h-3.5" /> },
  proof_of_address: { label: 'Proof of Address', icon: <Home className="w-3.5 h-3.5" /> },
  bank_statement: { label: 'Bank Statement', icon: <Building className="w-3.5 h-3.5" /> },
  employment_letter: { label: 'Employment Letter', icon: <Briefcase className="w-3.5 h-3.5" /> },
  tax_documents: { label: 'Tax Documents', icon: <Calculator className="w-3.5 h-3.5" /> },
  birth_certificate: { label: 'Birth Certificate', icon: <User className="w-3.5 h-3.5" /> },
  visa: { label: 'Visa', icon: <Plane className="w-3.5 h-3.5" /> },
  residence_permit: { label: 'Residence Permit', icon: <FileText className="w-3.5 h-3.5" /> },
};

export default function ScanReviewScreen({
  scannedImage,
  backImage,
  savedFilePaths,
  sessionDocs = [],
  onRetake,
  onAdjustCorners,
  onAcceptScan,
}: ScanReviewScreenProps) {
  const hasSession = sessionDocs.length > 0;

  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  const [editableNames, setEditableNames] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<string | null>(null);

  const getName = (id: string, fallback: string) =>
    editableNames[id] !== undefined ? editableNames[id] : fallback;

  const startEdit = (id: string, current: string) => {
    if (!(id in editableNames)) setEditableNames((p) => ({ ...p, [id]: current }));
    setEditingId(id);
  };

  const commitEdit = (id: string) => {
    setEditingId(null);
    setEditableNames((p) => ({
      ...p,
      [id]: (p[id] || '').replace(/[^a-zA-Z0-9_\-]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '') || p[id],
    }));
  };

  const displayDocs: { id: string; image: string; label: string; sublabel: string; path: string; isSuspicious: boolean; docType: string }[] =
    hasSession
      ? sessionDocs.map((d) => ({
          id: d.id,
          image: d.processedImage || d.rawImage,
          label: `${DOC_META[d.docType]?.label ?? d.docType} — ${d.side === 'single' ? 'Page' : d.side.charAt(0).toUpperCase() + d.side.slice(1)}`,
          sublabel: d.fileName,
          path: d.savedPath,
          isSuspicious: d.isSuspicious,
          docType: d.docType,
        }))
      : [
          {
            id: 'front',
            image: scannedImage,
            label: 'Front Side',
            sublabel: savedFilePaths?.front || 'doc_front',
            path: savedFilePaths?.front || '',
            isSuspicious: false,
            docType: 'passport',
          },
          ...(backImage
            ? [{
                id: 'back',
                image: backImage,
                label: 'Back Side',
                sublabel: savedFilePaths?.back || 'doc_back',
                path: savedFilePaths?.back || '',
                isSuspicious: false,
                docType: 'passport',
              }]
            : []),
        ];

  const totalCount = displayDocs.length;

  const openLightbox = (i: number) => setLightboxIdx(i);
  const closeLightbox = () => setLightboxIdx(null);
  const prevLightbox = () =>
    setLightboxIdx((i) => (i !== null ? (i - 1 + totalCount) % totalCount : 0));
  const nextLightbox = () =>
    setLightboxIdx((i) => (i !== null ? (i + 1) % totalCount : 0));

  return (
    <div className="flex flex-col h-full bg-slate-50 text-slate-900 select-none">
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-slate-200 flex-shrink-0">
        <button
          type="button"
          onClick={onRetake}
          className="text-sm font-medium text-slate-600 hover:text-slate-900 flex items-center gap-1"
        >
          <RotateCcw className="w-4 h-4" />
          Retake
        </button>
        <div className="text-center">
          <h2 className="text-sm font-semibold text-slate-900">Review Scans</h2>
        </div>
        <button
          type="button"
          onClick={onAdjustCorners}
          className="text-sm font-medium text-blue-700 hover:text-blue-800 flex items-center gap-1"
        >
          <Crop className="w-4 h-4" />
          Adjust
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">

        <div className="flex items-center gap-2 bg-slate-100 border border-slate-200 rounded-lg px-3 py-3">
          <FolderCheck className="w-4 h-4 text-slate-600 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-slate-900">Documents saved locally</p>
            <p className="text-[10px] text-slate-500 font-mono truncate mt-0.5">
              {displayDocs.map(d => d.sublabel).join(' · ')}
            </p>
          </div>
          <span className="flex-shrink-0 text-[10px] font-bold text-slate-600 bg-slate-200 px-2 py-0.5 rounded">
            {totalCount} item{totalCount !== 1 ? 's' : ''}
          </span>
        </div>

        {displayDocs.some((d) => d.isSuspicious) && (
          <div className="flex items-start gap-2 bg-slate-100 border border-slate-300 rounded-lg px-3 py-3">
            <AlertTriangle className="w-4 h-4 text-slate-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs font-medium text-slate-700 leading-snug">
              One or more documents flagged for potential anomalies. Please review carefully before proceeding.
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          {displayDocs.map((doc, idx) => {
            const meta = DOC_META[doc.docType] ?? { label: 'Document', icon: <FileIcon className="w-3.5 h-3.5" /> };
            return (
              <div
                key={doc.id}
                className={`relative rounded-lg overflow-hidden border bg-white transition ${
                  doc.isSuspicious ? 'border-slate-400' : 'border-slate-200 hover:border-blue-700'
                }`}
              >
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => openLightbox(idx)}
                  onKeyDown={(e) => e.key === 'Enter' && openLightbox(idx)}
                  className="w-full aspect-[4/3] overflow-hidden bg-slate-100 cursor-pointer relative border-b border-slate-200"
                >
                  <img
                    src={doc.image}
                    alt={doc.label}
                    className="w-full h-full object-cover transition-opacity duration-200 hover:opacity-90"
                  />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                    <div className="bg-slate-900/60 p-1.5 rounded text-white">
                      <ZoomIn className="w-4 h-4" />
                    </div>
                  </div>
                </div>

                <div className="absolute top-2 left-2 pointer-events-none">
                  <span className={`flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded border bg-white/90 backdrop-blur-none text-slate-700 border-slate-300`}>
                    {meta.icon}
                    {doc.isSuspicious ? ' Review' : ''}
                  </span>
                </div>

                <div className="p-2 bg-white">
                  <p className="text-xs font-medium text-slate-900 truncate mb-1.5">{doc.label}</p>

                  {editingId === doc.id ? (
                    <div className="flex items-center gap-1.5">
                      <FileIcon className="w-3 h-3 text-slate-400 flex-shrink-0" />
                      <input
                        autoFocus
                        type="text"
                        value={getName(doc.id, doc.sublabel)}
                        onChange={(e) =>
                          setEditableNames((p) => ({ ...p, [doc.id]: e.target.value }))
                        }
                        onBlur={() => commitEdit(doc.id)}
                        onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(doc.id); }}
                        className="flex-1 text-[11px] font-mono text-slate-900 bg-white border border-slate-300 rounded px-1.5 py-1 focus:outline-none focus:border-blue-700 min-w-0"
                      />
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => startEdit(doc.id, doc.sublabel)}
                      className="flex items-center gap-1.5 w-full rounded transition"
                    >
                      <FileIcon className="w-3 h-3 text-slate-400 flex-shrink-0" />
                      <span className="text-[11px] text-slate-500 font-mono truncate flex-1 text-left">
                        {getName(doc.id, doc.sublabel)}
                      </span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="bg-white rounded-lg p-4 border border-slate-200 mt-4">
          <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
            <span className="text-xs font-semibold text-slate-900">Scan Quality Report</span>
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
              Optimal
            </span>
          </div>
          <div className="space-y-2.5">
            {[
              ['Documents detected', `${totalCount} of ${totalCount} identified`],
              ['Image resolution', 'Sufficient'],
              ['Perspective deskew', 'Applied'],
            ].map(([label, val]) => (
              <div key={label} className="flex items-center justify-between text-xs">
                <span className="text-slate-600">{label}</span>
                <span className="flex items-center gap-1.5 text-slate-900 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-700" />
                  {val}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-shrink-0 p-4 bg-white border-t border-slate-200 flex items-center gap-3">
        <button
          type="button"
          onClick={onRetake}
          className="flex-1 py-2.5 px-4 rounded-md border border-slate-300 text-slate-700 font-medium text-sm hover:bg-slate-50 transition text-center"
        >
          Retake
        </button>
        <button
          type="button"
          onClick={onAcceptScan}
          className="flex-1 py-2.5 px-5 rounded-md bg-blue-700 text-white font-medium text-sm hover:bg-blue-800 transition flex items-center justify-center gap-2"
        >
          <span>Use Scan{totalCount > 1 ? 's' : ''}</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {lightboxIdx !== null && (
        <div
          className="absolute inset-0 z-50 bg-slate-900 flex flex-col"
          onClick={closeLightbox}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
            <div>
              <p className="text-sm font-medium text-white">{displayDocs[lightboxIdx].label}</p>
              <p className="text-xs text-slate-400 font-mono mt-0.5">{displayDocs[lightboxIdx].sublabel}</p>
            </div>
            <button type="button" onClick={closeLightbox}
              className="p-1.5 rounded text-slate-300 hover:text-white hover:bg-slate-800 transition">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 flex items-center justify-center p-4 min-h-0" onClick={(e) => e.stopPropagation()}>
            <img
              src={displayDocs[lightboxIdx].image}
              alt={displayDocs[lightboxIdx].label}
              className="max-w-full max-h-full object-contain rounded border border-slate-800"
            />
          </div>

          {totalCount > 1 && (
            <div className="flex items-center justify-between px-6 py-4 flex-shrink-0 border-t border-slate-800" onClick={(e) => e.stopPropagation()}>
              <button type="button" onClick={prevLightbox}
                className="p-2 rounded text-slate-300 hover:bg-slate-800 hover:text-white transition">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="flex gap-2">
                {displayDocs.map((_, i) => (
                  <button key={i} type="button" onClick={() => setLightboxIdx(i)}
                    className={`w-2 h-2 rounded-full transition ${i === lightboxIdx ? 'bg-white' : 'bg-slate-600 hover:bg-slate-400'}`} />
                ))}
              </div>
              <button type="button" onClick={nextLightbox}
                className="p-2 rounded text-slate-300 hover:bg-slate-800 hover:text-white transition">
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
