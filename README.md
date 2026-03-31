# ❤️ CHRONOCardio-AI  
### Intelligent Cardiovascular Risk Prediction using Hybrid AI  

🚀 Achieved **95.5% accuracy** using a hybrid AI model combining ECG signals and temporal biomarker data — outperforming traditional approaches.

---

## 📸 Project Screenshots

### 🏥 Dashboard
<p align="center">
  <img src="images/Dashboard.png" width="850"/>
</p>

---

### 🧪 Patient Risk Analysis
<p align="center">
  <img src="images/PatientAnalysis01.png" width="400"/>
  <img src="images/PatientAnalysis02.png" width="400"/>
</p>

<p align="center">
  <img src="images/PatientAnalysis03.png" width="400"/>
</p>

---

### 📄 Patient History & Reports
<p align="center">
  <img src="images/PatientHistory_Reports.png" width="750"/>
</p>

---

### 📝 Patient Report
<p align="center">
  <img src="images/PatientReport.png" width="500"/>
</p>

---

### 📝 Patient Registration
<p align="center">
  <img src="images/PatientRegistration.png" width="500"/>
</p>

---

## 🌟 Overview

**CHRONOCardio-AI** is a full-stack healthcare platform that predicts cardiovascular risk using **machine learning and patient history over time**.

- 📈 Tracks biomarker trends over time  
- 🫀 Analyzes ECG signals  
- 🤖 Uses a hybrid deep learning model  

👉 Provides **accurate, real-world risk prediction for early intervention**

---

## 💡 Key Innovation

- ⏳ **Temporal Biomarker Weighting (TABW)** → Prioritizes recent health data  
- 🔀 **Hybrid Model (LSTM + CNN + XGBoost)** → Combines time-series + ECG  
- 🧠 **Explainable AI (LIME)** → Interpretable predictions  
- 📋 **Clinical Recommendation Engine** → Actionable insights  

---

## 🧠 Machine Learning Architecture

### 🔹 LSTM (Long Short-Term Memory)
- Used for **time-series biomarker data**
- Captures how patient health **changes over time**
- Learns patterns like rising cholesterol or BP trends
- Helps in **early risk detection based on history**

---

### 🔹 CNN - MobileNetV2 (ECG Analysis)
- Used for **ECG signal processing**
- ECG signals are converted into **spectrogram images**
- MobileNetV2 extracts important **cardiac patterns**
- Lightweight and efficient → suitable for real-time systems

---

### 🔹 Fusion Layer
- Combines outputs from **LSTM (biomarkers)** and **CNN (ECG)**
- Produces final **risk prediction (Low / Medium / High)**

---

## 📊 Model Performance

| Model | Accuracy |
|------|--------|
| XGBoost | 90.9% |
| Biomarker DL | 92.0% |
| ECG Only | 36.0% |
| ✅ Hybrid Model | **95.5%** |

---

## 🛠️ Tech Stack

**Frontend:** React, TypeScript, Tailwind CSS  
**Backend:** Flask, Supabase (PostgreSQL)  
**Machine Learning:** TensorFlow, XGBoost, Scikit-learn  

---

## 👩‍💻 My Contribution

- Developed **full-stack application (React + Flask)**  
- Built **hybrid ML model (LSTM + CNN + XGBoost)**  
- Implemented **Temporal Biomarker Weighting (TABW)**  
- Designed **interactive dashboards & visualizations**  
- Integrated **Explainable AI (LIME)**  

---

## 🚀 Run Locally

```bash
# Frontend
cd frontend
npm install
npm run dev

# Backend (optional)
cd backend
pip install -r requirements.txt
python app.py