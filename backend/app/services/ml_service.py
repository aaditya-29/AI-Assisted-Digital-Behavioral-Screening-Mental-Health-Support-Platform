"""
ML Service

Loads and runs the ASD prediction pipeline.

The saved pipeline (ASDInferencePipeline) has:
  - encoder: OneHotEncoder fit on ['Ethnicity','Sex','Jaundice','Family_mem_with_ASD',
                                    'Who_completed_the_test','ASD_traits']
  - models: {'Children': RFC, 'Adolescent': RFC, 'Adult': RFC}
  - feature_columns: final feature order after OHE (excludes ASD_traits OHE cols)
  - categorical_cols: stored but ordering differs from encoder fit order — use
                      feature_columns to derive correct order instead.
"""
import os
import logging
from typing import Optional, Tuple
from datetime import date

logger = logging.getLogger(__name__)

_MODEL_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "ml_models",
    "asd_pipeline.joblib"
)

# ── Pipeline stub needed for unpickling ──────────────────────────────────────
class ASDInferencePipeline:
    """
    Reconstructed ASDInferencePipeline class required to unpickle the saved model.

    Attributes loaded from the joblib file:
        encoder           (sklearn OneHotEncoder)
        models            (dict: 'Children'|'Adolescent'|'Adult' → RandomForestClassifier)
        feature_columns   (pandas Index of final feature names)
        categorical_cols  (list — stored order, but encoder was actually fit in a different order)
    """

    # Encoder was fit in this column order (derived from feature_columns prefixes)
    _ENC_COLS = ['Ethnicity', 'Sex', 'Jaundice', 'Family_mem_with_ASD', 'Who_completed_the_test', 'ASD_traits']

    def _manual_ohe(self, X) -> "pd.DataFrame":
        """
        Manually construct one-hot encoded columns to avoid sklearn version
        incompatibilities with encoder.transform(). Uses the known categories
        stored in self.encoder.categories_.
        """
        import pandas as pd, numpy as np

        ohe_rows = {col: [] for col in self.feature_columns}
        for _, row in X.iterrows():
            for enc_col, cats in zip(self._ENC_COLS, self.encoder.categories_):
                val = row.get(enc_col)
                for cat in cats:
                    col_name = f"{enc_col}_{cat}"
                    if col_name in ohe_rows:
                        ohe_rows[col_name].append(1 if val == cat else 0)
        # Only build OHE cols that are in feature_columns
        ohe_df = pd.DataFrame({k: v for k, v in ohe_rows.items() if v})
        return ohe_df

    def predict(self, X):
        """
        Return ASD probability (float 0–1) for a single-row DataFrame.

        X must contain: A1-A9, A10_Autism_Spectrum_Quotient, Age_Years,
                        Ethnicity, Sex ('F'|'M'), Jaundice ('No'|'Yes'),
                        Family_mem_with_ASD ('No'|'Yes'),
                        Who_completed_the_test.
        """
        import pandas as pd

        age = int(X['Age_Years'].iloc[0])
        if age <= 11:
            model = self.models['Children']
        elif age <= 15:
            model = self.models['Adolescent']
        else:
            model = self.models['Adult']

        # Add dummy ASD_traits for encoder compatibility
        X_enc_input = X.copy()
        X_enc_input['ASD_traits'] = 0

        # OHE features via manual construction (avoids sklearn isnan bug)
        X_cat_df = self._manual_ohe(X_enc_input).reset_index(drop=True)

        # Numeric features (those in feature_columns present in X)
        numeric_cols = [c for c in self.feature_columns if c in X.columns]
        X_num = X[numeric_cols].reset_index(drop=True)

        X_combined = pd.concat([X_num, X_cat_df], axis=1)

        # Select only the columns in feature_columns (in order)
        available_cols = [c for c in self.feature_columns if c in X_combined.columns]
        X_final = X_combined[available_cols]

        # Fill any missing feature_columns with 0
        for fc in self.feature_columns:
            if fc not in X_final.columns:
                X_final = X_final.copy()
                X_final[fc] = 0
        X_final = X_final[self.feature_columns]

        # Return probability of class 1 (ASD traits present)
        proba = model.predict_proba(X_final)
        return [float(proba[0][1])]


_pipeline: Optional[ASDInferencePipeline] = None


