import re
from typing import Dict, Any, List
from src.extractors.base import BaseExtractor
from src.mrz_parser import MRZParser

class PassportExtractor(BaseExtractor):
    """
    Passport Extractor: Parses Machine Readable Zone (MRZ) per ICAO 9303 format.
    Extracts passport_number, surname, given_name, nationality, dob, sex, date_of_issue,
    date_of_expiry, place_of_birth, place_of_issue, and local language name.
    Includes comprehensive text fallbacks for visual inspection zone (VIZ).
    """

    def extract(self, raw_text: str, text_blocks: List[Dict[str, Any]], qr_info: Dict[str, Any] = None) -> Dict[str, Any]:
        fields = {}

        # 1. Parse ICAO 9303 MRZ
        mrz_data = MRZParser.parse_mrz(raw_text)
        if mrz_data:
            fields["passport_number"] = mrz_data.get("passport_number")
            fields["surname"] = mrz_data.get("surname")
            fields["given_name"] = mrz_data.get("given_name")
            fields["name"] = f"{fields.get('surname', '')} {fields.get('given_name', '')}".strip()
            fields["nationality"] = mrz_data.get("nationality")
            fields["issuing_country"] = mrz_data.get("issuing_country") or "IND"
            fields["dob"] = mrz_data.get("dob")
            fields["sex"] = mrz_data.get("sex")
            fields["date_of_expiry"] = mrz_data.get("expiry_date")
            fields["mrz_checksum_valid"] = mrz_data.get("mrz_checksum_valid")
            fields["mrz_raw"] = mrz_data.get("mrz_raw")
        else:
            fields["mrz_checksum_valid"] = False

        # 2. Visual Inspection Zone (VIZ) Text Fallbacks & Refinements

        # Passport Number: Standard Indian passport is 1 letter followed by 7 digits (e.g. A1234567)
        viz_pnum = re.search(r'\b([A-PR-WYa-pr-wy]\d{7})\b', raw_text)
        if not viz_pnum:
            viz_pnum = re.search(r'(?:Passport\s*No|Passport\s*Number)[\s.:]*([A-Z0-9]{8,9})', raw_text, re.IGNORECASE)
        if viz_pnum:
            # VIZ match with valid letter prefix takes priority over malformed MRZ digit-only number
            valid_viz = viz_pnum.group(1).upper()
            if not fields.get("passport_number") or not re.match(r'^[A-Z]\d{7}$', str(fields.get("passport_number"))):
                fields["passport_number"] = valid_viz

        # Surname (Nom / उपनाम) - supports same-line and next-line
        if not fields.get("surname") or fields.get("surname") == "":
            s_match = re.search(r'(?:Surname|Nom|1\.\s*उपनाम)[\s.:\n]+([A-Za-z\s\.\'-]{2,35})', raw_text, re.IGNORECASE)
            if s_match:
                fields["surname"] = s_match.group(1).strip().split('\n')[0].strip()

        # Given Name (Prénoms / दिया गया नाम) - supports same-line and next-line
        if not fields.get("given_name") or fields.get("given_name") == "":
            g_match = re.search(r'(?:Given\s*Name[s]?|Pr[ée]nom|2\.\s*दिया\s*गया\s*नाम)[\s.:\n]+([A-Za-z\s\.\'-]{2,35})', raw_text, re.IGNORECASE)
            if g_match:
                fields["given_name"] = g_match.group(1).strip().split('\n')[0].strip()

        # Full Name (Supports single-name passports and combined names)
        s = fields.get("surname", "") or ""
        g = fields.get("given_name", "") or ""
        if s or g:
            fields["name"] = f"{s} {g}".strip()
        elif not fields.get("name"):
            n_match = re.search(r'(?:Name|Holder)[\s.:\n]+([A-Za-z\s\.\'-]{2,35})', raw_text, re.IGNORECASE)
            fields["name"] = n_match.group(1).strip().split('\n')[0].strip() if n_match else None

        # Date of Birth (DOB)
        dob_match = re.search(r'(?:Date\s*of\s*Birth|Date\s*de\s*naissance|DOB|5\.\s*जन्मतिथि)[\s.:]*(\d{2}[-/. ]\d{2}[-/. ]\d{4})', raw_text, re.IGNORECASE)
        if not dob_match:
            dob_match = re.search(r'\b(0[1-9]|[12]\d|3[01])[-/. ](0[1-9]|1[0-2])[-/. ](19\d{2}|20[0-2]\d)\b', raw_text)
        if not dob_match:
            # Check for multi-line OCR blocks where DD.MM and YYYY are split
            split_dob = re.search(r'\b(0[1-9]|[12]\d|3[01])\s*\n\s*(19\d{2}|20[0-2]\d)\b', raw_text)
            if split_dob:
                fields["dob"] = f"{split_dob.group(1)}/01/{split_dob.group(2)}"
        if dob_match:
            fields["dob"] = dob_match.group(0).replace(".", "/").replace("-", "/").replace(" ", "")

        # Date of Issue (DOI)
        doi_match = re.search(r'(?:Date\s*of\s*Issue|Date\s*de\s*d[ée]livrance|Issue|8\.\s*जारी)[\s.:]*(\d{2}[-/. ]\d{2}[-/. ]\d{4})', raw_text, re.IGNORECASE)
        if not doi_match:
            doi_match = re.search(r'\b(0[1-9]|[12]\d|3[01])[-/. ](0[1-9]|1[0-2])[-/. ](20[12]\d)\b', raw_text)
        if not doi_match:
            # Check for partial 01.2025 or similar issue date
            partial_doi = re.search(r'\b(0[1-9]|1[0-2])[-/. ](20[12]\d)\b', raw_text)
            if partial_doi:
                fields["date_of_issue"] = f"01/{partial_doi.group(1)}/{partial_doi.group(2)}"
        if doi_match:
            fields["date_of_issue"] = doi_match.group(0).replace(".", "/").replace("-", "/").replace(" ", "")

        # Date of Expiry (DOE)
        exp_match = re.search(r'(?:Date\s*of\s*Expiry|Date\s*d\'expiration|Expiry|9\.\s*समाप्ति)[\s.:]*(\d{2}[-/. ]\d{2}[-/. ]\d{4})', raw_text, re.IGNORECASE)
        if not exp_match:
            exp_match = re.search(r'\b(0[1-9]|[12]\d|3[01])[-/. ](0[1-9]|1[0-2])[-/. ](20[2-4]\d)\b', raw_text)
        if exp_match:
            fields["date_of_expiry"] = exp_match.group(0).replace(".", "/").replace("-", "/").replace(" ", "")

        # Place of Birth
        pob_match = re.search(r'(?:Place\s*of\s*Birth|Lieu\s*de\s*naissance|7\.\s*जन्म\s*स्थान)[\s.:]*([A-Za-z\s,]+)', raw_text, re.IGNORECASE)
        if not pob_match:
            pob_match = re.search(r'\b([A-Z]{3,15}\s*,\s*IND)\b', raw_text)
        if not pob_match:
            # Check for common Indian cities like CHENNAI, DELHI, MUMBAI
            city_match = re.search(r'\b(CHENNAI|DELHI|MUMBAI|KOLKATA|BENGALURU|HYDERABAD|AHMEDABAD|PUNE)\b', raw_text, re.IGNORECASE)
            if city_match:
                fields["place_of_birth"] = f"{city_match.group(1).upper()}, IND"
        if pob_match:
            pob_text = pob_match.group(1).strip().split('\n')[0].strip()
            pob_text = re.split(r'\d+\.', pob_text)[0].strip()
            fields["place_of_birth"] = pob_text

        # Place of Issue
        poi_match = re.search(r'(?:Place\s*of\s*Issue|10\.\s*जारी\s*करने\s*का\s*स्थान)[\s.:]*([A-Za-z\s]+)', raw_text, re.IGNORECASE)
        if not poi_match:
            poi_match = re.search(r'\b(RPO\s+[A-Za-z]+)\b', raw_text, re.IGNORECASE)
        if poi_match:
            poi_text = poi_match.group(1).strip().split('\n')[0].strip()
            poi_text = re.split(r'\d+\.', poi_text)[0].strip()
            fields["place_of_issue"] = poi_text

        # Sex
        if not fields.get("sex"):
            if re.search(r'(?:Sex|Sexe|6\.\s*लिंग)[\s.:]*F\b|\bFEMALE\b', raw_text, re.IGNORECASE):
                fields["sex"] = "F"
            elif re.search(r'(?:Sex|Sexe|6\.\s*लिंग)[\s.:]*M\b|\bMALE\b', raw_text, re.IGNORECASE):
                fields["sex"] = "M"

        # Nationality
        if not fields.get("nationality") or fields.get("nationality") == "ND8":
            if "INDIAN" in raw_text.upper():
                fields["nationality"] = "INDIAN"
            elif "REPUBLIC OF INDIA" in raw_text.upper() or "IND" in raw_text.upper():
                fields["nationality"] = "INDIAN"
            fields["issuing_country"] = "IND"

        # Local Language Name
        local_match = re.search(r'(?:TAM|TAMIL|HINDI|स्थानीय\s*भाषा)[\s.:]*([^\n]+)', raw_text, re.IGNORECASE)
        if local_match:
            fields["name_in_local_language"] = local_match.group(0).strip()

        # Signature
        sig_match = re.search(r'(?:Signature|11\.\s*हस्ताक्षर)[\s.:]*([A-Za-z\s]+)', raw_text, re.IGNORECASE)
        if sig_match:
            fields["signature"] = sig_match.group(1).strip().split('\n')[0].strip()

        return fields
