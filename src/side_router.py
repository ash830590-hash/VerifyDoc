from typing import Dict, Any

class DocumentSideRules:
    """
    Side-Aware Extraction Rules for Scanner Inputs:
    Enforces document-specific and side-specific rules for visual components and OCR fields.
    Prevents searching for QR codes on non-QR sides/documents (e.g. Passport, Aadhaar Front).
    """

    RULES = {
        "aadhaar": {
            "front": {
                "extract_photo": True,
                "extract_qr": False,      # QR search disabled on Aadhaar Front
                "extract_mrz": False,
                "target_fields": ["name", "dob", "gender", "aadhaar_number"]
            },
            "back": {
                "extract_photo": False,     # Photo search disabled on Aadhaar Back
                "extract_qr": True,       # Extract 2D QR Code on Back
                "extract_mrz": False,
                "target_fields": ["address", "aadhaar_number", "pin"]
            },
            "full_page": {
                "extract_photo": True,
                "extract_qr": True,
                "extract_mrz": False,
                "target_fields": ["name", "dob", "gender", "aadhaar_number", "address"]
            }
        },
        "passport": {
            "front": {
                "extract_photo": True,
                "extract_qr": False,      # Passports DO NOT have QR codes
                "extract_mrz": True,       # Extract ICAO 9303 MRZ zone
                "target_fields": ["passport_number", "surname", "given_name", "nationality", "dob", "sex", "expiry_date", "mrz_raw"]
            },
            "full_page": {
                "extract_photo": True,
                "extract_qr": False,      # Passports DO NOT have QR codes
                "extract_mrz": True,
                "target_fields": ["passport_number", "surname", "given_name", "nationality", "dob", "sex", "expiry_date", "mrz_raw"]
            }
        },
        "dl": {
            "front": {
                "extract_photo": True,
                "extract_qr": False,      # DL Front has chip/photo, no QR
                "extract_mrz": False,
                "target_fields": ["dl_number", "name", "dob", "issue_date", "validity_nt"]
            },
            "back": {
                "extract_photo": False,
                "extract_qr": True,       # DL Back has small QR/barcode
                "extract_mrz": False,
                "target_fields": ["address", "vehicle_classes"]
            },
            "full_page": {
                "extract_photo": True,
                "extract_qr": True,
                "extract_mrz": False,
                "target_fields": ["dl_number", "name", "dob", "issue_date", "validity_nt", "address", "vehicle_classes"]
            }
        },
        "visa": {
            "front": {
                "extract_photo": True,
                "extract_qr": False,
                "extract_mrz": True,
                "target_fields": ["visa_number", "passport_number", "name", "visa_type", "entries", "mrz_raw"]
            },
            "full_page": {
                "extract_photo": True,
                "extract_qr": False,
                "extract_mrz": True,
                "target_fields": ["visa_number", "passport_number", "name", "visa_type", "entries", "mrz_raw"]
            }
        },
        "pan": {
            "front": {
                "extract_photo": True,
                "extract_qr": True,
                "extract_mrz": False,
                "target_fields": ["pan_number", "name", "father_name", "dob"]
            },
            "full_page": {
                "extract_photo": True,
                "extract_qr": True,
                "extract_mrz": False,
                "target_fields": ["pan_number", "name", "father_name", "dob"]
            }
        },
        "voter_id": {
            "front": {
                "extract_photo": True,
                "extract_qr": False,
                "extract_mrz": False,
                "target_fields": ["epic_number", "name", "relation_name", "gender", "dob", "age"]
            },
            "back": {
                "extract_photo": False,
                "extract_qr": True,
                "extract_mrz": False,
                "target_fields": ["address", "epic_number"]
            },
            "full_page": {
                "extract_photo": True,
                "extract_qr": True,
                "extract_mrz": False,
                "target_fields": ["epic_number", "name", "relation_name", "gender", "dob", "address"]
            }
        }
    }

    @classmethod
    def get_rules(cls, doc_type: str, side: str = "auto") -> Dict[str, Any]:
        doc_key = doc_type.lower() if doc_type else "aadhaar"
        if doc_key not in cls.RULES:
            doc_key = "aadhaar"

        doc_rules = cls.RULES[doc_key]
        side_key = side.lower() if side else "full_page"
        if side_key not in doc_rules:
            side_key = "full_page" if "full_page" in doc_rules else list(doc_rules.keys())[0]

        return doc_rules[side_key]
