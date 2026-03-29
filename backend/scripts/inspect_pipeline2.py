"""Deep inspection of ASD inference pipeline."""
import joblib
import pandas as pd
import numpy as np

class ASDInferencePipeline:
    pass

import sys
sys.modules['__main__'].ASDInferencePipeline = ASDInferencePipeline

obj = joblib.load('ml_models/asd_pipeline.joblib')
enc = obj.encoder

print("n_features_in_:", enc.n_features_in_)
print("feature_names_in_:", getattr(enc, 'feature_names_in_', 'N/A'))
print("Number of categories_:", len(enc.categories_))

# Check if encoder has feature names
for i, cats in enumerate(enc.categories_):
    print(f"  category[{i}] ({len(cats)} values): {list(cats[:3])}...")

# Try building a sample and using encoder
sample = pd.DataFrame([{
    'Ethnicity': 'Asian', 'Sex': 'M', 'Jaundice': 'No',
    'Family_mem_with_ASD': 'No', 'Who_completed_the_test': 'Self'
}])
try:
    result = enc.transform(sample[['Ethnicity', 'Sex', 'Jaundice', 'Family_mem_with_ASD', 'Who_completed_the_test']])
    print("Transform with 5 cols succeeded, shape:", result.shape)
except Exception as e:
    print("Transform with 5 cols failed:", e)
