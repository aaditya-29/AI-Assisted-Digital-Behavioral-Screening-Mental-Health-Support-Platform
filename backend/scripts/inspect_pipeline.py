"""Inspect the ASD inference pipeline structure."""
import joblib
import pandas as pd
import sys

# The pipeline was saved with a custom class in __main__
# We need to add the class definition to allow unpickling
class ASDInferencePipeline:
    """Minimal stub to allow unpickling."""
    pass

# Register in the current module so pickle can find it
current_module = sys.modules[__name__]
current_module.ASDInferencePipeline = ASDInferencePipeline

obj = joblib.load('ml_models/asd_pipeline.joblib')
print("Models:", {k: type(v).__name__ for k, v in obj.models.items()})
print("Feature columns:", list(obj.feature_columns))
print("Categorical cols:", obj.categorical_cols)
print("Encoder categories:", [list(c) for c in obj.encoder.categories_])
