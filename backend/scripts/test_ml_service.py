"""Test the full ML service predict pipeline."""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import the service (which registers ASDInferencePipeline)
from app.services import ml_service

# Test prediction
question_scores = {
    'A1': 1, 'A2': 0, 'A3': 1, 'A4': 0, 'A5': 1,
    'A6': 1, 'A7': 0, 'A8': 1, 'A9': 0, 'A10_Autism_Spectrum_Quotient': 1,
}

try:
    ml_pred, ml_label = ml_service.predict_asd(
        question_scores=question_scores,
        age_years=10,
        sex=ml_service.normalize_sex('Male'),
        ethnicity='Asian',
        jaundice='No',
        family_asd='No',
        completed_by='Parent',
    )
    print(f"✓ Prediction: {ml_pred}, Label: {ml_label}")
except Exception as e:
    print(f"✗ Error: {e}")
    import traceback; traceback.print_exc()

# Test adult
try:
    ml_pred2, ml_label2 = ml_service.predict_asd(
        question_scores={k: 0 for k in question_scores},
        age_years=25,
        sex=ml_service.normalize_sex('Female'),
        ethnicity='White European',
        jaundice='No',
        family_asd='No',
        completed_by='Self',
    )
    print(f"✓ Adult no-ASD: {ml_pred2}, Label: {ml_label2}")
except Exception as e:
    print(f"✗ Error adult: {e}")
    import traceback; traceback.print_exc()
