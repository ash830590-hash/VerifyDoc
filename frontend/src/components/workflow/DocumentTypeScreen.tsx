"use client";
import React, { useState } from 'react';
import { DocumentType } from '@/types';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  FileText,
  XCircle,
  AlertTriangle,
  CheckCircle2,
  MinusCircle,
  Home,
  Building,
  Briefcase,
  Calculator,
  User,
  Plane,
  CreditCard,
  UserCheck,
} from 'lucide-react';

import { CapturedDoc } from '@/components/scanner/WebCamScanner';

export type DocStatus = 'scanned' | 'na' | 'unchecked';

export interface DocChecklistEntry {
  docType: DocumentType;
  status: DocStatus;
  fileName: string;
}

export type UnavailableDocFlags = Record<DocumentType, boolean>;

interface DocumentTypeScreenProps {
  initialType: DocumentType;
  initialConfidence?: number;
  initialFileName?: string;
  sessionDocs?: CapturedDoc[];
  onBack: () => void;
  onContinue: (
    primaryDoc: DocumentType,
    fileName: string,
    unavailableDocs: UnavailableDocFlags,
    checklist: DocChecklistEntry[]
  ) => void;
}

const DOC_OPTIONS: {
  type: DocumentType;
  label: string;
  desc: string;
  icon: React.ReactNode;
}[] = [
  { type: 'passport', label: 'Passport', desc: 'Standard biometric passport', icon: <BookOpen className="w-4 h-4" /> },
  { type: 'aadhaar', label: 'Aadhaar Card', desc: 'UIDAI Aadhaar national identity card', icon: <CreditCard className="w-4 h-4" /> },
  { type: 'pan', label: 'PAN Card', desc: 'Income Tax Dept Permanent Account Number', icon: <CreditCard className="w-4 h-4" /> },
  { type: 'voter_id', label: 'Voter ID (EPIC)', desc: 'Election Commission of India identity card', icon: <UserCheck className="w-4 h-4" /> },
  { type: 'driving_license', label: 'Driving Licence', desc: 'State motor vehicle driving licence', icon: <FileText className="w-4 h-4" /> },
  { type: 'proof_of_address', label: 'Proof of Address', desc: 'Utility bill or official letter', icon: <Home className="w-4 h-4" /> },
  { type: 'bank_statement', label: 'Bank Statement', desc: 'Recent financial statement', icon: <Building className="w-4 h-4" /> },
  { type: 'employment_letter', label: 'Employment Letter', desc: 'Official employer verification', icon: <Briefcase className="w-4 h-4" /> },
  { type: 'tax_documents', label: 'Tax Documents', desc: 'Income tax or local tax records', icon: <Calculator className="w-4 h-4" /> },
  { type: 'birth_certificate', label: 'Birth Certificate', desc: 'Official government issued', icon: <User className="w-4 h-4" /> },
  { type: 'visa', label: 'Visa', desc: 'Travel or work visa stamp', icon: <Plane className="w-4 h-4" /> },
  { type: 'residence_permit', label: 'Residence Permit', desc: 'Local residency card', icon: <FileText className="w-4 h-4" /> },
];

