"use client";
import React from 'react';
import { HistoryItem } from '@/types';
import { BookOpen, FileText, ChevronRight, Clock, ShieldCheck, ShieldAlert, Home, Building, Briefcase, Calculator, User, Plane, CreditCard, UserCheck } from 'lucide-react';

interface HistoryViewProps {
  history: HistoryItem[];
  onSelectRecord: (record: HistoryItem) => void;
  onStartNewScan: () => void;
}

export default function HistoryView({
  history,
  onSelectRecord,
  onStartNewScan,
}: HistoryViewProps) {
  const getDocIcon = (type: string) => {
    switch (type) {
      case 'passport': return <BookOpen className="w-5 h-5 text-blue-700" />;
      case 'aadhaar': return <CreditCard className="w-5 h-5 text-blue-700" />;
      case 'pan': return <CreditCard className="w-5 h-5 text-blue-700" />;
      case 'voter_id': return <UserCheck className="w-5 h-5 text-blue-700" />;
      case 'driving_license': return <FileText className="w-5 h-5 text-blue-700" />;
      case 'proof_of_address': return <Home className="w-5 h-5 text-blue-700" />;
      case 'bank_statement': return <Building className="w-5 h-5 text-blue-700" />;
      case 'employment_letter': return <Briefcase className="w-5 h-5 text-blue-700" />;
      case 'tax_documents': return <Calculator className="w-5 h-5 text-blue-700" />;
      case 'birth_certificate': return <User className="w-5 h-5 text-blue-700" />;
      case 'visa': return <Plane className="w-5 h-5 text-blue-700" />;
      case 'residence_permit': return <FileText className="w-5 h-5 text-blue-700" />;
      default: return <FileText className="w-5 h-5 text-slate-500" />;
    }
  };

  const getDocName = (type: string) => {
    if (type === 'aadhaar') return 'Aadhaar Card';
    if (type === 'pan') return 'PAN Card';
    if (type === 'voter_id') return 'Voter ID (EPIC)';
    if (type === 'driving_license') return 'Driving Licence';
    return type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 text-slate-900 justify-between select-none">
      <div className="px-4 py-3 bg-white border-b border-slate-200 flex items-center justify-between flex-shrink-0">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Scan History</h2>
          <p className="text-[10px] text-slate-500">Stored verification audits</p>
        </div>
        <span className="text-[11px] font-semibold bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded border border-slate-200">
          {history.length} scans
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {history.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-center p-6 border border-dashed border-slate-300 rounded-lg bg-white/50 mt-4">
            <div className="w-10 h-10 rounded bg-slate-100 text-slate-400 flex items-center justify-center mb-3">
              <Clock className="w-5 h-5" />
            </div>
            <p className="text-sm font-medium text-slate-700">No recent scans</p>
            <p className="text-xs text-slate-500 mt-1">
              Completed verifications will be logged here.
            </p>
          </div>
        ) : (
          history.map((item) => {
            const isAccepted = item.riskLevel === 'ACCEPTED';
            const isReview = item.riskLevel === 'REVIEW REQUIRED';
            const isFailed = item.riskLevel === 'FAILED';
            const isMissing = item.riskLevel === 'MISSING';

            return (
              <div
                key={item.id}
                onClick={() => onSelectRecord(item)}
                className="bg-white rounded-lg p-3.5 border border-slate-200 hover:border-blue-300 transition-colors cursor-pointer group"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded bg-slate-50 border border-slate-100 flex items-center justify-center flex-shrink-0">
                      {getDocIcon(item.documentType)}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-900">
                          {getDocName(item.documentType)}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400 border border-slate-100 px-1 rounded">
                          {item.identifier}
                        </span>
                      </div>

                      <div className="text-xs text-slate-600 mt-0.5 font-medium">
                        {item.holderName}
                      </div>

                      <div className="flex items-center gap-2 mt-2">
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded tracking-wide uppercase ${
                            isAccepted
                              ? 'bg-emerald-50 text-emerald-700'
                              : isReview
                              ? 'bg-amber-50 text-amber-700'
                              : isFailed
                              ? 'bg-rose-50 text-rose-700'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {item.riskLevel}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-end justify-between h-full">
                    <span className="text-[10px] font-medium text-slate-400">{item.timeAgo}</span>
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-600 transition mt-3" />
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="p-4 bg-white border-t border-slate-200 flex-shrink-0">
        <button
          type="button"
          onClick={onStartNewScan}
          className="w-full py-2.5 rounded-md bg-blue-700 text-white font-medium text-sm hover:bg-blue-800 transition flex items-center justify-center gap-2"
        >
          <span>Start New Scan</span>
        </button>
      </div>
    </div>
  );
}
