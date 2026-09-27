"use client";
import React, { useState, useEffect } from 'react';
import WebCamScanner, { ScanSessionPayload } from '@/components/scanner/WebCamScanner';
import ManualCropWrapper from '@/components/scanner/ManualCropWrapper';
import ScanReviewScreen from '@/components/workflow/ScanReviewScreen';
import DocumentTypeScreen, { UnavailableDocFlags, DocChecklistEntry } from '@/components/workflow/DocumentTypeScreen';
import ExtractionScreen from '@/components/workflow/ExtractionScreen';
import VerificationScreen from '@/components/workflow/VerificationScreen';
import AadhaarEkycScreen from '@/components/workflow/AadhaarEkycScreen';
import FinalResultScreen from '@/components/workflow/FinalResultScreen';
import HistoryView from '@/components/history/HistoryView';
import SettingsView from '@/components/settings/SettingsView';

import {
  ocr,
  validateDocument,
  detectTampering,
  verifyFace,
  calculateRisk,
  getApiBaseUrl,
} from '@/services/verificationService';
import {
  DocumentType,
  ExtractedField,
  VerificationResult,
  HistoryItem,
  AadhaarEkycData,
} from '@/types';
import { Point, processScanWithFallback } from '@/utils/scannerUtils';
import { CapturedDoc } from '@/components/scanner/WebCamScanner';
import { Camera, History, Settings, Loader2 } from 'lucide-react';

type WorkflowStep =
  | 'scanner'
  | 'crop'
  | 'review'
  | 'doc-type'
  | 'ocr-loading'
  | 'extract'
  | 'ekyc'
  | 'verify'
  | 'result';