export default function DocumentTypeScreen({
  initialType,
  initialConfidence = 98,
  initialFileName,
  sessionDocs = [],
  onBack,
  onContinue,
}: DocumentTypeScreenProps) {

  const [entries, setEntries] = useState<DocChecklistEntry[]>(() => {
    return DOC_OPTIONS.map((opt) => {
      const docInSession = sessionDocs.find(d => d.docType === opt.type);
      const isScanned = !!docInSession || opt.type === initialType;
      const fName = docInSession?.fileName || (opt.type === initialType ? (initialFileName || `${opt.type}_001`) : `${opt.type}_001`);
      return {
        docType: opt.type,
        status: isScanned ? 'scanned' : 'unchecked',
        fileName: fName,
      };
    });
  });

  const [editingType, setEditingType] = useState<DocumentType | null>(null);

  const scannedCount  = entries.filter(e => e.status === 'scanned').length;
  const naCount       = entries.filter(e => e.status === 'na').length;

  const setStatus = (type: DocumentType, status: DocStatus) => {
    setEntries(prev => prev.map(e => e.docType === type ? { ...e, status } : e));
  };

  const toggleStatus = (type: DocumentType) => {
    const cur = entries.find(e => e.docType === type)!;
    if (cur.status === 'unchecked') setStatus(type, 'scanned');
    else if (cur.status === 'scanned') setStatus(type, 'unchecked');
  };

  const toggleNA = (type: DocumentType) => {
    const cur = entries.find(e => e.docType === type)!;
    setStatus(type, cur.status === 'na' ? 'unchecked' : 'na');
  };

  const updateFileName = (type: DocumentType, name: string) => {
    setEntries(prev => prev.map(e => e.docType === type ? { ...e, fileName: name } : e));
  };

  const handleContinue = () => {
    const primary = entries.find(e => e.docType === initialType && e.status === 'scanned')
      || entries.find(e => e.status === 'scanned');
    if (!primary) return;
    const unavailable: UnavailableDocFlags = entries.reduce((acc, curr) => {
      acc[curr.docType] = (curr.status === 'na');
      return acc;
    }, {} as UnavailableDocFlags);
    onContinue(primary.docType, primary.fileName, unavailable, entries);
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 text-slate-900 select-none">

      {/* ── Top bar ── */}
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-slate-200 flex-shrink-0">
        <button type="button" onClick={onBack}
          className="text-slate-600 hover:text-slate-900 flex items-center gap-1 text-sm font-medium">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div className="text-center">
          <h2 className="text-sm font-semibold text-slate-900">Document Checklist</h2>
        </div>
        <div className="w-10" />
      </div>

      {/* ── Scrollable body ── */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {naCount > 0 && (
          <div className="flex items-center gap-2 bg-slate-100 border border-slate-300 rounded-lg px-3 py-2.5">
            <AlertTriangle className="w-4 h-4 text-slate-600 flex-shrink-0" />
            <p className="text-xs text-slate-700 leading-snug">
              {naCount} document{naCount > 1 ? 's' : ''} marked <strong>Missing</strong> — recorded in audit log.
            </p>
          </div>
        )}

        <div className="space-y-2">
          {DOC_OPTIONS.map((opt) => {
            const entry  = entries.find(e => e.docType === opt.type)!;
            const isScanned   = entry.status === 'scanned';
            const isNA        = entry.status === 'na';
            const isEditing   = editingType === opt.type;

            return (
              <div key={opt.type}
                className={`rounded-lg border transition-all ${
                  isNA
                    ? 'bg-slate-100 border-slate-300 opacity-75'
                    : isScanned
                    ? `bg-white border-blue-700 border-2`
                    : 'bg-white border-slate-200'
                }`}>

                <div className="flex items-center p-3 gap-3">
                  <button type="button"
                    disabled={isNA}
                    onClick={() => toggleStatus(opt.type)}
                    className="flex-shrink-0">
                    {isScanned ? (
                      <CheckCircle2 className="w-5 h-5 text-blue-700" />
                    ) : isNA ? (
                      <MinusCircle className="w-5 h-5 text-slate-400" />
                    ) : (
                      <div className="w-5 h-5 rounded-sm border border-slate-300 bg-white" />
                    )}
                  </button>

                  <div className={`p-1.5 rounded-md flex-shrink-0 ${isNA ? 'bg-slate-200 text-slate-400' : 'bg-slate-100 text-slate-600'}`}>
                    {opt.icon}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${isNA ? 'text-slate-500 line-through' : 'text-slate-900'}`}>
                      {opt.label}
                    </p>
                    <p className="text-xs text-slate-500 truncate">{opt.desc}</p>
                  </div>

                  <button type="button"
                    onClick={() => toggleNA(opt.type)}
                    title={isNA ? 'Mark available' : 'Mark as missing'}
                    className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium border flex-shrink-0 transition ${
                      isNA
                        ? 'bg-slate-200 border-slate-300 text-slate-700'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}>
                    <XCircle className="w-3.5 h-3.5" />
                    {isNA ? 'Missing' : 'Missing?'}
                  </button>
                </div>

                {isScanned && (
                  <div className={`px-3 pb-3 border-t border-slate-100 pt-2`}>
                    <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider mb-1">
                      File name
                    </p>
                    {isEditing ? (
                      <input
                        autoFocus
                        type="text"
                        value={entry.fileName}
                        onChange={(e) => updateFileName(opt.type, e.target.value)}
                        onBlur={() => setEditingType(null)}
                        onKeyDown={(e) => { if (e.key === 'Enter') setEditingType(null); }}
                        className="w-full px-2.5 py-1.5 rounded bg-white border border-slate-300 text-xs font-mono text-slate-900 focus:outline-none focus:border-blue-700"
                        placeholder={`${opt.type}_001`}
                      />
                    ) : (
                      <button type="button"
                        onClick={() => setEditingType(opt.type)}
                        className="w-full text-left px-2.5 py-1.5 rounded border border-slate-200 bg-slate-50 flex items-center justify-between group transition hover:bg-slate-100">
                        <span className="text-xs font-mono text-slate-700">
                          {entry.fileName || `${opt.type}_001`}
                        </span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Bottom CTA ── */}
      <div className="flex-shrink-0 p-4 bg-white border-t border-slate-200">
        {scannedCount === 0 ? (
          <div className="text-center py-2 text-sm text-slate-500">
            Check at least one document to continue
          </div>
        ) : (
          <button type="button" onClick={handleContinue}
            className="w-full py-2.5 rounded-md bg-blue-700 text-white font-medium text-sm hover:bg-blue-800 transition flex items-center justify-center gap-2">
            <span>
              Continue ({scannedCount} selected)
            </span>
            <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
