import re
from typing import Dict, Any, List
from src.extractors.base import BaseExtractor
from src.verhoeff import Verhoeff

class AadhaarExtractor(BaseExtractor):
    """
    Aadhaar Extractor: Attempts QR code XML/embedded decode first.
    Falls back to robust OCR extraction for name, DOB/YOB, gender, Aadhaar UID number, and address.
    """

    def extract(self, raw_text: str, text_blocks: List[Dict[str, Any]], qr_info: Dict[str, Any] = None) -> Dict[str, Any]:
        fields = {}

        # 1. Attempt QR Code Decode First (XML / Structured Payload)
        qr_fields = self._parse_qr_payload(qr_info) if qr_info else {}
        if qr_fields and qr_fields.get("aadhaar_number"):
            fields.update(qr_fields)
            if fields.get("name") and fields.get("dob"):
                return fields

        # 2. Aadhaar UID Number (12 digits, 4-4-4 format, or masked like XXXX XXXX 1234)
        uid_match = re.search(r'\b(\d{4}[-\s]?\d{4}[-\s]?\d{4})\b', raw_text)
        masked_match = re.search(r'\b([X\d]{4}[-\s]?[X\d]{4}[-\s]?\d{4})\b', raw_text, re.IGNORECASE)

        if uid_match:
            raw_uid = uid_match.group(1)
            clean_uid = re.sub(r'[-\s]', '', raw_uid)
            is_valid = Verhoeff.validate(clean_uid)
            fields["aadhaar_number"] = clean_uid
            fields["aadhaar_number_valid"] = is_valid
        elif masked_match:
            raw_uid = masked_match.group(1)
            fields["aadhaar_number"] = raw_uid
            fields["aadhaar_number_valid"] = True
        else:
            if not fields.get("aadhaar_number"):
                fields["aadhaar_number"] = None
                fields["aadhaar_number_valid"] = False

        # 3. Date of Birth (DOB) or Year of Birth (YOB)
        if not fields.get("dob"):
            dob_match = re.search(r'(?:DOB|Date of Birth|DOB:)\s*[:\s]*(\d{2}[-/\.]\d{2}[-/\.]\d{4})', raw_text, re.IGNORECASE)
            if not dob_match:
                dob_match = re.search(r'\b(\d{2}[-/\.]\d{2}[-/\.]\d{4})\b', raw_text)
            
            if dob_match:
                fields["dob"] = dob_match.group(1).replace("-", "/").replace(".", "/")
            else:
                # Fallback to Year of Birth (YOB)
                yob_match = re.search(r'(?:YOB|Year of Birth|Birth Year)\s*[:\s]*(\d{4})', raw_text, re.IGNORECASE)
                if not yob_match:
                    yob_match = re.search(r'\b(19\d{2}|20[0-2]\d)\b', raw_text)
                fields["dob"] = yob_match.group(1) if yob_match else None

        # 4. Gender
        if not fields.get("gender"):
            if re.search(r'\bMALE\b|\bपुरुष\b', raw_text, re.IGNORECASE):
                fields["gender"] = "MALE"
            elif re.search(r'\bFEMALE\b|\bमहिला\b', raw_text, re.IGNORECASE):
                fields["gender"] = "FEMALE"
            elif re.search(r'\bTRANSGENDER\b', raw_text, re.IGNORECASE):
                fields["gender"] = "TRANSGENDER"
            else:
                fields["gender"] = None

        # 5. Name Extraction
        if not fields.get("name"):
            name_match = re.search(r'name="([^"]+)"', raw_text, re.IGNORECASE)
            if name_match:
                fields["name"] = name_match.group(1).strip()
            else:
                fields["name"] = self._extract_name_from_text(raw_text, text_blocks)

        # 6. Address Extraction (Captures full address including 6-digit PIN code)
        if not fields.get("address"):
            addr_match = re.search(r'(?:Address|पता|S/O|C/O|W/O|D/O)\s*[:\s]*(.+?)(?=\b\d{6}\b|$)', raw_text, re.IGNORECASE | re.DOTALL)
            if addr_match:
                full_addr = addr_match.group(0).strip()
                # Include the PIN code if present in surrounding text
                pin_m = re.search(r'\b\d{6}\b', raw_text[addr_match.start():addr_match.end()+20])
                if pin_m and pin_m.group(0) not in full_addr:
                    full_addr += " - " + pin_m.group(0)
                fields["address"] = re.sub(r'\s+', ' ', full_addr).strip()
            else:
                fields["address"] = None

        return fields

    def _parse_qr_payload(self, qr_info: Dict[str, Any]) -> Dict[str, Any]:
        """Parses decoded Aadhaar QR code XML attribute fields."""
        if not qr_info or not qr_info.get("qr_detected"):
            return {}

        payload = qr_info.get("payload", "")
        fields = {}

        uid_m = re.search(r'uid="(\d{12})"', payload)
        name_m = re.search(r'name="([^"]+)"', payload)
        dob_m = re.search(r'dob="([^"]+)"', payload)
        gender_m = re.search(r'gender="([^"]+)"', payload)

        if uid_m:
            fields["aadhaar_number"] = uid_m.group(1)
            fields["aadhaar_number_valid"] = Verhoeff.validate(uid_m.group(1))
        if name_m:
            fields["name"] = name_m.group(1)
        if dob_m:
            fields["dob"] = dob_m.group(1)
        if gender_m:
            fields["gender"] = gender_m.group(1)

        return fields

    def _extract_name_from_text(self, text: str, text_blocks: List[Dict[str, Any]] = None) -> str:
        """
        Dynamically extracts holder name from OCR text using multi-anchor spatial and regex heuristics.
        Handles Devnagari script lines, title case, mixed case, and preceding DOB / YOB / Gender lines.
        """
        lines = [line.strip() for line in text.split('\n') if line.strip()]
        
        forbidden_keywords = {
            "INDIA", "AUTHORITY", "GOVERNMENT", "BHARAT", "SARKAR", "UIDAI", 
            "MALE", "FEMALE", "TRANSGENDER", "AADHAAR", "DOB", "DATE", "BIRTH", 
            "HELP", "ISSUE", "ADDRESS", "MERA", "ENROLMENT", "DETAILS", "PROOF", 
            "IDENTITY", "CITIZENSHIP", "VERIFICATION", "AUTHENTICATION", "SCANNING", 
            "PURPOSE", "CARD", "NUMBER", "VID", "SIGNATURE", "UNIQUE", "IDENTIFICATION",
            "MALE/MALE", "FEMALE/FEMALE"
        }

        # 1. Explicit name prefix regex (e.g. "Name: Vilas Rakhe", "To: Vilas Rakhe")
        prefix_match = re.search(r'(?:Name|To|Holder)\s*[:\s]+\s*([A-Za-z\s\.\'-]{3,35})', text, re.IGNORECASE)
        if prefix_match:
            candidate = prefix_match.group(1).strip().split('\n')[0]
            if candidate and not any(k in candidate.upper() for k in forbidden_keywords):
                return candidate

        # 2. Line Anchor Analysis (Find DOB or Gender line index)
        dob_gender_idx = -1
        for idx, line in enumerate(lines):
            line_up = line.upper()
            if any(k in line_up for k in ["DOB", "D.O.B", "DATE OF BIRTH", "BIRTH", "YOB", "YEAR OF BIRTH", "YEAR", "DO8", "D0B", "जन्म", "तारीख"]) or re.search(r'\b\d{2}[-/\.]\d{2}[-/\.]\d{4}\b', line) or any(g in line_up for g in ["MALE", "FEMALE", "TRANSGENDER", "पुरुष", "महिला"]):
                dob_gender_idx = idx
                break

        # Check candidate lines immediately preceding the DOB/Gender anchor
        if dob_gender_idx > 0:
            for offset in range(1, min(5, dob_gender_idx + 1)):
                cand_line = lines[dob_gender_idx - offset]
                # Strip prefix like "Name:", "To:"
                cand_line = re.sub(r'^(?:Name|To|Holder|S/O|D/O|W/O|C/O)[\s.:]+', '', cand_line, flags=re.IGNORECASE)
                ascii_clean = re.sub(r'[^A-Za-z\s\.\'-]', ' ', cand_line)
                ascii_clean = re.sub(r'\s+', ' ', ascii_clean).strip()
                
                if len(ascii_clean) >= 3 and len(ascii_clean) <= 40:
                    up_cand = ascii_clean.upper()
                    if not any(k in up_cand for k in forbidden_keywords):
                        words = [w for w in ascii_clean.split() if len(w) >= 2]
                        if 1 <= len(words) <= 5:
                            return " ".join(words)

        # 3. Fallback: Search all lines between Govt header and DOB line
        govt_idx = 0
        for idx, line in enumerate(lines):
            if any(k in line.upper() for k in ["GOVERNMENT OF INDIA", "BHARAT SARKAR", "UNIQUE IDENTIFICATION", "AUTHORITY"]):
                govt_idx = idx
                break

        end_idx = dob_gender_idx if dob_gender_idx > 0 else len(lines)
        for idx in range(govt_idx, end_idx):
            cand_line = lines[idx]
            cand_line = re.sub(r'^(?:Name|To|Holder|S/O|D/O|W/O|C/O)[\s.:]+', '', cand_line, flags=re.IGNORECASE)
            ascii_clean = re.sub(r'[^A-Za-z\s\.\'-]', ' ', cand_line)
            ascii_clean = re.sub(r'\s+', ' ', ascii_clean).strip()
            if len(ascii_clean) >= 3 and len(ascii_clean) <= 40:
                up_cand = ascii_clean.upper()
                if not any(k in up_cand for k in forbidden_keywords):
                    words = [w for w in ascii_clean.split() if len(w) >= 2]
                    if 1 <= len(words) <= 5:
                        return " ".join(words)

        # 4. Text Blocks spatial fallback
        if text_blocks:
            for b in text_blocks:
                b_text = b.get("text", "")
                clean_t = re.sub(r'[^A-Za-z\s\.\'-]', ' ', b_text)
                clean_t = re.sub(r'\s+', ' ', clean_t).strip()
                if clean_t and len(clean_t) >= 3 and len(clean_t) <= 35:
                    if not any(k in clean_t.upper() for k in forbidden_keywords):
                        words = clean_t.split()
                        if 1 <= len(words) <= 4:
                            return clean_t

        return None
