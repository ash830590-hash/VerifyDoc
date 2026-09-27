"use client";
import React, { useState } from 'react';
import { DocumentType, ExtractedField } from '@/types';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Edit2,
  AlertTriangle,
  BookOpen,
  FileText,
  XCircle,
  Home,
  Building,
  Briefcase,
  Calculator,
  User,
  Plane,
  ScanLine,
  CreditCard,
  UserCheck,
} from 'lucide-react';
import { DocChecklistEntry } from '@/components/workflow/DocumentTypeScreen';
import { CapturedDoc } from '@/components/scanner/WebCamScanner';

const DOC_META: Record<string, {
  label: string;
  shortLabel: string;
  icon: React.ReactNode;
}> = {
  passport: { label: 'Passport', shortLabel: 'Passport', icon: <BookOpen className="w-3.5 h-3.5" /> },
  aadhaar: { label: 'Aadhaar Card', shortLabel: 'Aadhaar', icon: <CreditCard className="w-3.5 h-3.5" /> },
  pan: { label: 'PAN Card', shortLabel: 'PAN Card', icon: <CreditCard className="w-3.5 h-3.5" /> },
  voter_id: { label: 'Voter ID (EPIC)', shortLabel: 'Voter ID', icon: <UserCheck className="w-3.5 h-3.5" /> },
  driving_license: { label: 'Driving Licence', shortLabel: 'Licence', icon: <FileText className="w-3.5 h-3.5" /> },
  proof_of_address: { label: 'Proof of Address', shortLabel: 'Address', icon: <Home className="w-3.5 h-3.5" /> },
  bank_statement: { label: 'Bank Statement', shortLabel: 'Bank', icon: <Building className="w-3.5 h-3.5" /> },
  employment_letter: { label: 'Employment Letter', shortLabel: 'Employment', icon: <Briefcase className="w-3.5 h-3.5" /> },
  tax_documents: { label: 'Tax Documents', shortLabel: 'Tax', icon: <Calculator className="w-3.5 h-3.5" /> },
  birth_certificate: { label: 'Birth Certificate', shortLabel: 'Birth Cert', icon: <User className="w-3.5 h-3.5" /> },
  visa: { label: 'Visa', shortLabel: 'Visa', icon: <Plane className="w-3.5 h-3.5" /> },
  residence_permit: { label: 'Residence Permit', shortLabel: 'Residence', icon: <FileText className="w-3.5 h-3.5" /> },
};

function getDocMeta(type: string) {
  if (DOC_META[type]) return DOC_META[type];
  const short = type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  return { label: short, shortLabel: short, icon: <FileText className="w-3.5 h-3.5" /> };
}

interface ExtractionScreenProps {
  documentType: DocumentType;
  fileName: string;
  documentImage: string;
  backImage?: string;
  initialFields: Record<string, ExtractedField>;
  sessionChecklist?: DocChecklistEntry[];
  allDocFields?: Record<string, Record<string, ExtractedField>>;
  sessionDocs?: CapturedDoc[];
  onBack: () => void;
  onProceedToVerification: (updatedFields: Record<string, ExtractedField>) => void;
}