def _get_pipeline() -> ASDInferencePipeline:
    """Load the ML pipeline lazily (cached after first load)."""
    global _pipeline
    if _pipeline is None:
        import joblib
        import sys

        # The model was pickled with ASDInferencePipeline defined in __main__.
        # Register the stub in __main__ so pickle can resolve it during load.
        sys.modules['__main__'].ASDInferencePipeline = ASDInferencePipeline

        if not os.path.exists(_MODEL_PATH):
            raise FileNotFoundError(f"ASD pipeline not found at: {_MODEL_PATH}")
        _pipeline = joblib.load(_MODEL_PATH)
        # Re-bind the class so the loaded object has our predict method
        _pipeline.__class__ = ASDInferencePipeline
        logger.info(f"Loaded ASD pipeline from {_MODEL_PATH}")
    return _pipeline


# ── Label / Key Maps ──────────────────────────────────────────────────────────

_LABEL_TO_ML = {
    "AQ1": "A1", "AQ2": "A2", "AQ3": "A3", "AQ4": "A4", "AQ5": "A5",
    "AQ6": "A6", "AQ7": "A7", "AQ8": "A8", "AQ9": "A9",
    "AQ10": "A10_Autism_Spectrum_Quotient",
}

_AQ_ML_KEYS = list(_LABEL_TO_ML.values())

# Map user-facing Who_completed values to model training values
_WHO_MAP = {
    "self": "Self",
    "family member": "Family Member",
    "health care professional": "Healthcare Professional",
    "healthcare professional": "Healthcare Professional",
    "school and ngo": "School And Ngo",
    "others": "Other",
    "other": "Other",
    "parent": "Parent",
    "relative": "Relative",
}


def map_label_to_ml_key(label: str) -> str:
    """Convert AQ JSON label (AQ1–AQ10) to ML feature name."""
    return _LABEL_TO_ML.get(label, label)


def get_age_years(dob: Optional[date]) -> int:
    """Compute age in whole years from date of birth."""
    if not dob:
        return 25
    today = date.today()
    age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
    return max(1, age)


def normalize_sex(gender: Optional[str]) -> str:
    """Normalize user gender to model expected value ('F' | 'M')."""
    if not gender:
        return "M"
    g = gender.strip().lower()
    if g in ("female", "f"):
        return "F"
    return "M"


def normalize_who_completed(who: Optional[str]) -> str:
    """Map frontend 'completed_by' value to model training value."""
    if not who:
        return "Self"
    return _WHO_MAP.get(who.strip().lower(), who)


def get_asd_probability_label(probability: float) -> str:
    """
    Derive a human-readable ASD likelihood label from ML probability (0–1).

    - probability < 0.30  → "low"
    - 0.30 ≤ prob < 0.50  → "moderate"
    - 0.50 ≤ prob < 0.70  → "high"
    - probability ≥ 0.70  → "very_high"
    """
    if probability < 0.30:
        return "low"
    if probability < 0.50:
        return "moderate"
    if probability < 0.70:
        return "high"
    return "very_high"


def predict_asd(
    question_scores: dict,
    age_years: int,
    sex: str,
    ethnicity: Optional[str],
    jaundice: Optional[str],
    family_asd: Optional[str],
    completed_by: Optional[str],
) -> Tuple[float, str]:
    """
    Run the ASD pipeline and return (ml_probability: float, ml_probability_label: str).

    ml_probability is the model's raw probability for ASD traits (0.0–1.0).
    question_scores must use ML feature keys: A1–A9, A10_Autism_Spectrum_Quotient.
    sex must be 'F' or 'M'.
    jaundice / family_asd must be 'No' or 'Yes' (capitalised).
    """
    import pandas as pd

    jaundice_val = jaundice.capitalize() if jaundice else "No"
    family_val = family_asd.capitalize() if family_asd else "No"

    input_data = pd.DataFrame([{
        **{k: question_scores.get(k, 0) for k in _AQ_ML_KEYS},
        "Age_Years": age_years,
        "Sex": sex,
        "Ethnicity": ethnicity if ethnicity else "Other",
        "Jaundice": jaundice_val,
        "Family_mem_with_ASD": family_val,
        "Who_completed_the_test": normalize_who_completed(completed_by),
    }])

    pipeline = _get_pipeline()
    proba_result = pipeline.predict(input_data)
    ml_probability = float(proba_result[0])

    label = get_asd_probability_label(ml_probability)
    return ml_probability, label

