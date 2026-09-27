import re
from typing import Dict, Any, List
from src.extractors.base import BaseExtractor


class PANExtractor(BaseExtractor):
    """
    Extracts pan_number, name, father_name, and dob from Indian Permanent Account Number (PAN) cards.
    Handles bilingual Hindi/English headings and standard NSDL/UTIITSL formats.
    """

    def extract(self, raw_text: str, text_blocks: List[Dict[str, Any]], qr_info: Dict[str, Any] = None) -> Dict[str, Any]:
        fields: Dict[str, Any] = {
            "pan_number": None,
            "name": None,
            "father_name": None,
            "dob": None,
            "pan_number_valid": False,
        }

        # 1. PAN Number Extraction: Standard 5 letters, 4 digits, 1 letter (e.g. ABCDE1234F)
        # 4th character typically denotes status: P = Individual, C = Company, H = HUF, F = Firm, etc.
        pan_match = re.search(r'\b([A-Z]{5}[0-9]{4}[A-Z])\b', raw_text)
        if pan_match:
            fields["pan_number"] = pan_match.group(1).upper()
            fields["pan_number_valid"] = True
        else:
            # Fallback with minor OCR character confusion (e.g. O for 0 or I for 1)
            loose_match = re.search(r'(?:Permanent\s*Account\s*Number|PAN)[\s.:]*([A-Z0-9]{10})\b', raw_text, re.IGNORECASE)
            if loose_match:
                cand = loose_match.group(1).upper()
                if re.match(r'^[A-Z]{5}[0-9]{4}[A-Z]$', cand):
                    fields["pan_number"] = cand
                    fields["pan_number_valid"] = True

        # 2. Date of Birth (DOB)
        dob_match = re.search(r'(?:Date\s*of\s*Birth|DOB|जन्म\s*की\s*तारीख)[\s.:]*(\d{2}[-/. ]\d{2}[-/. ]\d{4})', raw_text, re.IGNORECASE)
        if not dob_match:
            dob_match = re.search(r'\b(0[1-9]|[12]\d|3[01])[-/. ](0[1-9]|1[0-2])[-/. ](19\d{2}|20[0-2]\d)\b', raw_text)
        if dob_match:
            fields["dob"] = dob_match.group(0).replace(".", "/").replace("-", "/").replace(" ", "")

        # 3. Father's Name
        father_match = re.search(r'(?:Father[\'s]*\s*Name|Father|पिता\s*का\s*नाम)[\s.:\n]+([A-Za-z\s\.\'-]{3,40})', raw_text, re.IGNORECASE)
        if father_match:
            cand = father_match.group(1).strip().split('\n')[0].strip()
            # Remove any trailing labels or keywords
            cand = re.sub(r'(?:Date|Birth|DOB|Permanent|PAN).*$', '', cand, flags=re.IGNORECASE).strip()
            if len(cand) >= 3:
                fields["father_name"] = cand

        # 4. Holder Name Extraction
        # Look for explicit Name: label (ensuring it's not Father's Name)
        name_match = re.search(r'(?:(?:^|\n)\s*(?:Name|नाम|Card\s*Holder)[\s.:\n]+)([A-Za-z\s\.\'-]{3,40})', raw_text, re.IGNORECASE)
        if name_match:
            cand = name_match.group(1).strip().split('\n')[0].strip()
            cand = re.sub(r'(?:Father|पिता|Date|Birth|DOB).*$', '', cand, flags=re.IGNORECASE).strip()
            if len(cand) >= 3 and not any(k in cand.upper() for k in ["INCOME", "TAX", "DEPARTMENT", "GOVT", "INDIA"]):
                fields["name"] = cand

        # Fallback Name Extraction using Line Anchors
        if not fields.get("name"):
            lines = [l.strip() for l in raw_text.split('\n') if l.strip()]
            forbidden = {
                "INCOME", "TAX", "DEPARTMENT", "GOVT", "GOVERNMENT", "INDIA",
                "BHARAT", "SARKAR", "PERMANENT", "ACCOUNT", "NUMBER", "CARD",
                "SIGNATURE", "FATHER", "NAME", "DOB", "DATE", "BIRTH"
            }

            # Find line index of Father's Name or DOB
            anchor_idx = -1
            for idx, line in enumerate(lines):
                line_up = line.upper()
                if any(k in line_up for k in ["FATHER", "FATHERS", "पिता"]) or (fields.get("dob") and fields["dob"] in line):
                    anchor_idx = idx
                    break

            if anchor_idx > 0:
                # Name typically sits 1-2 lines above Father's name
                for offset in range(1, min(4, anchor_idx + 1)):
                    cand_line = lines[anchor_idx - offset]
                    if any(k in cand_line.upper() for k in ["FATHER", "पिता", "GOVT", "INCOME", "TAX"]):
                        continue
                    ascii_clean = re.sub(r'[^A-Za-z\s\.\'-]', ' ', cand_line).strip()
                    if 3 <= len(ascii_clean) <= 40:
                        up_cand = ascii_clean.upper()
                        if not any(k in up_cand for k in forbidden):
                            words = [w for w in ascii_clean.split() if len(w) >= 2]
                            if 1 <= len(words) <= 5:
                                fields["name"] = " ".join(words)
                                break

        return fields
