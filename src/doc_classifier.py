import re
from typing import Dict, Any

class DocumentClassifier:
    """
    Keyword and Pattern Heuristic Classifier for Indian Identity Documents:
    aadhaar, passport, driving_licence, visa, or unknown.
    """

    DOCUMENT_TYPES = {
        "aadhaar": "Aadhaar Card",
        "passport": "Indian Passport",
        "visa": "Indian Visa",
        "driving_licence": "Driving Licence",
        "dl": "Driving Licence",
        "pan": "PAN Card",
        "voter_id": "Voter ID Card"
    }

    @classmethod
    def classify(cls, raw_text: str, qr_payload: str = "") -> Dict[str, Any]:
        """
        Classifies document based on text keywords, MRZ headers, and number regex patterns.
        Returns document_type string and confidence score.
        """
        text_upper = (raw_text + " " + qr_payload).upper()
        scores = {
            "aadhaar": 0,
            "passport": 0,
            "visa": 0,
            "driving_licence": 0,
            "pan": 0,
            "voter_id": 0
        }

        # 1. Aadhaar Indicators
        aadhaar_keywords = [
            "UNIQUE IDENTIFICATION AUTHORITY OF INDIA", "GOVERNMENT OF INDIA",
            "BHARAT SARKAR", "ENROLMENT", "VID:", "AADHAAR", "HELP@UIDAI",
            "MERA AADHAAR", "AMADHAAR", "DOB:", "MALE", "FEMALE"
        ]
        for kw in aadhaar_keywords:
            if kw in text_upper:
                scores["aadhaar"] += 20
        if re.search(r'\b\d{4}\s?\d{4}\s?\d{4}\b', text_upper) or re.search(r'\b[X\d]{4}\s?[X\d]{4}\s?\d{4}\b', text_upper):
            scores["aadhaar"] += 50

        # 2. Passport Indicators
        passport_keywords = [
            "PASSPORT", "PASSPORT NO", "REPUBLIC OF INDIA", "TYPE P", "CODE IND",
            "GIVEN NAME", "SURNAME", "PLACE OF BIRTH", "PLACE OF ISSUE", "P<IND"
        ]
        for kw in passport_keywords:
            if kw in text_upper:
                scores["passport"] += 20
        if "P<IND" in text_upper or re.search(r'\bP<[A-Z0-9<]{3}', text_upper) or "PASSPORT" in text_upper:
            scores["passport"] += 60
        if re.search(r'\b[A-Z]{1,2}\d{7}\b', text_upper):
            scores["passport"] += 40

        # 3. Visa Indicators
        visa_keywords = [
            "INDIAN VISA", "VISA TYPE", "NO OF ENTRIES", "SPECIAL ENDORSEMENT",
            "DATE OF ISSUE", "DATE OF EXPIRY", "TOURIST", "VTIND", "V<IND", "CHANGE OF PURPOSE NOT ALLOWED"
        ]
        for kw in visa_keywords:
            if kw in text_upper:
                scores["visa"] += 25
        if "VTIND" in text_upper or "V<IND" in text_upper or "INDIAN VISA" in text_upper:
            scores["visa"] += 60

        # Filename / header hints
        if "VISA" in text_upper:
            scores["visa"] += 40
        if "PASSPORT" in text_upper:
            scores["passport"] += 40
        if "DL" in text_upper or "DRIVING" in text_upper or "LICENCE" in text_upper:
            scores["driving_licence"] += 40
        if "AADHAAR" in text_upper or "UID" in text_upper:
            scores["aadhaar"] += 40

        # 4. Driving Licence Indicators
        dl_keywords = [
            "DRIVING LICENCE", "UNION DRIVING LICENCE", "LICENCING AUTHORITY",
            "CLASS OF VEHICLE", "MCWG", "LMV", "SON/DAUGHTER", "SON OF", "ORGAN DONOR",
            "VALIDITY (NT)", "VALIDITY (TR)", "DL NO", "FORM 7", "RTA MEDCHAL", "ISSUED BY TELANGANA"
        ]
        for kw in dl_keywords:
            if kw in text_upper:
                scores["driving_licence"] += 25
        if re.search(r'\b[A-Z]{2}\d{13,14}\b', text_upper) or "DL NO" in text_upper or "DRIVING" in text_upper:
            scores["driving_licence"] += 60

        # 5. PAN Card Indicators
        pan_keywords = [
            "INCOME TAX DEPARTMENT", "PERMANENT ACCOUNT NUMBER", "GOVT. OF INDIA",
            "INCOMETAX", "PAN CARD", "FATHER'S NAME"
        ]
        for kw in pan_keywords:
            if kw in text_upper:
                scores["pan"] += 25
        if re.search(r'\b[A-Z]{5}[0-9]{4}[A-Z]\b', text_upper):
            scores["pan"] += 70
        if "PAN" in text_upper:
            scores["pan"] += 30

        # 6. Voter ID (EPIC) Indicators
        voter_keywords = [
            "ELECTION COMMISSION OF INDIA", "ELECTOR PHOTO IDENTITY CARD",
            "BHARAT NIRVACHAN AAYOG", "MATDATA PEHCHAN PATRA", "ELECTOR'S NAME",
            "EPIC NO", "ELECTION"
        ]
        for kw in voter_keywords:
            if kw in text_upper:
                scores["voter_id"] += 25
        if re.search(r'\b[A-Z]{3}[0-9]{7}\b', text_upper):
            scores["voter_id"] += 70
        if "VOTER" in text_upper or "EPIC" in text_upper:
            scores["voter_id"] += 30

        # Determine highest scoring document type
        best_doc_type = max(scores, key=scores.get)
        max_score = scores[best_doc_type]

        if max_score == 0:
            best_doc_type = "unknown"
            confidence = 0.0
        else:
            confidence = min(round((max_score / 150.0) * 100.0, 2), 99.0)
            if max_score > 60:
                confidence = max(confidence, 85.0)

        return {
            "document_type": best_doc_type,
            "document_name": cls.DOCUMENT_TYPES.get(best_doc_type, "Unknown Document"),
            "confidence": confidence,
            "all_scores": scores
        }
