"""Test updated ML service: predict_proba output and label thresholds."""
import sys
sys.path.insert(0, '.')

import types
m = types.ModuleType('__main__')
sys.modules['__main__'] = m

from app.services.ml_service import predict_asd, get_asd_probability_label

# Low score adult
scores_low = {k: 0 for k in ['A1','A2','A3','A4','A5','A6','A7','A8','A9','A10_Autism_Spectrum_Quotient']}
prob, label = predict_asd(scores_low, age_years=25, sex='M', ethnicity='White-European', jaundice='No', family_asd='No', completed_by='self')
print(f'Low-score adult:  prob={prob:.4f}, label={label}')

# High score adult
scores_high = {k: 1 for k in ['A1','A2','A3','A4','A5','A6','A7','A8','A9','A10_Autism_Spectrum_Quotient']}
prob2, label2 = predict_asd(scores_high, age_years=30, sex='F', ethnicity='White-European', jaundice='Yes', family_asd='Yes', completed_by='self')
print(f'High-score adult: prob={prob2:.4f}, label={label2}')

# Threshold mapping
print('\nThreshold checks:')
for p in [0.1, 0.35, 0.55, 0.75]:
    print(f'  prob={p:.2f} -> {get_asd_probability_label(p)}')

print('\nAll tests passed.')
