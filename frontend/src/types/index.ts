export type DocumentType =
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

export type DocumentSide = 'front' | 'back';

export interface ExtractedField {
  key: string;
  label: string;
  value: string;
  confidence: number; // 0 to 100
  editable?: boolean;
}

export interface ExtractedData {
  documentType: DocumentType;
  fileName: string;
  fields: Record<string, ExtractedField>;
  rawImage: string;
  processedImage: string;
  backRawImage?: string;
  backProcessedImage?: string;
  savedFilePaths?: {
    front?: string;
    back?: string;
  };
}

export interface ScanQuality {
  documentDetected: boolean;
  imageReadable: boolean;
  perspectiveCorrected: boolean;
  confidence: number;
}

export interface VerificationCheckItem {
  id: string;
  title: string;
  subtitle: string;
  status: 'pending' | 'in_progress' | 'passed' | 'warning' | 'failed';
  forDocType?: DocumentType;
}

export interface AadhaarEkycData {
  maskedAadhaar: string;
  nameVerified: boolean;
  dobVerified: boolean;
  genderVerified: boolean;
  isVerified: boolean;
  isSkipped?: boolean;
  timestamp?: string;
}

export interface VerificationResult {
  riskLevel: 'ACCEPTED' | 'REVIEW REQUIRED' | 'FAILED' | 'MISSING';
  riskScore: number; // 0 to 100
  explanation: string;
  checks: {
    id: string;
    title: string;
    status: 'passed' | 'warning' | 'failed';
    detail: string;
  }[];
  timestamp: string;
}

export interface HistoryItem {
  id: string;
  documentType: DocumentType;
  fileName: string;
  holderName: string;
  identifier: string;
  riskLevel: 'ACCEPTED' | 'REVIEW REQUIRED' | 'FAILED' | 'MISSING';
  riskScore: number;
  timeAgo: string;
  timestamp: number;
  imageThumbnail: string;
  backThumbnail?: string;
  ekycVerified?: boolean;
  result: VerificationResult;
  extractedFields: Record<string, ExtractedField>;
  savedPaths?: {
    front?: string;
    back?: string;
  };
}
