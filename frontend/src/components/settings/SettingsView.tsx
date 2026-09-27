"use client";
import React, { useState } from 'react';
import { Settings, Server, Shield, Smartphone } from 'lucide-react';

interface SettingsViewProps {
  ocrEngine: string;
  setOcrEngine: (engine: string) => void;
  onBackToScan: () => void;
}

export default function SettingsView({ ocrEngine, setOcrEngine, onBackToScan }: SettingsViewProps) {
  const [apiUrl, setApiUrl] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('custom_api_url');
      if (saved) return saved;
    }
    return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  });
  const [sensitivity, setSensitivity] = useState<'standard' | 'strict'>('standard');
  const [autoCrop, setAutoCrop] = useState<boolean>(true);
  const [testSaved, setTestSaved] = useState<boolean>(false);

  const handleSave = () => {
    if (typeof window !== 'undefined') {
      const trimmed = apiUrl.trim();
      if (trimmed) {
        localStorage.setItem('custom_api_url', trimmed);
      } else {
        localStorage.removeItem('custom_api_url');
      }
    }
    setTestSaved(true);
    setTimeout(() => setTestSaved(false), 2000);
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 text-slate-900 justify-between select-none">
      <div className="px-4 py-3 bg-white border-b border-slate-200 flex items-center justify-between flex-shrink-0">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Settings</h2>
          <p className="text-[10px] text-slate-500">Scanner & API Configuration</p>
        </div>
        <div className="w-8 h-8 rounded bg-slate-50 border border-slate-200 flex items-center justify-center">
          <Settings className="w-4 h-4 text-slate-600" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 max-w-sm mx-auto w-full">
        <div className="bg-white rounded-lg p-4 border border-slate-200">
          <div className="flex items-center gap-2 mb-3">
            <Server className="w-4 h-4 text-slate-600" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-800">
              API Connection
            </h3>
          </div>
          <p className="text-xs text-slate-500 mb-4">
            Endpoint for OCR, format verification, and tampering models.
          </p>

          <label className="text-[10px] font-semibold text-slate-600 block mb-1.5 uppercase tracking-wide">
            Server URL
          </label>
          <input
            type="text"
            value={apiUrl}
            onChange={(e) => setApiUrl(e.target.value)}
            className="w-full px-3 py-2 rounded bg-slate-50 border border-slate-300 font-mono text-xs text-slate-900 focus:outline-none focus:border-blue-600 transition-colors"
          />
          <div className="flex items-center justify-between mt-2">
            <span className="text-[10px] text-slate-400 font-mono">Default: http://localhost:8000</span>
            <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
              Connected
            </span>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100">
            <label className="text-[10px] font-semibold text-slate-600 block mb-1.5 uppercase tracking-wide">
              OCR Engine
            </label>
            <select
              value={ocrEngine}
              onChange={(e) => setOcrEngine(e.target.value)}
              className="w-full px-3 py-2 rounded bg-slate-50 border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-blue-600 transition-colors"
            >
              <option value="auto">Auto (PaddleOCR → Tesseract)</option>
              <option value="paddleocr">PaddleOCR (High Accuracy)</option>
              <option value="tesseract">Tesseract OCR (Fast)</option>
              <option value="easyocr">EasyOCR (Deep Learning)</option>
            </select>
          </div>
        </div>

        <div className="bg-white rounded-lg p-4 border border-slate-200">
          <div className="flex items-center gap-2 mb-3">
            <Shield className="w-4 h-4 text-slate-600" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-800">
              Security Threshold
            </h3>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-4">
            <button
              type="button"
              onClick={() => setSensitivity('standard')}
              className={`p-3 rounded-md text-left border transition-colors ${
                sensitivity === 'standard'
                  ? 'border-blue-600 bg-blue-50/50'
                  : 'border-slate-200 bg-white hover:bg-slate-50'
              }`}
            >
              <div className="text-xs font-semibold text-slate-900">Standard</div>
              <div className="text-[10px] text-slate-500 mt-1 leading-snug">Balanced detection threshold</div>
            </button>

            <button
              type="button"
              onClick={() => setSensitivity('strict')}
              className={`p-3 rounded-md text-left border transition-colors ${
                sensitivity === 'strict'
                  ? 'border-blue-600 bg-blue-50/50'
                  : 'border-slate-200 bg-white hover:bg-slate-50'
              }`}
            >
              <div className="text-xs font-semibold text-slate-900">Strict</div>
              <div className="text-[10px] text-slate-500 mt-1 leading-snug">High security, zero tolerance</div>
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg p-4 border border-slate-200">
          <div className="flex items-center gap-2 mb-4">
            <Smartphone className="w-4 h-4 text-slate-600" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-800">
              Scanner Preferences
            </h3>
          </div>

          <div className="flex items-center justify-between py-1">
            <div>
              <div className="text-xs font-medium text-slate-800">Auto Edge Detection</div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                Identify document corners on capture
              </div>
            </div>
            <input
              type="checkbox"
              checked={autoCrop}
              onChange={(e) => setAutoCrop(e.target.checked)}
              className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
            />
          </div>
        </div>
      </div>

      <div className="p-4 bg-white border-t border-slate-200 flex items-center gap-3 flex-shrink-0">
        <button
          type="button"
          onClick={handleSave}
          className="flex-1 py-2.5 rounded-md border border-slate-300 text-slate-700 font-medium text-sm hover:bg-slate-50 transition text-center"
        >
          {testSaved ? 'Saved' : 'Save Config'}
        </button>
        <button
          type="button"
          onClick={onBackToScan}
          className="flex-1 py-2.5 rounded-md bg-blue-700 text-white font-medium text-sm hover:bg-blue-800 transition text-center"
        >
          Back to Scan
        </button>
      </div>
    </div>
  );
}