function FieldsPanel({
  fields,
  onUpdate,
}: {
  fields: Record<string, ExtractedField>;
  onUpdate: (updated: Record<string, ExtractedField>) => void;
}) {
  const [localFields, setLocalFields] = useState(fields);
  const [editingKey, setEditingKey] = useState<string | null>(null);

  const handleChange = (key: string, value: string) => {
    const updated = { ...localFields, [key]: { ...localFields[key], value } };
    setLocalFields(updated);
    onUpdate(updated);
  };

  const fieldKeys = Object.keys(localFields);

  return (
    <div className="space-y-2">
      {fieldKeys.map((key) => {
        const field = localFields[key];
        if (!field) return null;
        const isEditing = editingKey === key;
        const highConf = field.confidence >= 90;

        return (
          <div
            key={key}
            className={`bg-white rounded-md p-3 border transition-colors ${
              isEditing ? 'border-blue-700' : 'border-slate-200'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-slate-500">{field.label}</span>
              <div className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded border ${
                highConf ? 'bg-slate-50 text-slate-700 border-slate-200' : 'bg-rose-50 text-rose-700 border-rose-200'
              }`}>
                {highConf
                  ? <CheckCircle2 className="w-3 h-3 text-slate-400" />
                  : <AlertTriangle className="w-3 h-3 text-rose-500" />}
                {field.confidence}% match
              </div>
            </div>

            {isEditing ? (
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="text"
                  value={field.value}
                  autoFocus
                  onChange={(e) => handleChange(key, e.target.value)}
                  onBlur={() => setEditingKey(null)}
                  onKeyDown={(e) => { if (e.key === 'Enter') setEditingKey(null); }}
                  className="flex-1 px-2.5 py-1.5 rounded border border-blue-500 font-mono text-xs text-slate-900 focus:outline-none"
                />
                <button type="button" onClick={() => setEditingKey(null)}
                  className="text-xs font-medium text-blue-700 px-3 py-1.5 hover:bg-slate-50 border border-slate-200 rounded">
                  Done
                </button>
              </div>
            ) : (
              <div onClick={() => setEditingKey(key)}
                className="flex items-center justify-between cursor-pointer group py-0.5">
                <span className="text-sm font-medium text-slate-900 leading-snug">{field.value}</span>
                <Edit2 className="w-3.5 h-3.5 text-slate-400 opacity-60 group-hover:opacity-100 group-hover:text-blue-700 transition ml-2 flex-shrink-0" />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function ExtractionScreen({
  documentType,
  fileName,
  documentImage,
  backImage,
  initialFields,
  sessionChecklist = [],
  allDocFields = {},
  sessionDocs = [],
  onBack,
  onProceedToVerification,
}: ExtractionScreenProps) {

  const scannedEntries = sessionChecklist.filter(e => e.status === 'scanned');
  const naEntries      = sessionChecklist.filter(e => e.status === 'na');

  const tabDocs = scannedEntries.length > 0
    ? scannedEntries
    : [{ docType: documentType, status: 'scanned' as const, fileName }];

  const [activeDocType, setActiveDocType] = useState<DocumentType>(
    tabDocs.some(d => d.docType === documentType) ? documentType : (tabDocs[0]?.docType || documentType)
  );

  const [fieldOverrides, setFieldOverrides] = useState<Record<string, Record<string, ExtractedField>>>({});

  const getFields = (dt: DocumentType): Record<string, ExtractedField> => {
    const base = allDocFields[dt] || (dt === documentType ? initialFields : {});
    return { ...(base || {}), ...(fieldOverrides[dt] || {}) };
  };

  const handleUpdate = (dt: DocumentType, updated: Record<string, ExtractedField>) => {
    setFieldOverrides(prev => ({ ...prev, [dt]: updated }));
  };

  const handleProceed = () => {
    const primaryFields = getFields(documentType);
    onProceedToVerification(primaryFields);
  };

  const activeMeta    = getDocMeta(activeDocType);
  const activeEntry   = tabDocs.find(e => e.docType === activeDocType);
  const activeFields  = getFields(activeDocType);
  const fieldCount    = Object.keys(activeFields).length;

  const frontDoc = sessionDocs.find(d => d.docType === activeDocType && (d.side === 'front' || d.side === 'single'));
  const backDoc  = sessionDocs.find(d => d.docType === activeDocType && d.side === 'back');
  const frontImg = frontDoc?.processedImage || frontDoc?.rawImage || documentImage;
  const backImg  = backDoc?.processedImage  || backDoc?.rawImage  || (activeDocType === documentType ? backImage : undefined);

  const [activeSide, setActiveSide] = useState<'front' | 'back'>('front');

  return (
    <div className="flex flex-col h-full bg-slate-50 text-slate-900 select-none">
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-slate-200 flex-shrink-0">
        <button type="button" onClick={onBack}
          className="text-slate-600 hover:text-slate-900 flex items-center gap-1 text-sm font-medium">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div className="text-center">
          <h2 className="text-sm font-semibold text-slate-900">Extracted Data</h2>
        </div>
        <span className="text-xs font-mono font-medium text-slate-600 truncate max-w-[80px]">
          {activeEntry?.fileName || fileName}
        </span>
      </div>

      {tabDocs.length > 1 && (
        <div className="flex-shrink-0 px-4 py-2.5 bg-white border-b border-slate-200 flex gap-2 overflow-x-auto scrollbar-none">
          {tabDocs.map((entry) => {
            const m = getDocMeta(entry.docType);
            const isActive = activeDocType === entry.docType;
            const fCount = Object.keys(getFields(entry.docType)).length;
            return (
              <button key={entry.docType} type="button"
                onClick={() => { setActiveDocType(entry.docType as DocumentType); setActiveSide('front'); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap flex-shrink-0 transition border ${
                  isActive
                    ? 'bg-blue-700 text-white border-blue-700'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}>
                {m.icon}
                {m.shortLabel}
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                  isActive ? 'bg-blue-800 text-blue-100' : 'bg-slate-100 text-slate-500'
                }`}>
                  {fCount}
                </span>
              </button>
            );
          })}

          {naEntries.map((entry) => {
            const m = getDocMeta(entry.docType);
            return (
              <div key={entry.docType}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap flex-shrink-0 bg-slate-50 text-slate-400 border border-slate-200 opacity-70">
                <XCircle className="w-3.5 h-3.5 text-slate-400" />
                {m.shortLabel}
                <span className="text-[10px] text-slate-400 font-semibold">Missing</span>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="w-full bg-white rounded-lg p-3 border border-slate-200">
          {backImg && (
            <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
              <span className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Document Scan</span>
              <div className="flex gap-1 bg-slate-100 p-1 rounded-md text-[10px] font-semibold">
                {(['front', 'back'] as const).map(s => (
                  <button key={s} type="button" onClick={() => setActiveSide(s)}
                    className={`px-2.5 py-1 rounded capitalize transition ${
                      activeSide === s ? 'bg-white text-slate-900 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-900'
                    }`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="relative w-full rounded bg-slate-50 border border-slate-200 p-2">
            <img
              src={activeSide === 'back' && backImg ? backImg : frontImg}
              alt="Document source"
              className="w-full h-32 object-contain"
            />
            <div className="absolute top-2 left-2 bg-slate-900/70 text-white text-[10px] font-medium px-2 py-0.5 rounded flex items-center gap-1.5">
              <ScanLine className="w-3 h-3 text-white/70" />
              OCR Reference
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between mt-2">
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">
            Extracted Data
          </span>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-semibold text-slate-600 bg-slate-200 px-2 py-0.5 rounded border border-slate-300">
              {fieldCount} fields
            </span>
          </div>
        </div>

        {fieldCount === 0 ? (
          <div className="bg-white rounded-lg p-6 border border-slate-200 text-center text-slate-500">
            <FileText className="w-8 h-8 mx-auto mb-2 text-slate-300" />
            <p className="text-sm font-medium">No fields extracted</p>
          </div>
        ) : (
          <FieldsPanel
            key={activeDocType}
            fields={activeFields}
            onUpdate={(updated) => handleUpdate(activeDocType as DocumentType, updated)}
          />
        )}
      </div>

      <div className="flex-shrink-0 p-4 bg-white border-t border-slate-200">
        <button type="button" onClick={handleProceed}
          className="w-full py-2.5 rounded-md bg-blue-700 text-white font-medium text-sm hover:bg-blue-800 transition flex items-center justify-center gap-2">
          <span>Verify Document</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