export default function SecureScanApp() {
  const [activeTab, setActiveTab] = useState<'scan' | 'history' | 'settings'>('scan');
  const [step, setStep] = useState<WorkflowStep>('scanner');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [ocrEngine, setOcrEngine] = useState<string>('auto');

  // Active Session State
  const [rawImage, setRawImage] = useState<string>('');
  const [processedImage, setProcessedImage] = useState<string>('');
  const [backRawImage, setBackRawImage] = useState<string | undefined>();
  const [backProcessedImage, setBackProcessedImage] = useState<string | undefined>();
  const [savedFilePaths, setSavedFilePaths] = useState<{ front?: string; back?: string }>({});

  const [corners, setCorners] = useState<Point[]>([]);
  const [detectedType, setDetectedType] = useState<DocumentType>('passport');
  const [confidence, setConfidence] = useState<number>(98);
  const [fileName, setFileName] = useState<string>('passport_001');
  const [isSuspicious, setIsSuspicious] = useState<boolean>(false);
  const [extractedFields, setExtractedFields] = useState<Record<string, ExtractedField>>({});
  const [ekycData, setEkycData] = useState<AadhaarEkycData | null>(null);
  const [finalResult, setFinalResult] = useState<VerificationResult | null>(null);
  const [unavailableDocs, setUnavailableDocs] = useState<UnavailableDocFlags>({
    passport: false,
    aadhaar: false,
    pan: false,
    voter_id: false,
    driving_license: false,
    proof_of_address: false,
    bank_statement: false,
    employment_letter: false,
    tax_documents: false,
    birth_certificate: false,
    visa: false,
    residence_permit: false,
  });

  // All docs captured in the current session (for gallery review)
  const [sessionDocs, setSessionDocs] = useState<CapturedDoc[]>([]);

  // Checklist from DocumentTypeScreen (all docs with status)
  const [sessionChecklist, setSessionChecklist] = useState<DocChecklistEntry[]>([]);

  // OCR fields keyed by docType — holds results for ALL scanned docs
  const [allDocFields, setAllDocFields] = useState<Record<string, Record<string, ExtractedField>>>({}); 

  // Pre-populated History items with all requested document presets
  const [history, setHistory] = useState<HistoryItem[]>([]);

  useEffect(() => {
    const apiBase = getApiBaseUrl();
    const endpoint = apiBase ? `${apiBase}/api/history` : '/api/history';
    fetch(endpoint)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setHistory(data);
      })
      .catch(err => console.error("Error fetching history:", err));
  }, []);

  // 1. Multi-doc session completed from scanner
  const handleSessionComplete = (session: ScanSessionPayload) => {
    const primary = session.primaryDoc;

    // Store all session docs for gallery review
    setSessionDocs(session.documents);

    // Set primary doc as active document for downstream verification
    setRawImage(primary.rawImage);
    setProcessedImage(primary.processedImage);
    setSavedFilePaths({ front: primary.savedPath });

    // If there is a back-side doc for the same type, store it
    const backDoc = session.documents.find(
      (d) => d.docType === primary.docType && d.side === 'back'
    );
    if (backDoc) {
      setBackRawImage(backDoc.rawImage);
      setBackProcessedImage(backDoc.processedImage);
      setSavedFilePaths({ front: primary.savedPath, back: backDoc.savedPath });
    }

    setCorners(primary.corners);
    setDetectedType(primary.docType);
    setConfidence(primary.qualityScore || 97);
    setFileName(primary.fileName);
    setIsSuspicious(primary.isSuspicious);

    setStep('review');
  };

  // 2. Manual corner adjust confirm
  const handleManualCropConfirm = async (data: {
    points: Point[];
    horizontalTilt: number;
    verticalTilt: number;
  }) => {
    setCorners(data.points);
    const newProcessed = await processScanWithFallback(
      rawImage,
      data.points,
      data.horizontalTilt,
      data.verticalTilt
    );
    setProcessedImage(newProcessed);
    setStep('review');
  };

  // 3. Scan accepted -> Document details screen
  const handleAcceptScan = () => {
    setStep('doc-type');
  };

  // 4. Document checklist confirmed -> Run OCR on all scanned docs
  const handleDocTypeContinue = async (
    primaryDoc: DocumentType,
    name: string,
    unavailable: UnavailableDocFlags,
    checklist: DocChecklistEntry[]
  ) => {
    setDetectedType(primaryDoc);
    setFileName(name);
    setUnavailableDocs(unavailable);
    setSessionChecklist(checklist);

    // Sync active image with primaryDoc if available in session
    const primaryDocObj = sessionDocs.find(d => d.docType === primaryDoc);
    if (primaryDocObj) {
      setRawImage(primaryDocObj.rawImage);
      setProcessedImage(primaryDocObj.processedImage);
      const backDoc = sessionDocs.find(d => d.docType === primaryDoc && d.side === 'back');
      if (backDoc) {
        setBackRawImage(backDoc.rawImage);
        setBackProcessedImage(backDoc.processedImage);
      }
    }

    setStep('ocr-loading');

    // Run OCR for every doc marked as 'scanned'
    const scannedEntries = checklist.filter(e => e.status === 'scanned');
    const fieldsMap: Record<string, Record<string, ExtractedField>> = {};
    for (const entry of scannedEntries) {
      const matchDoc = sessionDocs.find(d => d.docType === entry.docType);
      const imgToOcr = matchDoc?.processedImage || matchDoc?.rawImage || processedImage || rawImage;
      const docSuspicious = matchDoc ? matchDoc.isSuspicious : isSuspicious;

      fieldsMap[entry.docType] = await ocr(
        imgToOcr,
        entry.docType,
        docSuspicious,
        ocrEngine
      );
    }
    setAllDocFields(fieldsMap);

    // Set primary doc fields for downstream verification
    setExtractedFields(fieldsMap[primaryDoc] || {});
    setStep('extract');
  };

  // 5. Extraction confirmed -> eKYC for Aadhaar, or AI verification screen
  const handleProceedToVerification = (updatedFields: Record<string, ExtractedField>) => {
    setExtractedFields(updatedFields);
    if (detectedType === 'aadhaar') {
      setStep('ekyc');
    } else {
      setStep('verify');
    }
  };

  const handleEkycVerified = (data: AadhaarEkycData) => {
    setEkycData(data);
    setStep('verify');
  };

  const handleEkycSkip = () => {
    setEkycData({
      maskedAadhaar: extractedFields.maskedAadhaar?.value || extractedFields.aadharNo?.value || 'XXXX XXXX 7821',
      nameVerified: false,
      dobVerified: false,
      genderVerified: false,
      isVerified: false,
      isSkipped: true,
      timestamp: new Date().toISOString(),
    });
    setStep('verify');
  };

  // 6. Verification completed -> Final Result
  const handleVerificationComplete = async () => {
    await generateFinalResult();
  };

  // Common final result calculation
  const generateFinalResult = async () => {
    const valResult = await validateDocument(detectedType, extractedFields, isSuspicious);
    const tampResult = await detectTampering(processedImage || rawImage, isSuspicious);
    const faceResult = await verifyFace(processedImage || rawImage, isSuspicious);

    const result = calculateRisk(
      detectedType,
      valResult,
      tampResult,
      faceResult,
      ekycData
    );

    // Append N/A document notes into the audit checks
    const naEntries = (Object.entries(unavailableDocs) as [string, boolean][])
      .filter(([, isNA]) => isNA)
      .map(([type]) => ({
        id: `na_${type}`,
        title: `${type.replace('_', ' ')} not produced`,
        status: 'warning' as const,
        detail: 'Document not available — logged as N/A by officer',
      }));

    if (naEntries.length > 0) {
      result.checks = [...result.checks, ...naEntries];
    }

    setFinalResult(result);
    setStep('result');
  };

  // 8. Final Result Done button -> Save to history and reset to scanner
  const handleDone = async () => {
    if (finalResult) {
      const newHistoryItem: HistoryItem = {
        id: `scan-${Date.now()}`,
        documentType: detectedType,
        fileName,
        holderName: extractedFields.name?.value || 'Rahul Sharma',
        identifier:
          extractedFields.passportNumber?.value ||
          extractedFields.maskedAadhaar?.value ||
          extractedFields.aadharNo?.value ||
          extractedFields.panNumber?.value ||
          extractedFields.epicNumber?.value ||
          extractedFields.voterId?.value ||
          extractedFields.dlNumber?.value ||
          extractedFields.licenseNumber?.value ||
          extractedFields.visaNumber?.value ||
          'ID-DOC-01',
        riskLevel: finalResult.riskLevel,
        riskScore: finalResult.riskScore,
        timeAgo: 'Just now',
        timestamp: Date.now(),
        imageThumbnail: processedImage || rawImage,
        backThumbnail: backProcessedImage || backRawImage,
        ekycVerified: ekycData?.isVerified || false,
        result: finalResult,
        extractedFields,
        savedPaths: savedFilePaths,
      };

      try {
        const apiBase = getApiBaseUrl();
        const endpoint = apiBase ? `${apiBase}/api/history` : '/api/history';
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newHistoryItem)
        });
        if (response.ok) {
          const resultData = await response.json();
          newHistoryItem.id = resultData.id;
        }
      } catch (err) {
        console.error("Error saving history:", err);
      }

      setHistory((prev) => [newHistoryItem, ...prev]);
    }

    // Reset workflow
    setRawImage('');
    setProcessedImage('');
    setBackRawImage(undefined);
    setBackProcessedImage(undefined);
    setCorners([]);
    setFinalResult(null);
    setEkycData(null);
    setUnavailableDocs({
      passport: false,
      aadhaar: false,
      pan: false,
      voter_id: false,
      driving_license: false,
      proof_of_address: false,
      bank_statement: false,
      employment_letter: false,
      tax_documents: false,
      birth_certificate: false,
      visa: false,
      residence_permit: false,
    });
    setStep('scanner');
  };

  // View past result from history
  const handleSelectHistoryRecord = (record: HistoryItem) => {
    setDetectedType(record.documentType);
    setFileName(record.fileName);
    setExtractedFields(record.extractedFields);
    setFinalResult(record.result);
    setActiveTab('scan');
    setStep('result');
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-0 sm:p-4">
      {/* Smartphone Container: Native CamScanner Smartphone Viewport */}
      <div className="smartphone-container relative rounded-none sm:rounded-[36px] overflow-hidden border-0 sm:border-8 sm:border-slate-800 shadow-2xl flex flex-col h-[100dvh] max-h-[100dvh] sm:h-[860px] sm:max-h-[860px]">
        {/* Main Content Area based on Tab & Step */}
        <div className="flex-1 overflow-hidden flex flex-col relative">
          {isProcessing && (
            <div className="absolute inset-0 z-50 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center">
              <div className="w-12 h-12 border-4 border-slate-200 border-t-blue-700 rounded-full animate-spin mb-4"></div>
              <h3 className="text-sm font-semibold text-slate-900">Processing Document</h3>
              <p className="text-xs text-slate-500 mt-1 text-center max-w-[250px]">
                Running deep learning OCR models. This may take a minute on the first run.
              </p>
            </div>
          )}
          {activeTab === 'scan' && (
            <>
              {step === 'scanner' && (
                <WebCamScanner
                  onSessionComplete={handleSessionComplete}
                  onRequestManualCrop={(img, c) => {
                    setRawImage(img);
                    setCorners(c);
                    setStep('crop');
                  }}
                />
              )}

              {step === 'crop' && (
                <ManualCropWrapper
                  imageSrc={rawImage}
                  initialCorners={corners}
                  onConfirmCrop={handleManualCropConfirm}
                  onCancel={() => setStep('scanner')}
                />
              )}

              {step === 'review' && (
                <ScanReviewScreen
                  scannedImage={processedImage || rawImage}
                  backImage={backProcessedImage || backRawImage}
                  savedFilePaths={savedFilePaths}
                  sessionDocs={sessionDocs}
                  onRetake={() => setStep('scanner')}
                  onAdjustCorners={() => setStep('crop')}
                  onAcceptScan={handleAcceptScan}
                />
              )}

              {step === 'doc-type' && (
                <DocumentTypeScreen
                  initialType={detectedType}
                  initialConfidence={confidence}
                  initialFileName={fileName}
                  sessionDocs={sessionDocs}
                  onBack={() => setStep('review')}
                  onContinue={handleDocTypeContinue}
                />
              )}

              {step === 'ocr-loading' && (
                <div className="flex flex-col items-center justify-center h-full text-slate-300">
                  <Loader2 className="w-12 h-12 animate-spin text-blue-600 mb-4" />
                  <h2 className="text-xl font-semibold mb-2 text-white">Analyzing Document...</h2>
                  <p className="text-sm text-slate-400">Extracting text via AI OCR</p>
                </div>
              )}

              {step === 'extract' && (
                <ExtractionScreen
                  documentType={detectedType}
                  fileName={fileName}
                  documentImage={processedImage || rawImage}
                  backImage={backProcessedImage || backRawImage}
                  initialFields={extractedFields}
                  sessionChecklist={sessionChecklist}
                  allDocFields={allDocFields}
                  sessionDocs={sessionDocs}
                  onBack={() => setStep('doc-type')}
                  onProceedToVerification={handleProceedToVerification}
                />
              )}

              {step === 'ekyc' && (
                <AadhaarEkycScreen
                  maskedAadhaar={extractedFields.maskedAadhaar?.value || extractedFields.aadharNo?.value || 'XXXX XXXX 7821'}
                  onBack={() => setStep('extract')}
                  onVerified={handleEkycVerified}
                  onSkip={handleEkycSkip}
                />
              )}

              {step === 'verify' && (
                <VerificationScreen
                  documentType={detectedType}
                  isSuspicious={isSuspicious}
                  onComplete={handleVerificationComplete}
                />
              )}

              {step === 'result' && finalResult && (
                <FinalResultScreen
                  documentType={detectedType}
                  fileName={fileName}
                  initialResult={finalResult}
                  onDone={handleDone}
                />
              )}
            </>
          )}

          {activeTab === 'history' && (
            <HistoryView
              history={history}
              onSelectRecord={handleSelectHistoryRecord}
              onStartNewScan={() => {
                setActiveTab('scan');
                setStep('scanner');
              }}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsView
              ocrEngine={ocrEngine}
              setOcrEngine={setOcrEngine}
              onBackToScan={() => {
                setActiveTab('scan');
              }}
            />
          )}
        </div>

        {/* Bottom Smartphone Navigation: Minimal Tabs (Scan, History, Settings) */}
        <div className="h-14 bg-white border-t border-slate-200 flex items-center justify-around px-2 z-30 select-none flex-shrink-0">
          <button
            type="button"
            onClick={() => {
              setActiveTab('scan');
              if (step === 'result') setStep('scanner');
            }}
            className={`flex flex-col items-center justify-center gap-0.5 w-20 py-1 transition ${
              activeTab === 'scan'
                ? 'text-blue-700 font-bold'
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <Camera className="w-5 h-5" />
            <span className="text-[10px]">Scan</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`flex flex-col items-center justify-center gap-0.5 w-20 py-1 transition ${
              activeTab === 'history'
                ? 'text-blue-700 font-bold'
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <History className="w-5 h-5" />
            <span className="text-[10px]">History</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className={`flex flex-col items-center justify-center gap-0.5 w-20 py-1 transition ${
              activeTab === 'settings'
                ? 'text-blue-700 font-bold'
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <Settings className="w-5 h-5" />
            <span className="text-[10px]">Settings</span>
          </button>
        </div>
      </div>
    </div>
  );
}
