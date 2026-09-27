import re
from typing import Dict, Any, List
from src.extractors.base import BaseExtractor


class VoterIDExtractor(BaseExtractor):
    """
    Extracts epic_number, name, relation_name, dob, gender, and address
    from Indian Elector Photo Identity Cards (Voter ID / EPIC).
    Handles both modern PVC cards and legacy laminated voter cards.
    """

    def extract(self, raw_text: str, text_blocks: List[Dict[str, Any]], qr_info: Dict[str, Any] = None) -> Dict[str, Any]:
        fields: Dict[str, Any] = {
            "voter_id": None,
            "epic_number": None,
            "name": None,
            "relation_name": None,
            "gender": None,
            "dob": None,
            "age": None,
            "address": None,
            "voter_id_valid": False,
        }

        # 1. EPIC Number Extraction (Standard: 3 letters + 7 digits, e.g. ALB2734259 or ALB 2734259)
        epic_match = re.search(r'([A-Z]{3})\s*[-/_\.]?\s*([0-9]{7})\b', raw_text, re.IGNORECASE)
        if not epic_match:
            # Fallback for state slash format (e.g. DL/01/001/123456 or WB/01/001/123456)
            epic_match = re.search(r'\b([A-Z]{2,3}[/\-][0-9]{2,3}[/\-][0-9]{2,4}[/\-][0-9]{4,7})\b', raw_text, re.IGNORECASE)
        if not epic_match:
            # Fallback for OCR character confusion where letters/numbers have minor typo (e.g. O for 0, I for 1, B for 8)
            epic_match = re.search(r'([A-Z]{3})\s*[-/_\.]?\s*([0-9OISZB]{7})\b', raw_text, re.IGNORECASE)

        if epic_match:
            if len(epic_match.groups()) >= 2:
                letters = epic_match.group(1).upper()
                digits = epic_match.group(2).upper()
                digits = digits.replace('O', '0').replace('I', '1').replace('S', '5').replace('Z', '2').replace('B', '8')
                epic_val = f"{letters}{digits}"
            else:
                epic_val = epic_match.group(1).upper().replace(" ", "")
            fields["epic_number"] = epic_val
            fields["voter_id"] = epic_val
            fields["voter_id_valid"] = True
        elif text_blocks:
            # Check text blocks directly for separate letter and number tokens
            for i, block in enumerate(text_blocks):
                txt = re.sub(r'[^A-Z0-9]', '', block.get("text", "").upper())
                m = re.match(r'^([A-Z]{3})([0-9]{7})$', txt)
                if m:
                    fields["epic_number"] = txt
                    fields["voter_id"] = txt
                    fields["voter_id_valid"] = True
                    break
                if re.match(r'^[A-Z]{3}$', txt) and i + 1 < len(text_blocks):
                    next_txt = re.sub(r'[^0-9]', '', text_blocks[i+1].get("text", ""))
                    if len(next_txt) == 7:
                        epic_val = f"{txt}{next_txt}"
                        fields["epic_number"] = epic_val
                        fields["voter_id"] = epic_val
                        fields["voter_id_valid"] = True
                        break

        # 2. Gender Extraction
        if re.search(r'\b(FEMALE|WOMAN|महिला|स्त्री)\b', raw_text, re.IGNORECASE):
            fields["gender"] = "Female"
        elif re.search(r'\b(MALE|MAN|पुरुष)\b', raw_text, re.IGNORECASE):
            fields["gender"] = "Male"
        elif re.search(r'\b(TRANSGENDER|तृतीय\s*लिंग)\b', raw_text, re.IGNORECASE):
            fields["gender"] = "Transgender"

        # 3. DOB or Age Extraction
        dob_match = re.search(r'(?:Date\s*of\s*Birth|DOB|जन्म\s*की\s*तारीख)[\s.:]*(\d{2}[-/. ]\d{2}[-/. ]\d{4})', raw_text, re.IGNORECASE)
        if not dob_match:
            dob_match = re.search(r'\b(0[1-9]|[12]\d|3[01])[-/. ](0[1-9]|1[0-2])[-/. ](19\d{2}|20[0-2]\d)\b', raw_text)
        if dob_match:
            fields["dob"] = dob_match.group(0).replace(".", "/").replace("-", "/").replace(" ", "")

        if not fields.get("dob"):
            age_match = re.search(r'(?:Age|आयु)[\s.:]*([0-9]{2})\s*(?:Years|वर्ष)?(?!\s*[/.-]\s*\d{2})', raw_text, re.IGNORECASE)
            if age_match:
                fields["age"] = age_match.group(1)

        # 4. Relation Name (Father / Husband / Mother / Guardian)
        # OCR often misreads "Father's Name" as "Father'$ Name", "Father 's Name", etc.
        rel_match = re.search(r'(?:Father[^\w\n]{0,4}\s*Name|Husband[^\w\n]{0,4}\s*Name|Mother[^\w\n]{0,4}\s*Name|Relation|पिता|पति|माता)[\s.:\n]+([A-Za-z\s\.\'-]{3,40})', raw_text, re.IGNORECASE)
        if rel_match:
            cand_rel = rel_match.group(1).strip().split('\n')[0].strip()
            cand_rel = re.sub(r'(?:Gender|Sex|लिंग|Age|आयु|DOB|Date).*$', '', cand_rel, flags=re.IGNORECASE).strip()
            if len(cand_rel) >= 3 and not any(k in cand_rel.upper() for k in ["ELECTION", "COMMISSION", "BHARAT", "NIRVACHAN", "INDIA"]):
                fields["relation_name"] = cand_rel

        # 5. Elector / Holder Name Extraction
        name_match = re.search(r'(?:Elector[^\w\n]{0,4}\s*Name|Name|निर्वाचक\s*का\s*नाम|नाम)[\s.:\n]+([A-Za-z\s\.\'-]{3,40})', raw_text, re.IGNORECASE)
        if name_match:
            cand = name_match.group(1).strip().split('\n')[0].strip()
            cand = re.sub(r'(?:Father|Husband|Mother|Relation|पिता|पति|Gender|Sex|लिंग|Age|आयु).*$', '', cand, flags=re.IGNORECASE).strip()
            if len(cand) >= 3 and not any(k in cand.upper() for k in ["ELECTION", "COMMISSION", "BHARAT", "NIRVACHAN", "INDIA", "ELECTOR", "PHOTO", "IDENTITY"]):
                fields["name"] = cand

        # Fallback Name Extraction using lines
        if not fields.get("name"):
            lines = [l.strip() for l in raw_text.split('\n') if l.strip()]
            forbidden = {
                "ELECTION", "COMMISSION", "INDIA", "BHARAT", "NIRVACHAN", "AAYOG",
                "ELECTOR", "IDENTITY", "CARD", "EPIC", "MALE", "FEMALE", "SEX", "GENDER",
                "FATHER", "HUSBAND", "MOTHER", "AGE", "YEARS", "DATE", "BIRTH"
            }

            # Find anchor line (Father's Name, Gender, or Age)
            anchor_idx = -1
            for idx, line in enumerate(lines):
                line_up = line.upper()
                if any(k in line_up for k in ["FATHER", "HUSBAND", "RELATION", "पिता", "पति", "GENDER", "SEX", "लिंग"]):
                    anchor_idx = idx
                    break

            if anchor_idx > 0:
                for offset in range(1, min(3, anchor_idx + 1)):
                    cand_line = lines[anchor_idx - offset]
                    ascii_clean = re.sub(r'[^A-Za-z\s\.\'-]', ' ', cand_line).strip()
                    if 3 <= len(ascii_clean) <= 40:
                        up_cand = ascii_clean.upper()
                        if not any(k in up_cand for k in forbidden):
                            words = [w for w in ascii_clean.split() if len(w) >= 2]
                            if 1 <= len(words) <= 5:
                                fields["name"] = " ".join(words)
                                break

        # 6. Address Extraction (typically found on reverse side)
        addr_match = re.search(r'(?:Address|पता)[\s.:\n]+([\s\S]{10,120})', raw_text, re.IGNORECASE)
        if addr_match:
            cand_addr = addr_match.group(1).strip()
            # Stop address at signature/place lines
            cand_addr = re.split(r'(?:Electoral|Registration|Officer|Date|Place|दिनांक|स्थान)', cand_addr, flags=re.IGNORECASE)[0].strip()
            if len(cand_addr) >= 10:
                fields["address"] = cand_addr.replace('\n', ', ')

        return fields
