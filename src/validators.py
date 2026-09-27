import re
from typing import Dict, Any
from src.verhoeff import Verhoeff

class DocumentValidator:
    """
    Validates extracted document fields and produces field-level validation status ('pass' / 'fail').
    """

    @classmethod
    def validate_document(cls, doc_type: str, extracted_fields: Dict[str, Any]) -> Dict[str, str]:
        """
        Runs document validation rules per field.
        Returns dictionary of field_name -> 'pass' / 'fail'.
        """
        status = {}
        overall_pass = True

        if doc_type == "aadhaar":
            uid = extracted_fields.get("aadhaar_number")
            if uid:
                clean_uid = str(uid).replace(" ", "")
                # Respect masked UIDs (e.g., XXXX XXXX 1234)
                if "X" in clean_uid.upper():
                    status["aadhaar_number"] = "pass"
                elif len(clean_uid) == 12 and clean_uid.isdigit():
                    is_valid = Verhoeff.validate(clean_uid)
                    status["aadhaar_number"] = "pass" if is_valid else "fail"
                else:
                    status["aadhaar_number"] = "fail"
            else:
                status["aadhaar_number"] = "fail"

            if extracted_fields.get("dob"):
                status["dob"] = "pass"
            if extracted_fields.get("name"):
                status["name"] = "pass"

        elif doc_type in ("passport", "visa"):
            mrz_valid = extracted_fields.get("mrz_checksum_valid")
            if mrz_valid is True:
                status["mrz_check_digits"] = "pass"
            elif mrz_valid is False:
                status["mrz_check_digits"] = "fail"
            else:
                status["mrz_check_digits"] = "pass" if extracted_fields.get("mrz_raw") else "fail"

            doc_num = extracted_fields.get("passport_number") or extracted_fields.get("visa_number")
            if doc_num:
                status["document_number"] = "pass"
            else:
                status["document_number"] = "fail"

        elif doc_type in ("driving_licence", "dl", "driving_license"):
            dl_num = extracted_fields.get("dl_number")
            if dl_num and (len(str(dl_num)) >= 10):
                status["dl_number"] = "pass"
            else:
                status["dl_number"] = "fail"

            if extracted_fields.get("name"):
                status["name"] = "pass"

        elif doc_type in ("pan", "pan_card"):
            pan_num = str(extracted_fields.get("pan_number", "")).strip().upper()
            if pan_num and re.match(r'^[A-Z]{5}[0-9]{4}[A-Z]$', pan_num):
                status["pan_number"] = "pass"
            else:
                status["pan_number"] = "fail"

            if extracted_fields.get("name"):
                status["name"] = "pass"
            if extracted_fields.get("dob"):
                status["dob"] = "pass"

        elif doc_type in ("voter_id", "voter", "epic"):
            epic_num = str(extracted_fields.get("epic_number") or extracted_fields.get("voter_id") or "").strip().upper()
            if epic_num and (re.match(r'^[A-Z]{3}[0-9]{7}$', epic_num) or len(epic_num) >= 8):
                status["epic_number"] = "pass"
            else:
                status["epic_number"] = "fail"

            if extracted_fields.get("name"):
                status["name"] = "pass"

        # Determine overall validation status
        for k, v in status.items():
            if v == "fail":
                overall_pass = False

        status["overall"] = "pass" if (overall_pass and len(status) > 0) else "fail"

        return status
