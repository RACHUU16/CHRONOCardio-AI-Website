import os
import io
import json
import uuid
import numpy as np
from datetime import datetime
from flask import Flask, request, jsonify
from flask_cors import CORS
from werkzeug.utils import secure_filename

# ML/Preprocessing
import cv2
from scipy.signal import spectrogram, find_peaks
import tensorflow as tf

# Supabase (server-side) - optional if you want backend to write records
from supabase import create_client, Client
from dotenv import load_dotenv
from pathlib import Path

import jwt
import base64


BACKEND_PORT = int(os.environ.get("PORT", 5000))
MODELS_DIR = os.environ.get("MODELS_DIR", os.path.join(os.path.dirname(os.path.dirname(__file__)), "Models", "Models"))
MODEL_FILENAME = os.environ.get("MODEL_FILENAME", "hybrid_model.h5")

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")


def create_app() -> Flask:
    # Load env from backend/.env regardless of current working directory
    try:
        env_path = Path(__file__).resolve().parent / ".env"
        load_dotenv(dotenv_path=env_path)
    except Exception:
        # Fallback to default lookup
        load_dotenv()
    app = Flask(__name__)
    CORS(app, resources={r"/api/*": {"origins": "*"}})

    # In-memory fallbacks when Supabase is not configured or write fails
    app.memory_patients: list[dict] = []
    app.memory_records: list[dict] = []

    # Load model once - prefer hybrid_model.h5 if present
    preferred_model = None
    try:
        hybrid_path = os.path.join(MODELS_DIR, 'hybrid_model.h5')
        if os.path.exists(hybrid_path):
            try:
                app.model = tf.keras.models.load_model(hybrid_path)
                preferred_model = 'hybrid_model.h5'
                print(f"[INFO] Primary model set to hybrid_model.h5")
            except Exception as e:
                print(f"[WARN] Failed to load hybrid_model.h5 as primary: {e}")
        if preferred_model is None:
            model_path = os.path.join(MODELS_DIR, MODEL_FILENAME)
            if not os.path.exists(model_path):
                raise FileNotFoundError(f"Model not found at {model_path}")
            app.model = tf.keras.models.load_model(model_path)
            preferred_model = os.path.basename(model_path)
            print(f"[INFO] Primary model set to {preferred_model}")
    except Exception as e:
        raise
    # Try to preload alternative specialized models if available
    app.other_models = {}
    try:
        for alt in ("biomarker_only_model.h5", "ecg_only_model.h5", "hybrid_model.h5"):
            p = os.path.join(MODELS_DIR, alt)
            if os.path.exists(p):
                try:
                    m = tf.keras.models.load_model(p)
                    app.other_models[alt] = m
                    print(f"[INFO] Loaded alternative model: {alt}")
                except Exception as e:
                    print(f"[WARN] Failed to load alternative model {alt}: {e}")
    except Exception:
        pass

    # Optional Supabase client (for record persistence)
    app.supabase: Client | None = None
    # Re-read env after load_dotenv
    supabase_url = os.environ.get("SUPABASE_URL")
    supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if supabase_url and supabase_key:
        app.supabase = create_client(supabase_url, supabase_key)

    # Try to load preprocessing artifacts (imputer/scalers) if present
    app.preprocessors = {}
    try:
        import joblib
        base = MODELS_DIR
        for fname in ("imputer.joblib", "scaler_dynamic.joblib", "scaler_static.joblib"):
            path = os.path.join(base, fname)
            if os.path.exists(path):
                try:
                    app.preprocessors[fname] = joblib.load(path)
                    print(f"[INFO] Loaded preprocessor: {fname}")
                except Exception as e:
                    print(f"[WARN] Failed to load {fname}: {e}")
    except Exception:
        # joblib may not be available; continue without preprocessors
        pass

    # --- Utility functions ---
    def remove_ecg_grid(image_bgr: np.ndarray) -> np.ndarray:
        gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
        # Contrast Limited Adaptive Histogram Equalization (improves waveform visibility)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        gray_eq = clahe.apply(gray)
        # Adaptive threshold to isolate gridlines
        thr = cv2.adaptiveThreshold(gray_eq, 255, cv2.ADAPTIVE_THRESH_MEAN_C,
                                    cv2.THRESH_BINARY_INV, 31, 7)
        # Morphological operations to emphasize line structures
        kernel_h = cv2.getStructuringElement(cv2.MORPH_RECT, (21, 1))
        kernel_v = cv2.getStructuringElement(cv2.MORPH_RECT, (1, 21))
        lines_h = cv2.morphologyEx(thr, cv2.MORPH_OPEN, kernel_h)
        lines_v = cv2.morphologyEx(thr, cv2.MORPH_OPEN, kernel_v)
        grid = cv2.bitwise_or(lines_h, lines_v)
        # Inpaint to remove grid
        cleaned = cv2.inpaint(image_bgr, grid, 3, cv2.INPAINT_TELEA)
        return cleaned

    def image_to_spectrogram(image_bgr: np.ndarray, target_shape: tuple[int, int] = (224, 224)) -> np.ndarray:
        # Convert to gray and extract a 1D signal by row-median (more robust to spikes)
        gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
        # Light denoise
        gray = cv2.GaussianBlur(gray, (3, 3), 0)
        # Normalize per-image to 0..1
        gmin, gmax = float(gray.min()), float(gray.max())
        if gmax > gmin:
            gray = ((gray - gmin) / (gmax - gmin) * 255.0).astype(np.uint8)
        signal_1d = np.median(gray, axis=0)
        # Compute spectrogram (slightly different window to add variability)
        f, t, Sxx = spectrogram(signal_1d, fs=250.0, nperseg=128, noverlap=96)
        Sxx_log = np.log1p(Sxx)
        Sxx_norm = (Sxx_log - Sxx_log.min()) / (Sxx_log.max() - Sxx_log.min() + 1e-8)
        # Resize to target shape
        Sxx_resized = cv2.resize(Sxx_norm.astype(np.float32), target_shape, interpolation=cv2.INTER_AREA)
        # Normalize to [0,1]
        Sxx_resized = np.clip(Sxx_resized, 0.0, 1.0)
        # Model may expect 3 channels
        spectro_image = np.stack([Sxx_resized, Sxx_resized, Sxx_resized], axis=-1)
        return spectro_image

    def prepare_biomarker_vector(biomarkers: dict) -> np.ndarray:
        # Map frontend fields to numeric vector; robust to multiple key spellings/cases
        def get_numeric(names, default=0.0):
            # names: list of possible keys in order of preference
            for n in names:
                if n in biomarkers and biomarkers.get(n) not in (None, ""):
                    try:
                        return float(biomarkers.get(n))
                    except Exception:
                        try:
                            return float(str(biomarkers.get(n)).strip())
                        except Exception:
                            return float(default)
            return float(default)

        # Define expected numeric fields with common aliases and their standard names
        # standard_name -> (aliases, default, description)
        biomarker_fields = {
            'age': (['age', 'patient_age'], 0.0, 'Patient age in years'),
            'bmi': (['bmi', 'body_mass_index'], 0.0, 'Body Mass Index'),
            'avg_heart_rate': (['avg_mhr', 'avg_heart_rate', 'mean_heart_rate'], 0.0, 'Average heart rate'),
            'ecg_mean_hr': (['ecg_mean_hr', 'ecg_hr'], 0.0, 'ECG mean heart rate'),
            'pr_interval': (['pr', 'pr_interval'], 0.0, 'PR interval'),
            'rr_interval': (['rr', 'rr_interval'], 0.0, 'RR interval'),
            'systolic_bp': (['systolicBp', 'systolicBP', 'systolic_bp'], 0.0, 'Systolic blood pressure'),
            'diastolic_bp': (['diastolicBp', 'diastolicBP', 'diastolic_bp'], 0.0, 'Diastolic blood pressure'),
            'total_cholesterol': (['cholesterol', 'totalCholesterol', 'total_cholesterol'], 0.0, 'Total cholesterol'),
            'ldl': (['ldl', 'ldl_cholesterol'], 0.0, 'LDL cholesterol'),
            'hdl': (['hdl', 'hdl_cholesterol'], 0.0, 'HDL cholesterol'),
            'triglycerides': (['triglycerides', 'trig'], 0.0, 'Triglycerides'),
            'hs_crp': (['hsCrp', 'hsCRP', 'hs_crp'], 0.0, 'High-sensitivity CRP'),
            'hba1c': (['hba1c', 'hba1C', 'hba_1c'], 0.0, 'HbA1c'),
            'fasting_glucose': (['fasting_glucose', 'glucose'], 0.0, 'Fasting glucose'),
            'sleep_hours': (['sleepHours', 'sleep_hours'], 0.0, 'Sleep hours per night'),
            'physical_activity': (['physicalActivity', 'physical_activity'], 0.0, 'Physical activity minutes/week'),
        }

        # Categorical fields with value mappings
        categorical_fields = {
            'smoking_status': {
                'field': ['smokingStatus', 'smoking_status', 'smoking'],
                'map': {"never": 0, "non-smoker": 0, "no": 0, "former": 1, "current": 2, "current smoker": 2, "yes": 2},
                'default': 0
            },
            'diabetes_status': {
                'field': ['diabetes', 'diabetesStatus', 'diabetes_status'],
                'map': {"no": 0, "normal": 0, "prediabetes": 1, "prediabetic": 1, "type1": 2, "type2": 3},
                'default': 0
            },
            'family_history': {
                'field': ['familyHistory', 'family_history'],
                'map': {"no": 0, "yes": 1},
                'default': 0
            }
        }

        # Build name-value mapping first
        values = {}

        # Get numeric fields with proper names
        for std_name, (aliases, default, _) in biomarker_fields.items():
            values[std_name] = get_numeric(aliases, default)

        # Categorical encodings (case-insensitive)
        def norm_str(v):
            try:
                return str(v).strip().lower()
            except Exception:
                return ''

        # Process categoricals into standard names
        for std_name, info in categorical_fields.items():
            raw = ''
            for f in info['field']:
                if f in biomarkers:
                    raw = norm_str(biomarkers[f])
                    break
            values[std_name] = float(info['map'].get(raw, info['default']))

        # Look for feature names from preprocessors
        if getattr(app, 'preprocessors', None):
            # Try to get feature names from each preprocessor
            for pname in ('imputer.joblib', 'scaler_dynamic.joblib', 'scaler_static.joblib'):
                pre = app.preprocessors.get(pname)
                if pre is None:
                    continue
                try:
                    fnames = getattr(pre, 'feature_names_in_', None)
                    if fnames is not None and len(fnames) > 0:
                        if not hasattr(app, 'biomarker_feature_names'):
                            app.biomarker_feature_names = list(fnames)
                            print(f"[INFO] Loaded {len(fnames)} feature names from {pname}")
                        break
                except Exception:
                    pass

        # If we have preprocessor feature names, build vector in that order
        if hasattr(app, 'biomarker_feature_names') and app.biomarker_feature_names:
            vec = np.zeros(len(app.biomarker_feature_names), dtype=np.float32)
            for i, fname in enumerate(app.biomarker_feature_names):
                vec[i] = values.get(fname, 0.0)  # use 0 for missing
        else:
            # Otherwise build vector in our standard order
            vec = np.array([values.get(name, 0.0) for name in biomarker_fields.keys()] +
                          [values.get(name, 0.0) for name in categorical_fields.keys()],
                          dtype=np.float32)

        return vec

    def generate_recommendations(prediction_score: float) -> list[str]:
        # Updated thresholds to match new risk level thresholds (0.65, 0.35)
        if prediction_score >= 0.65:
            return [
                "Immediate cardiology consultation required",
                "Consider high-intensity statin therapy",
                "Weekly follow-up and monitoring",
                "Comprehensive lifestyle intervention",
                "Dual antiplatelet therapy evaluation",
                "Consider stress testing and advanced cardiac imaging",
            ]
        if prediction_score >= 0.35:
            return [
                "Structured exercise program (150 min/week moderate intensity)",
                "Dietary consultation for lipid management",
                "Monthly follow-up appointments",
                "Monitor blood pressure and HbA1c regularly",
                "Consider statin therapy based on lipid profile",
                "Weight management and lifestyle modifications",
            ]
        return [
            "Maintain healthy lifestyle practices",
            "Annual cardiovascular risk assessment",
            "Continue current medication regimen if applicable",
            "Regular physical activity (150 min/week)",
            "Heart-healthy diet rich in fruits and vegetables",
        ]

    # Helper function to extract user info from Authorization header
    def get_user_from_request():
        """Extract user email and hospital info from Authorization header"""
        auth_header = request.headers.get('Authorization', '')
        if not auth_header or not auth_header.startswith('Bearer '):
            return None, None
        
        token = auth_header.replace('Bearer ', '')
        
        # Handle demo token
        if token == 'demo-token-123':
            return 'demo@hospital.com', 'Demo General Hospital'
        
        try:
            # Decode JWT token (Supabase tokens are JWTs)
            # Note: We're not verifying the signature here, just extracting claims
            # For production, you should verify the token with Supabase
            decoded = jwt.decode(token, options={"verify_signature": False})
            user_email = decoded.get('email', '')
            hospital_name = decoded.get('user_metadata', {}).get('hospitalName', '') if decoded.get('user_metadata') else ''
            
            # If no hospital name in metadata, use email domain or email itself
            if not hospital_name:
                hospital_name = user_email.split('@')[0] if '@' in user_email else user_email
            
            return user_email, hospital_name
        except Exception as e:
            print(f"[WARN] Failed to decode token: {e}")
            # Try to extract from Supabase if configured
            if app.supabase:
                try:
                    # Use Supabase to get user from token
                    user = app.supabase.auth.get_user(token)
                    if user and hasattr(user, 'user'):
                        email = user.user.email if hasattr(user.user, 'email') else ''
                        hospital = user.user.user_metadata.get('hospitalName', '') if hasattr(user.user, 'user_metadata') and user.user.user_metadata else ''
                        if not hospital:
                            hospital = email.split('@')[0] if '@' in email else email
                        return email, hospital
                except Exception:
                    pass
            return None, None
    
    # --- Routes ---
    @app.route("/api/health", methods=["GET"])
    def health():
        return jsonify({"status": "ok", "model_loaded": True})

    @app.route("/api/db/check", methods=["GET"])
    def db_check():
        ok = False
        reason = None
        details = {}
        try:
            if app.supabase:
                # ping patients and ecg_records
                p = app.supabase.table("patients").select("id").limit(1).execute()
                r = app.supabase.table("ecg_records").select("id").limit(1).execute()
                ok = True
                details = {
                    "patients_rows": len(getattr(p, "data", []) or []),
                    "ecg_rows": len(getattr(r, "data", []) or []),
                }
            else:
                reason = "Supabase client not configured"
        except Exception as e:
            reason = str(e)
        return jsonify({"ok": ok, "reason": reason, "details": details, "has_url": bool(os.environ.get("SUPABASE_URL"))}), (200 if ok else 500)

    @app.route("/api/patients", methods=["POST"])
    def create_patient():
        # Get user info from auth token
        user_email, hospital_name = get_user_from_request()
        if not user_email:
            return jsonify({"error": "Authentication required"}), 401
        
        data = request.get_json(force=True)
        patient = data or {}
        patient_id = patient.get("id") or f"PAT{int(datetime.utcnow().timestamp()*1000)}"
        patient["id"] = patient_id
        patient["registrationDate"] = patient.get("registrationDate") or datetime.utcnow().isoformat()
        
        # Associate patient with user/hospital
        patient["userEmail"] = user_email
        patient["hospitalName"] = hospital_name

        # Always keep an in-memory copy so UI updates immediately (filtered by user)
        try:
            # De-duplicate by id
            app.memory_patients = [p for p in app.memory_patients if p.get("id") != patient_id]
            app.memory_patients.append(patient)
        except Exception:
            pass

        # Try to persist to Supabase if configured
        db_saved = False
        db_error = None
        if app.supabase:
            try:
                # Normalize payload to known columns we expect
                allowed_cols = {
                    "id", "userId", "userEmail", "hospitalName", "mrn", "firstName", "lastName", "age", "gender",
                    "email", "state", "district", "city", "pincode", "contactNo",
                    "existingConditions", "registrationDate", "createdAt"
                }
                working = {k: v for k, v in patient.items() if k in allowed_cols}
                if "createdAt" not in working:
                    working["createdAt"] = datetime.utcnow().isoformat()
                if "registrationDate" not in working:
                    working["registrationDate"] = datetime.utcnow().isoformat()
                # Ensure existingConditions is jsonb
                if "existingConditions" in working:
                    if not isinstance(working["existingConditions"], (list, dict)):
                        working["existingConditions"] = []
                
                # Ensure userEmail and hospitalName are set
                if "userEmail" not in working:
                    working["userEmail"] = user_email
                if "hospitalName" not in working:
                    working["hospitalName"] = hospital_name

                # Try insert; if Supabase complains about an unknown column, remove and retry
                max_retries = 6
                for attempt in range(max_retries):
                    try:
                        _ = app.supabase.table("patients").insert(working).execute()
                        db_saved = True
                        db_error = None
                        break
                    except Exception as inner_e:
                        msg = str(inner_e)
                        # Heuristic: find offending column name and drop it from payload, then retry
                        unknown_col = None
                        import re
                        m = re.search(r'column\s+"(\w+)"', msg)
                        if m:
                            unknown_col = m.group(1)
                        if not unknown_col:
                            m2 = re.search(r"'([A-Za-z0-9_]+)'\s+column\s+of\s+'patients'", msg)
                            if m2:
                                unknown_col = m2.group(1)
                        if not unknown_col:
                            for k in list(working.keys()):
                                if k in msg:
                                    unknown_col = k
                                    break
                        if unknown_col and unknown_col in working:
                            working.pop(unknown_col, None)
                            db_error = msg
                            continue
                        db_error = msg
                        break
            except Exception as e:
                db_error = str(e)

        return jsonify({"patient": patient, "db": {"saved": db_saved, "error": db_error}})

    @app.route("/api/patients", methods=["GET"])
    def list_patients():
        # Get user info from auth token
        user_email, hospital_name = get_user_from_request()
        if not user_email:
            return jsonify({"error": "Authentication required"}), 401
        
        # Prefer Supabase if available; otherwise return in-memory list (filtered by user)
        if app.supabase:
            try:
                query = app.supabase.table("patients").select("*")
                # Filter by userEmail or hospitalName
                query = query.eq("userEmail", user_email)
                query = query.order("createdAt", desc=True)
                resp = query.execute()
                
                if getattr(resp, "data", None):
                    patients = []
                    for p in resp.data:
                        patient = {k: v for k, v in p.items() if v is not None}
                        if "existingConditions" in patient and not isinstance(patient["existingConditions"], list):
                            patient["existingConditions"] = []
                        patients.append(patient)
                    return jsonify({"patients": patients})
            except Exception as e:
                print(f"[WARN] Supabase query failed: {e}")
                # fall back to memory
                pass
        
        # Return memory patients filtered by user
        user_patients = [p for p in app.memory_patients if p.get("userEmail") == user_email]
        return jsonify({"patients": sorted(user_patients, key=lambda x: x.get("registrationDate", ""), reverse=True)})

    @app.route("/api/patients/<patient_id>/history", methods=["GET"])
    def patient_history(patient_id: str):
        # Get user info from auth token
        user_email, hospital_name = get_user_from_request()
        if not user_email:
            return jsonify({"error": "Authentication required"}), 401
        
        # Prefer Supabase if available
        if app.supabase:
            try:
                # Build patient query - ensure it belongs to this user
                patient_query = app.supabase.table("patients").select("*")
                patient_query = patient_query.eq("id", patient_id)
                patient_query = patient_query.eq("userEmail", user_email)  # Filter by user
                patient_resp = patient_query.single().execute()

                # Build analysis query - only for this patient and user
                analysis_query = app.supabase.table("ecg_records").select("*")
                analysis_query = analysis_query.eq("patientId", patient_id)
                analysis_query = analysis_query.eq("userEmail", user_email)  # Filter by user
                analysis_query = analysis_query.order("analysisDate", desc=True)
                analyses_resp = analysis_query.execute()
                
                # Use data directly as fields match exactly
                patient_data = None
                if hasattr(patient_resp, "data") and patient_resp.data:
                    patient_data = {k: v for k, v in patient_resp.data.items() if v is not None}
                    if "existingConditions" in patient_data and not isinstance(patient_data["existingConditions"], list):
                        patient_data["existingConditions"] = []

                analyses_data = []
                if analyses_resp.data:
                    for a in analyses_resp.data:
                        analysis = {k: v for k, v in a.items() if v is not None}
                        if "recommendations" in analysis and not isinstance(analysis["recommendations"], list):
                            analysis["recommendations"] = []
                        if "biomarkers" in analysis and not isinstance(analysis["biomarkers"], (dict, list)):
                            analysis["biomarkers"] = {}
                        analyses_data.append(analysis)
                
                return jsonify({
                    "patient": patient_data,
                    "analyses": analyses_data,
                })
            except Exception as e:
                print(f"[WARN] Patient history query failed: {e}")
                pass
        
        # Fallback to in-memory (filtered by user)
        mem_patient = next((p for p in app.memory_patients if p.get("id") == patient_id and p.get("userEmail") == user_email), None)
        mem_analyses = [r for r in app.memory_records if r.get("patientId") == patient_id and r.get("userEmail") == user_email]
        mem_analyses.sort(key=lambda x: x.get("analysisDate", ""), reverse=True)
        return jsonify({"patient": mem_patient, "analyses": mem_analyses})

    @app.route("/api/analyze", methods=["POST"])
    def analyze():
        # Get user info from auth token
        user_email, hospital_name = get_user_from_request()
        if not user_email:
            return jsonify({"error": "Authentication required"}), 401
        
        # multipart/form-data expected: ecgImage (file), biomarkers (json), patientId, month
        if "ecgImage" not in request.files:
            return jsonify({"error": "ecgImage file is required"}), 400

        ecg_file = request.files["ecgImage"]
        filename = secure_filename(ecg_file.filename)
        file_bytes = np.frombuffer(ecg_file.read(), np.uint8)
        image_bgr = cv2.imdecode(file_bytes, cv2.IMREAD_COLOR)
        if image_bgr is None:
            return jsonify({"error": "Invalid image file"}), 400

        # Parse biomarkers JSON (string or field set)
        biomarkers_raw = request.form.get("biomarkers", "{}")
        try:
            biomarkers = json.loads(biomarkers_raw)
        except Exception:
            biomarkers = {}

        patient_id = request.form.get("patientId") or f"PAT{uuid.uuid4().hex[:8]}"
        month = int(request.form.get("month") or 1)

        # Preprocess ECG image
        cleaned = remove_ecg_grid(image_bgr)
        spectro_img = image_to_spectrogram(cleaned, (224, 224))

        # Derive a 1D ECG-like signal from the cleaned image for simple feature extraction
        try:
            gray_for_signal = cv2.cvtColor(cleaned, cv2.COLOR_BGR2GRAY)
            signal_1d = np.median(gray_for_signal, axis=0).astype(np.float32)
            # Normalize and smooth
            if signal_1d.std() > 0:
                signal_1d = (signal_1d - signal_1d.mean()) / (signal_1d.std() + 1e-8)
            # simple moving average smoothing
            window = 5
            kernel = np.ones(window) / window
            signal_smooth = np.convolve(signal_1d, kernel, mode='same')
            # Find peaks - treat the strip as ~10 seconds of ECG by convention
            peaks, props = find_peaks(signal_smooth, distance=20, prominence=0.5)
            peak_count = len(peaks)
            # Assume the uploaded strip represents ~10 seconds; BPM ~= peaks * 6
            heart_rate_est = int(np.clip(peak_count * 6, 30, 200)) if peak_count > 0 else None
            # RR variability (rough) from peak positions
            rr_intervals = np.diff(peaks) if peak_count > 1 else np.array([])
            rr_std = float(rr_intervals.std()) if rr_intervals.size > 0 else 0.0
            irregular = bool(rr_std > 10.0)
        except Exception:
            peaks = []
            peak_count = 0
            heart_rate_est = None
            rr_std = 0.0
            irregular = False

        # Prepare model inputs dynamically by inspecting model signature
        bio_vec = prepare_biomarker_vector(biomarkers)
        # Prepare transformed biomarker vector if preprocessors exist
        bio_vec_transformed = None
        preprocessors_used = []
        
        try:
            if getattr(app, 'preprocessors', None):
                vec_for_model = bio_vec.reshape(1, -1)
                
                # Apply imputer first if available
                imputer = app.preprocessors.get('imputer.joblib')
                if imputer is not None:
                    try:
                        vec_for_model = imputer.transform(vec_for_model)
                        preprocessors_used.append('imputer.joblib')
                    except Exception as e:
                        print(f"[WARN] Imputer failed: {e}")
                
                # Apply dynamic scaler if available
                scaler_dyn = app.preprocessors.get('scaler_dynamic.joblib')
                if scaler_dyn is not None:
                    try:
                        vec_for_model = scaler_dyn.transform(vec_for_model)
                        preprocessors_used.append('scaler_dynamic.joblib')
                    except Exception as e:
                        print(f"[WARN] Dynamic scaler failed: {e}")
                else:
                    # fallback: if scaler_static exists and shapes match
                    scaler_stat = app.preprocessors.get('scaler_static.joblib')
                    if scaler_stat is not None:
                        try:
                            if vec_for_model.shape[1] == (getattr(scaler_stat, 'scale_', None).shape[0] if hasattr(scaler_stat, 'scale_') else 0):
                                vec_for_model = scaler_stat.transform(vec_for_model)
                                preprocessors_used.append('scaler_static.joblib')
                        except Exception as e:
                            print(f"[WARN] Static scaler failed: {e}")
                # final biovec passed to model usage later
                bio_vec_transformed = vec_for_model.reshape(-1)
            else:
                bio_vec_transformed = bio_vec
        except Exception as e:
            print(f"[WARN] Preprocessor application failed: {e}")
            bio_vec_transformed = bio_vec
        # If model declares its image input shape, respect it
        img_h, img_w = 224, 224
        try:
            if getattr(app.model, "inputs", None):
                for tin in app.model.inputs:
                    shp = tuple(int(d) if d is not None else None for d in tin.shape)
                    if shp and len(shp) == 4 and shp[-1] in (1, 3):
                        if shp[1] and shp[2]:
                            img_h, img_w = int(shp[1]), int(shp[2])
                        break
        except Exception:
            pass
        # Rebuild spectrogram at desired size and normalize
        spectro_img = image_to_spectrogram(cleaned, (img_w, img_h))
        img_batch = np.expand_dims(spectro_img, axis=0).astype(np.float32)

        model_inputs = []
        bio_cursor = 0
        try:
            keras_inputs = getattr(app.model, "inputs", [])
        except Exception:
            keras_inputs = []

        if keras_inputs and isinstance(keras_inputs, (list, tuple)):
            for tin in keras_inputs:
                try:
                    shape = tuple(int(d) if d is not None else None for d in tin.shape)
                except Exception:
                    shape = None

                # Rank-4 input is assumed to be the image tensor
                if shape and len(shape) == 4:
                    model_inputs.append(img_batch)
                else:
                    # Vector-like branch: determine feature size
                    size = None
                    if shape and len(shape) >= 2:
                        size = shape[-1]
                    # Choose source vector (transformed if available)
                    source_vec = bio_vec_transformed if ('bio_vec_transformed' in locals() and bio_vec_transformed is not None) else bio_vec
                    if size is None or size <= 0:
                        # fallback to remaining length or full length
                        size = max(1, source_vec.shape[0] - bio_cursor)
                    vec = np.zeros((1, size), dtype=np.float32)
                    take = min(size, source_vec.shape[0] - bio_cursor)
                    if take > 0:
                        vec[0, :take] = source_vec[bio_cursor:bio_cursor + take]
                        bio_cursor += take
                    model_inputs.append(vec)

        # If signature was not readable, fall back to [image, vector]
        if not model_inputs:
            # prefer transformed if available
            bio_source = vec_for_model if ('vec_for_model' in locals() and vec_for_model is not None) else bio_vec.reshape(1, -1)
            model_inputs = [img_batch, bio_source.astype(np.float32)]

        # Model prediction (sigmoid/softmax/regression handling)
        try:
            # Log model input shapes and a small snapshot of biomarker vector for debugging
            try:
                inp_shapes = [mi.shape for mi in model_inputs]
            except Exception:
                inp_shapes = None
            try:
                bio_snapshot = (bio_vec_transformed if ('bio_vec_transformed' in locals() and bio_vec_transformed is not None) else bio_vec)[:8].tolist()
            except Exception:
                bio_snapshot = None
            print(f"[DEBUG] Model inputs shapes: {inp_shapes}, biomarker_snapshot: {bio_snapshot}")

            y_pred = app.model.predict(model_inputs, verbose=0)
            y = np.array(y_pred)
            
            # Properly handle different model output formats
            if y.ndim == 2 and y.shape[1] >= 2:
                # Multi-class output (Low, Medium, High)
                logits = y[0]
                # Always apply softmax
                exp_logits = np.exp(logits - logits.max())
                probs = exp_logits / (exp_logits.sum() + 1e-8)
                # For 3-class output (Low, Medium, High)
                if len(probs) == 3:
                    # Use weighted sum favoring lower risk when values are good
                    weights = [0.0, 0.5, 1.0]  # Low=0, Medium=0.5, High=1.0
                    pred_score = float(np.sum(probs * weights))
                else:
                    # For binary or other cases, use highest class probability
                    pred_score = float(probs[-1])
            else:
                # Binary/single output
                raw_score = float(y.reshape(-1)[0])
                # Always apply sigmoid to get proper probability
                pred_score = float(1 / (1 + np.exp(-raw_score)))
                # Fallback: normalize to 0..1
                val = float(y.reshape(-1)[0])
                pred_score = float(1 / (1 + np.exp(-val)))
        except Exception as e:
            print(f"[ERROR] Model inference failed: {e}")
            return jsonify({"error": f"Model inference failed: {e}"}), 500

        # Log prediction score before mapping to risk level
        print(f"[DEBUG] Raw model pred_score: {pred_score}, biomarkers used: {list(biomarkers.keys())}")
        
        # Enhanced risk calculation with BOTH boost and reduction
        # More balanced thresholds: High >= 0.55, Medium >= 0.25, Low < 0.25
        base_threshold_high = 0.55
        base_threshold_medium = 0.25
        
        # Initialize both boost (for high risk) and reduction (for low risk)
        biomarker_risk_boost = 0.0
        biomarker_risk_reduction = 0.0
        
        if biomarkers:
            # HIGH RISK indicators (increase score)
            chol = float(biomarkers.get('cholesterol', 0) or 0)
            if chol > 240:
                biomarker_risk_boost += 0.20
            elif chol > 200:
                biomarker_risk_boost += 0.10
            elif chol < 180:  # LOW RISK: optimal cholesterol
                biomarker_risk_reduction += 0.15
            
            # High BP
            sys_bp = float(biomarkers.get('systolicBp', 0) or 0)
            if sys_bp > 160:
                biomarker_risk_boost += 0.25
            elif sys_bp > 140:
                biomarker_risk_boost += 0.15
            elif sys_bp < 120:  # LOW RISK: optimal BP
                biomarker_risk_reduction += 0.20
            
            # Smoking
            if biomarkers.get('smokingStatus') == 'current':
                biomarker_risk_boost += 0.25
            elif biomarkers.get('smokingStatus') == 'never':  # LOW RISK
                biomarker_risk_reduction += 0.15
            
            # Diabetes
            if biomarkers.get('diabetes') in ['type1', 'type2']:
                biomarker_risk_boost += 0.20
            elif biomarkers.get('diabetes') == 'no':  # LOW RISK
                biomarker_risk_reduction += 0.15
            
            # High BMI
            bmi_val = float(biomarkers.get('bmi', 0) or 0)
            if bmi_val > 35:
                biomarker_risk_boost += 0.20
            elif bmi_val > 30:
                biomarker_risk_boost += 0.15
            elif 18.5 <= bmi_val <= 24.9:  # LOW RISK: normal BMI
                biomarker_risk_reduction += 0.15
            
            # LDL Cholesterol
            ldl = float(biomarkers.get('ldl', 0) or 0)
            if ldl > 160:
                biomarker_risk_boost += 0.15
            elif ldl < 100:  # LOW RISK: optimal LDL
                biomarker_risk_reduction += 0.15
            
            # HDL Cholesterol (higher is better)
            hdl = float(biomarkers.get('hdl', 0) or 0)
            if hdl < 40:
                biomarker_risk_boost += 0.10
            elif hdl >= 60:  # LOW RISK: excellent HDL
                biomarker_risk_reduction += 0.15
            
            # HbA1c (diabetes marker)
            hba1c = float(biomarkers.get('hba1c', 0) or 0)
            if hba1c > 7.0:
                biomarker_risk_boost += 0.15
            elif hba1c < 5.7 and hba1c > 0:  # LOW RISK: normal HbA1c
                biomarker_risk_reduction += 0.15
            
            # Family history
            if biomarkers.get('familyHistory') == 'yes':
                biomarker_risk_boost += 0.10
            elif biomarkers.get('familyHistory') == 'no':  # LOW RISK
                biomarker_risk_reduction += 0.10
            
            # Physical activity (more is better - reduces risk)
            phys_act = float(biomarkers.get('physicalActivity', 0) or 0)
            if phys_act >= 5:  # LOW RISK: active lifestyle
                biomarker_risk_reduction += 0.15
            elif phys_act < 1:
                biomarker_risk_boost += 0.10
            
            # Sleep (optimal is 7-8 hours)
            sleep = float(biomarkers.get('sleepHours', 0) or 0)
            if 7 <= sleep <= 8:  # LOW RISK: optimal sleep
                biomarker_risk_reduction += 0.10
            elif sleep < 6:
                biomarker_risk_boost += 0.10
        
        # Apply adjustments: REDUCE first, then boost (to prevent over-correction)
        adjusted_score = pred_score
        
        # Apply reduction first (more aggressive for low risk)
        if biomarker_risk_reduction > 0:
            adjusted_score = max(0.0, adjusted_score - biomarker_risk_reduction * 0.7)
        
        # Then apply boost (less aggressive to prevent over-inflation)
        if biomarker_risk_boost > 0:
            adjusted_score = min(1.0, adjusted_score + biomarker_risk_boost * 0.5)
        
        # Ensure adjusted score stays in valid range
        adjusted_score = np.clip(adjusted_score, 0.0, 1.0)
        
        # Recalculate risk level with adjusted score using balanced thresholds
        if adjusted_score >= base_threshold_high:
            risk_level = "High"
        elif adjusted_score >= base_threshold_medium:
            risk_level = "Medium"
        else:
            risk_level = "Low"
        
        # Map adjusted_score (0-1) to risk_score (0-100) with better distribution
        risk_score = int(np.clip(round(adjusted_score * 100), 0, 100))
        
        recommendations = generate_recommendations(adjusted_score)
        print(f"[DEBUG] Final risk_level: {risk_level}, risk_score: {risk_score}, adjusted_score: {adjusted_score:.3f}, base_pred: {pred_score:.3f}, boost: {biomarker_risk_boost:.3f}, reduction: {biomarker_risk_reduction:.3f}")

        # If the prediction is extreme/degenerate (exact 0 or 1 or NaN), try alternative models
        try:
            use_alternative = False
            if not np.isfinite(pred_score) or pred_score <= 0.001 or pred_score >= 0.999:
                use_alternative = True
            if use_alternative and getattr(app, 'other_models', None):
                for name, alt_model in app.other_models.items():
                    if alt_model is app.model:
                        continue
                    try:
                        # First try same inputs
                        alt_pred = alt_model.predict(model_inputs)
                        alt_y = np.array(alt_pred)
                        alt_score = None
                        if alt_y.ndim == 2 and alt_y.shape[1] == 2:
                            probs = alt_y[0]
                            if not np.isclose(probs.sum(), 1.0, atol=1e-3):
                                ex = np.exp(probs - probs.max())
                                probs = ex / (ex.sum() + 1e-8)
                            alt_score = float(probs[1])
                        elif alt_y.ndim >= 2 and alt_y.shape[-1] == 1:
                            alt_score = float(alt_y.reshape(-1)[0])
                            if alt_score < 0 or alt_score > 1:
                                alt_score = float(1 / (1 + np.exp(-alt_score)))
                        else:
                            val = float(alt_y.reshape(-1)[0])
                            alt_score = float(1 / (1 + np.exp(-val)))
                        print(f"[INFO] Alternative model {name} produced score {alt_score}")
                        if np.isfinite(alt_score) and 0.001 < alt_score < 0.999:
                            pred_score = alt_score
                            risk_level = "High" if pred_score >= 0.7 else ("Medium" if pred_score >= 0.4 else "Low")
                            raw_score = pred_score * 100.0
                            risk_score = int(np.clip(round(raw_score), 1 if 0 < raw_score < 50 else 0, 99 if 50 < raw_score < 100 else 100))
                            print(f"[INFO] Switched to alternative model {name}, mapped risk_level: {risk_level}, risk_score: {risk_score}")
                            break
                    except Exception as e:
                        # Try alternative input shapes: biomarker-only or image-only
                        try:
                            bio_source = (bio_vec_transformed if bio_vec_transformed is not None else bio_vec).reshape(1, -1).astype(np.float32)
                            alt_pred = alt_model.predict(bio_source)
                            alt_y = np.array(alt_pred)
                            alt_score = float(alt_y.reshape(-1)[0])
                            if alt_score < 0 or alt_score > 1:
                                alt_score = float(1 / (1 + np.exp(-alt_score)))
                            print(f"[INFO] Alternative model {name} (bio_only) produced score {alt_score}")
                            if np.isfinite(alt_score) and 0.001 < alt_score < 0.999:
                                pred_score = alt_score
                                risk_level = "High" if pred_score >= 0.7 else ("Medium" if pred_score >= 0.4 else "Low")
                                raw_score = pred_score * 100.0
                                risk_score = int(np.clip(round(raw_score), 1 if 0 < raw_score < 50 else 0, 99 if 50 < raw_score < 100 else 100))
                                print(f"[INFO] Switched to alternative model {name} using biomarker-only input, mapped risk_level: {risk_level}, risk_score: {risk_score}")
                                break
                        except Exception:
                            pass
        except Exception as e:
            print(f"[WARN] Alternative model attempt failed: {e}")

        # Generate ECG findings summary heuristically (server-side)
        ecg_findings = []
        if heart_rate_est is not None:
            if heart_rate_est > 100:
                ecg_findings.append('Tachycardia detected')
            elif heart_rate_est < 60:
                ecg_findings.append('Bradycardia detected')
            else:
                ecg_findings.append('Heart rate within normal range')
        if irregular:
            ecg_findings.append('Irregular rhythm suggested (variation in RR intervals)')

        # Create record using exact DB field names
        record = {
            "id": f"ANA{int(datetime.utcnow().timestamp()*1000)}",
            "patientId": patient_id,
            "userEmail": user_email,  # ADD THIS
            "hospitalName": hospital_name,  # ADD THIS
            "monthNumber": month,
            "biomarkers": biomarkers,
            "riskScore": risk_score,
            "riskLevel": risk_level,
            "recommendations": recommendations,
            "analysisDate": datetime.utcnow().isoformat(),
            "ecgFileName": filename
        }

        # Keep this version in memory
        try:
            app.memory_records.append(record)
        except Exception:
            pass

        db_saved = False
        db_error = None
        if app.supabase:
            try:
                # Try upsert to avoid duplicate (patientId, monthNumber) unique constraint
                try:
                    _ = app.supabase.table("ecg_records").upsert(record).execute()
                    db_saved = True
                except Exception:
                    # Fallback: attempt insert and if duplicate key error occurs, try update
                    try:
                        _ = app.supabase.table("ecg_records").insert(record).execute()
                        db_saved = True
                    except Exception as inner_e:
                        msg = str(inner_e)
                        # If duplicate key violation, perform update by patientId + monthNumber
                        if 'duplicate key' in msg or 'uq_ecg_records_patient_month' in msg:
                            try:
                                # find existing record id
                                q = app.supabase.table('ecg_records').select('id').eq('patientId', record['patientId']).eq('monthNumber', record['monthNumber']).limit(1).execute()
                                existing = getattr(q, 'data', None) or []
                                if existing:
                                    existing_id = existing[0].get('id')
                                    # merge id into record and update
                                    record_to_update = record.copy()
                                    record_to_update['id'] = existing_id
                                    _ = app.supabase.table('ecg_records').update(record_to_update).eq('id', existing_id).execute()
                                    db_saved = True
                                else:
                                    db_error = msg
                            except Exception as upd_e:
                                db_error = str(upd_e)
                        else:
                            db_error = msg
            except Exception as e:
                db_error = str(e)

        return jsonify({
            "prediction": {
                "riskScore": risk_score,
                "riskLevel": risk_level,
                "score": pred_score,
                "model": MODEL_FILENAME,
                "preprocessors_used": preprocessors_used
            },
            "recommendations": recommendations,
            "record": record,
            "db": {"saved": db_saved, "error": db_error}
        })

    # Debug endpoint: predict using biomarkers only (no image required)
    @app.route("/api/predict_biomarkers", methods=["POST"])
    def predict_biomarkers():
        data = request.get_json(force=True) or {}
        biomarkers = data.get("biomarkers") or data

        # Build biomarker vector
        try:
            bio_vec = prepare_biomarker_vector(biomarkers)
        except Exception as e:
            return jsonify({"error": f"Failed to prepare biomarker vector: {e}"}), 400

        # Apply preprocessors if available (shape-aware)
        bio_source = bio_vec
        preprocessors_loaded = []
        try:
            pps = getattr(app, 'preprocessors', None) or {}
            if pps:
                vec = bio_vec.reshape(1, -1)
                preprocessors_loaded = list(pps.keys())
                # apply in order if present: imputer, scaler_dynamic, scaler_static
                for pname in ('imputer.joblib','scaler_dynamic.joblib','scaler_static.joblib'):
                    pre = pps.get(pname)
                    if pre is None:
                        continue
                    try:
                        # expected number of input features for this preprocessor
                        n_in = getattr(pre, 'n_features_in_', None)
                        fnames = getattr(pre, 'feature_names_in_', None)
                        if n_in is not None and int(n_in) != vec.shape[1]:
                            # Try to align by feature names if available, otherwise pad/truncate
                            try:
                                if fnames is not None and hasattr(fnames, '__len__') and len(fnames) > 0:
                                    target = np.zeros((1, int(n_in)), dtype=vec.dtype)
                                    biomarker_names = getattr(app, 'biomarker_feature_names', None) or []
                                    # map available biomarker indices into the target where names match
                                    for i, name in enumerate(biomarker_names):
                                        if i < vec.shape[1] and name in list(fnames):
                                            j = list(fnames).index(name)
                                            target[0, j] = vec[0, i]
                                    vec = pre.transform(target)
                                else:
                                    # pad or truncate to expected size
                                    target = np.zeros((1, int(n_in)), dtype=vec.dtype)
                                    target[0, :min(vec.shape[1], int(n_in))] = vec[0, :min(vec.shape[1], int(n_in))]
                                    vec = pre.transform(target)
                            except Exception:
                                # fallback: pad/truncate
                                target = np.zeros((1, int(n_in)), dtype=vec.dtype)
                                target[0, :min(vec.shape[1], int(n_in))] = vec[0, :min(vec.shape[1], int(n_in))]
                                vec = pre.transform(target)
                        else:
                            vec = pre.transform(vec)
                    except Exception:
                        # on any transform failure, skip this preprocessor
                        pass
                bio_source = vec.reshape(-1)
        except Exception as e:
            print(f"[WARN] preprocessors failed in predict_biomarkers: {e}")

        # Diagnostics to return
        preprocessors_loaded = list(app.preprocessors.keys()) if getattr(app, 'preprocessors', None) else []
        bio_raw_list = bio_vec.tolist() if hasattr(bio_vec, 'tolist') else []
        bio_transformed_list = bio_source.tolist() if hasattr(bio_source, 'tolist') else None

        # Try models in order: hybrid -> primary -> biomarker-only -> others
        result = {"attempts": []}
        try_models = []
        if getattr(app, 'other_models', None) and 'hybrid_model.h5' in app.other_models:
            try_models.append(('hybrid_model.h5', app.other_models['hybrid_model.h5']))
        try_models.append(('primary', app.model))
        if getattr(app, 'other_models', None) and 'biomarker_only_model.h5' in app.other_models:
            try_models.append(('biomarker_only_model.h5', app.other_models['biomarker_only_model.h5']))
        if getattr(app, 'other_models', None):
            for k, m in app.other_models.items():
                if k not in ('hybrid_model.h5', 'biomarker_only_model.h5'):
                    try_models.append((k, m))

        pred_score = None
        used_model = None
        for name, m in try_models:
            info = {"model": name}
            info['bio_raw'] = bio_raw_list
            info['bio_transformed'] = bio_transformed_list
            try:
                inputs = []
                try:
                    m_inputs = getattr(m, 'inputs', [])
                except Exception:
                    m_inputs = []

                if m_inputs and isinstance(m_inputs, (list, tuple)):
                    bio_cursor = 0
                    for tin in m_inputs:
                        try:
                            shp = tuple(int(d) if d is not None else None for d in tin.shape)
                        except Exception:
                            shp = None
                        if shp and len(shp) == 4:
                            h = shp[1] or 224
                            w = shp[2] or 224
                            c = shp[3] or 3
                            inputs.append(np.zeros((1, h, w, c), dtype=np.float32))
                        else:
                            size = shp[-1] if (shp and len(shp) >= 2 and shp[-1]) else bio_source.shape[0]
                            vec = np.zeros((1, int(size)), dtype=np.float32)
                            take = min(int(size), bio_source.shape[0] - bio_cursor)
                            if take > 0:
                                vec[0, :take] = bio_source[bio_cursor:bio_cursor + take]
                                bio_cursor += take
                            inputs.append(vec)
                else:
                    inputs = [np.expand_dims(bio_source, axis=0).astype(np.float32)]

                info['input_shapes'] = [list(inp.shape) for inp in inputs]
                y = m.predict(inputs)
                y = np.array(y)
                score = None
                if y.ndim == 2 and y.shape[1] == 2:
                    probs = y[0]
                    if not np.isclose(probs.sum(), 1.0, atol=1e-3):
                        ex = np.exp(probs - probs.max())
                        probs = ex / (ex.sum() + 1e-8)
                    score = float(probs[1])
                elif y.ndim >= 2 and y.shape[-1] == 1:
                    score = float(y.reshape(-1)[0])
                    if score < 0 or score > 1:
                        score = float(1 / (1 + np.exp(-score)))
                else:
                    val = float(y.reshape(-1)[0])
                    score = float(1 / (1 + np.exp(-val)))

                info['score'] = score
                result['attempts'].append(info)
                if score is not None and np.isfinite(score):
                    pred_score = float(score)
                    used_model = name
                    break
            except Exception as e:
                info['error'] = str(e)
                result['attempts'].append(info)
                continue

        if pred_score is None:
            return jsonify({"error": "No model produced a finite prediction", "details": result}), 500

        # Apply same enhanced biomarker adjustments as main predict endpoint
        biomarker_risk_boost = 0.0
        biomarker_risk_reduction = 0.0
        
        # Extract biomarkers from request if available
        biomarkers = data.get("biomarkers") or data
        
        if biomarkers:
            chol = float(biomarkers.get('cholesterol', 0) or 0)
            if chol > 240:
                biomarker_risk_boost += 0.20
            elif chol < 180:
                biomarker_risk_reduction += 0.15
            
            sys_bp = float(biomarkers.get('systolicBp', 0) or 0)
            if sys_bp > 160:
                biomarker_risk_boost += 0.25
            elif sys_bp > 140:
                biomarker_risk_boost += 0.15
            elif sys_bp < 120:
                biomarker_risk_reduction += 0.20
            
            if biomarkers.get('smokingStatus') == 'current':
                biomarker_risk_boost += 0.25
            elif biomarkers.get('smokingStatus') == 'never':
                biomarker_risk_reduction += 0.15
            
            if biomarkers.get('diabetes') in ['type1', 'type2']:
                biomarker_risk_boost += 0.20
            elif biomarkers.get('diabetes') == 'no':
                biomarker_risk_reduction += 0.15
            
            bmi_val = float(biomarkers.get('bmi', 0) or 0)
            if bmi_val > 35:
                biomarker_risk_boost += 0.20
            elif bmi_val > 30:
                biomarker_risk_boost += 0.15
            elif 18.5 <= bmi_val <= 24.9:
                biomarker_risk_reduction += 0.15
            
            ldl = float(biomarkers.get('ldl', 0) or 0)
            if ldl > 160:
                biomarker_risk_boost += 0.15
            elif ldl < 100:
                biomarker_risk_reduction += 0.15
            
            hdl = float(biomarkers.get('hdl', 0) or 0)
            if hdl < 40:
                biomarker_risk_boost += 0.10
            elif hdl >= 60:
                biomarker_risk_reduction += 0.15
        
        # Apply adjustments: reduce first, then boost
        adjusted_score = pred_score
        if biomarker_risk_reduction > 0:
            adjusted_score = max(0.0, adjusted_score - biomarker_risk_reduction * 0.7)
        if biomarker_risk_boost > 0:
            adjusted_score = min(1.0, adjusted_score + biomarker_risk_boost * 0.5)
        adjusted_score = np.clip(adjusted_score, 0.0, 1.0)
        
        # Use balanced thresholds: High >= 0.55, Medium >= 0.25, Low < 0.25
        risk_level = "High" if adjusted_score >= 0.55 else ("Medium" if adjusted_score >= 0.25 else "Low")
        raw_score = adjusted_score * 100.0
        risk_score = int(np.clip(round(raw_score), 0, 100))

        return jsonify({
            "model": used_model,
            "score": adjusted_score,  # Return adjusted score, not raw pred_score
            "riskLevel": risk_level,
            "riskScore": risk_score,
            "preprocessors_loaded": preprocessors_loaded,
            "bio_raw": bio_raw_list,
            "bio_transformed": bio_transformed_list,
            "attempts": result['attempts']
        })

    return app


if __name__ == "__main__":
    app = create_app()
    app.run(host="0.0.0.0", port=BACKEND_PORT, debug=True)


