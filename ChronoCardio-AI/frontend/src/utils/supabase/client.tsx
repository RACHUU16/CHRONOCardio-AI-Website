import { createClient } from '@supabase/supabase-js';
import { projectId, publicAnonKey } from './info';

const supabaseUrl = `https://${projectId}.supabase.co`;

export const supabase = createClient(supabaseUrl, publicAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce'
  }
});

// Safe backend URL access to avoid import.meta typing issues in some TS toolchains
const BACKEND_URL = (typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.VITE_BACKEND_URL) ? (import.meta as any).env.VITE_BACKEND_URL : 'http://127.0.0.1:5000';

// Remove demo mode and in-memory data; rely on backend + Supabase
let demoSession: any = null;
let demoPatients: any[] = [];
let demoAnalyses: any[] = [];

// Helper function to get authenticated headers
export const getAuthHeaders = async () => {
  // Check for demo session first
  if (demoSession?.access_token) {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${demoSession.access_token}`
    };
  }

  // Otherwise get real Supabase session
  const { data: { session } } = await supabase.auth.getSession();
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session?.access_token || publicAnonKey}`
  };
};

// Helper to set demo session
export const setDemoSession = (session: any) => {
  demoSession = session;
  // Initialize demo data when demo session is set
  if (demoPatients.length === 0) {
    initializeDemoData();
  }
};

// Helper to clear demo session
export const clearDemoSession = () => {
  demoSession = null;
  demoPatients = [];
  demoAnalyses = [];
};

// Disable demo initialization (sample data removal)
const initializeDemoData = () => {
  demoPatients = [];
  demoAnalyses = [];
};

// Generate biomarkers based on risk profile with realistic progression over time
const generateBiomarkersByRisk = (riskProfile: string, monthIndex: number, baseRiskProfile: string = 'Medium') => {
  // Add temporal variation - values may improve or worsen slightly over time
  const timeVariation = (monthIndex * 0.02) + (Math.random() - 0.5) * 0.1; // Small changes over time
  
  const baseValues = {
    Low: {
      systolicBP: 115 + Math.random() * 10 + (timeVariation * 5),
      diastolicBP: 70 + Math.random() * 10 + (timeVariation * 3),
      totalCholesterol: 170 + Math.random() * 30 + (timeVariation * 10),
      ldl: 90 + Math.random() * 20 + (timeVariation * 8),
      hdl: 50 + Math.random() * 15 - (timeVariation * 3),
      hba1c: 5.0 + Math.random() * 0.5 + (timeVariation * 0.2),
      bmi: 22 + Math.random() * 3 + (timeVariation * 1),
      hsCRP: 0.5 + Math.random() * 1.0 + (timeVariation * 0.3),
      heartRate: 65 + Math.random() * 10 + (timeVariation * 5)
    },
    Medium: {
      systolicBP: 130 + Math.random() * 15 + (timeVariation * 8),
      diastolicBP: 80 + Math.random() * 10 + (timeVariation * 5),
      totalCholesterol: 200 + Math.random() * 40 + (timeVariation * 15),
      ldl: 120 + Math.random() * 30 + (timeVariation * 12),
      hdl: 40 + Math.random() * 10 - (timeVariation * 2),
      hba1c: 5.8 + Math.random() * 0.8 + (timeVariation * 0.3),
      bmi: 26 + Math.random() * 4 + (timeVariation * 1.5),
      hsCRP: 2.0 + Math.random() * 1.5 + (timeVariation * 0.5),
      heartRate: 72 + Math.random() * 15 + (timeVariation * 8)
    },
    High: {
      systolicBP: 150 + Math.random() * 20 + (timeVariation * 10),
      diastolicBP: 95 + Math.random() * 15 + (timeVariation * 8),
      totalCholesterol: 240 + Math.random() * 60 + (timeVariation * 20),
      ldl: 160 + Math.random() * 40 + (timeVariation * 15),
      hdl: 35 + Math.random() * 10 - (timeVariation * 5),
      hba1c: 7.0 + Math.random() * 1.5 + (timeVariation * 0.5),
      bmi: 30 + Math.random() * 8 + (timeVariation * 2),
      hsCRP: 3.5 + Math.random() * 2.0 + (timeVariation * 0.8),
      heartRate: 85 + Math.random() * 20 + (timeVariation * 12)
    }
  };

  const values = baseValues[riskProfile] || baseValues.Medium;
  
  // Generate lifestyle factors with some consistency over time
  const isOlderData = monthIndex > 6;
  const smokingStatus = riskProfile === 'High' ? 
    (isOlderData && Math.random() > 0.7 ? 'Current smoker' : 'Former smoker') :
    Math.random() > 0.8 ? 'Former smoker' : 'Non-smoker';
  
  const physicalActivity = riskProfile === 'Low' ? 
    (isOlderData && Math.random() > 0.8 ? 'Moderate' : 'Active') :
    riskProfile === 'Medium' ? 
      (Math.random() > 0.5 ? 'Moderate' : Math.random() > 0.5 ? 'Active' : 'Low') :
      (isOlderData && Math.random() > 0.7 ? 'Low' : 'Sedentary');
  
  return {
    systolicBP: Math.max(90, Math.round(values.systolicBP)),
    diastolicBP: Math.max(60, Math.round(values.diastolicBP)),
    totalCholesterol: Math.max(120, Math.round(values.totalCholesterol)),
    ldl: Math.max(50, Math.round(values.ldl)),
    hdl: Math.max(25, Math.round(values.hdl)),
    hba1c: Math.max(4.0, Math.round(values.hba1c * 10) / 10),
    bmi: Math.max(18, Math.round(values.bmi * 10) / 10),
    hsCRP: Math.max(0.1, Math.round(values.hsCRP * 10) / 10),
    heartRate: Math.max(50, Math.min(120, Math.round(values.heartRate))),
    sleepHours: Math.round((6 + Math.random() * 3) * 10) / 10,
    smokingStatus,
    physicalActivity,
    diabetesStatus: riskProfile === 'High' ? 
      (Math.random() > 0.3 ? 'Type 2' : 'Pre-diabetic') :
      riskProfile === 'Medium' ? 
        (Math.random() > 0.6 ? 'Pre-diabetic' : 'Normal') : 'Normal',
    familyHistory: Math.random() > 0.5 ? 'Yes' : 'No',
    rhythm: riskProfile === 'High' ? 
      (Math.random() > 0.4 ? 'Irregular' : 'Normal sinus rhythm') : 'Normal sinus rhythm'
  };
};

// Generate clinical notes based on analysis
const generateClinicalNotes = (riskLevel: string, monthIndex: number, riskProfile: string) => {
  const notes = {
    Low: [
      'Patient shows excellent cardiovascular health with all biomarkers within optimal ranges.',
      'Continued adherence to healthy lifestyle practices evident.',
      'Regular exercise routine and balanced diet maintaining good health outcomes.',
      'No immediate cardiovascular concerns identified in current assessment.'
    ],
    Medium: [
      'Patient presents with moderate cardiovascular risk factors requiring monitoring.',
      'Some biomarkers elevated but manageable with lifestyle interventions.',
      'Recommend continued follow-up and potential medication adjustments.',
      'Patient showing good compliance with treatment recommendations.'
    ],
    High: [
      'Patient exhibits multiple cardiovascular risk factors requiring immediate attention.',
      'Significant biomarker abnormalities noted, intensive management indicated.',
      'Close monitoring and aggressive treatment modifications recommended.',
      'Patient requires comprehensive cardiovascular risk reduction strategy.'
    ]
  };
  
  const baseNotes = notes[riskLevel] || notes.Medium;
  const randomNote = baseNotes[Math.floor(Math.random() * baseNotes.length)];
  
  // Add time-specific context
  if (monthIndex === 0) {
    return `Current Assessment: ${randomNote}`;
  } else if (monthIndex < 3) {
    return `Recent Analysis (${monthIndex + 1} month${monthIndex > 0 ? 's' : ''} ago): ${randomNote}`;
  } else {
    return `Historical Data (${monthIndex + 1} months ago): ${randomNote}`;
  }
};

// Calculate risk score based on biomarkers
const calculateRiskScore = (biomarkers: any) => {
  let riskScore = 0;
  
  if (biomarkers.systolicBP > 140) riskScore += 20;
  if (biomarkers.diastolicBP > 90) riskScore += 15;
  if (biomarkers.totalCholesterol > 240) riskScore += 15;
  if (biomarkers.ldl > 160) riskScore += 15;
  if (biomarkers.hdl < 40) riskScore += 10;
  if (biomarkers.hba1c > 6.5) riskScore += 15;
  if (biomarkers.bmi > 30) riskScore += 10;
  if (biomarkers.smokingStatus === 'Current smoker') riskScore += 20;
  if (biomarkers.familyHistory === 'Yes') riskScore += 10;
  if (biomarkers.physicalActivity === 'Sedentary') riskScore += 10;
  
  return Math.min(riskScore, 100);
};

// Get risk level from score
const getRiskLevel = (score: number) => {
  if (score > 70) return 'High';
  if (score > 40) return 'Medium';
  return 'Low';
};

// Generate ECG findings based on risk level
export const generateECGFindings = (riskLevel: string) => {
  const findings = {
    Low: [
      'Normal sinus rhythm detected',
      'Heart rate within normal range',
      'No significant abnormalities detected',
      'Regular P-wave morphology'
    ],
    Medium: [
      'Normal sinus rhythm detected',
      'Heart rate slightly elevated',
      'Minor ST-segment depression noted',
      'No significant arrhythmias detected'
    ],
    High: [
      'Sinus rhythm with irregular intervals',
      'Tachycardia detected',
      'Significant ST-segment changes',
      'Occasional premature beats detected'
    ]
  };
  
  return findings[riskLevel] || findings.Medium;
};

// Generate recommendations based on risk level
const generateRecommendations = (riskLevel: string) => {
  const recommendations = {
    Low: [
      'Continue current lifestyle and medication regimen',
      'Maintain regular exercise routine',
      'Follow-up in 6 months',
      'Continue dietary modifications'
    ],
    Medium: [
      'Increase physical activity to 150 minutes per week',
      'Consider medication adjustment',
      'Follow-up in 3 months',
      'Dietary consultation recommended'
    ],
    High: [
      'Immediate medical intervention required',
      'Start intensive medication therapy',
      'Follow-up in 4-6 weeks',
      'Consider specialist referral'
    ]
  };
  
  return recommendations[riskLevel] || recommendations.Medium;
};

// API helper functions with fallback to demo data
export const api = {
  // Authentication
  signup: async (email: string, password: string, hospitalName: string, location: string, phone?: string) => {
    // For demo purposes, always return success for non-demo emails
    if (email !== 'demo@hospital.com') {
      try {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              hospitalName,
              location,
              phone: phone || '',
              patientId: `PID${Date.now()}`
            },
            emailRedirectTo: window.location.origin
          }
        });
        
        if (error) {
          console.error('Supabase signup error:', error);
          return { error: error.message || 'Registration failed. Please check your email settings.' };
        }
        
        // If user is created but needs email confirmation, that's still success
        if (data.user) {
          return { 
            user: data.user, 
            needsEmailConfirmation: !data.session // No session means email confirmation needed
          };
        }
        
        return { error: 'Registration failed: No user data returned' };
      } catch (error: any) {
        console.error('Registration exception:', error);
        return { error: error?.message || 'Registration failed. Please try again.' };
      }
    }
    
    return { error: 'Demo account cannot be registered' };
  },

  signin: async (email: string, password: string) => {
    // Handle demo login
    if (email === 'demo@hospital.com' && password === 'demo123') {
      const demoUser = {
        id: 'demo-user-123',
        email: 'demo@hospital.com',
        user_metadata: {
          hospitalName: 'Demo General Hospital',
          location: 'Mumbai, Maharashtra',
          patientId: 'DEMO001'
        }
      };
      
      const demoSessionData = {
        access_token: 'demo-token-123',
        refresh_token: 'demo-refresh-123'
      };

      const userData = {
        hospitalName: 'Demo General Hospital',
        location: 'Mumbai, Maharashtra',
        email: 'demo@hospital.com',
        patientId: 'DEMO001',
        createdAt: new Date().toISOString()
      };

      return { 
        user: demoUser, 
        session: demoSessionData,
        userData: userData 
      };
    }
    
    // Handle real authentication
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      
      if (error) return { error: error.message };
      
      const userData = {
        hospitalName: data.user.user_metadata?.hospitalName || 'Hospital',
        location: data.user.user_metadata?.location || 'Location',
        phone: data.user.user_metadata?.phone || '',
        email: data.user.email || '',
        patientId: data.user.user_metadata?.patientId || `PID${Date.now()}`,
        createdAt: new Date().toISOString()
      };
      
      return { 
        user: data.user, 
        session: data.session,
        userData 
      };
    } catch (error) {
      return { error: 'Sign in failed' };
    }
  },

  resetPassword: async (email: string) => {
    // Handle demo account
    if (email === 'demo@hospital.com') {
      return { error: 'Password reset is not available for demo account' };
    }
    
    try {
      // Use window.location.origin which will automatically use the correct port
      const redirectUrl = `${window.location.origin}/reset-password`;
      
      console.log('=== PASSWORD RESET REQUEST ===');
      console.log('Email:', email);
      console.log('Current origin:', window.location.origin);
      console.log('Redirect URL:', redirectUrl);
      
      const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl
      });
      
      if (error) {
        console.error('Reset password error:', error);
        return { error: error.message || 'Failed to send password reset email' };
      }
      
      console.log('✅ Password reset email sent successfully');
      return { 
        success: true, 
        message: 'Password reset email sent. Please check your inbox and click the link within 1 hour.' 
      };
    } catch (error: any) {
      console.error('Reset password exception:', error);
      return { error: error?.message || 'Failed to send password reset email' };
    }
  },

  updatePassword: async (newPassword: string) => {
    try {
      const { data, error } = await supabase.auth.updateUser({
        password: newPassword
      });
      
      if (error) {
        return { error: error.message || 'Failed to update password' };
      }
      
      return { success: true, message: 'Password updated successfully' };
    } catch (error: any) {
      return { error: error?.message || 'Failed to update password' };
    }
  },

  // Patients -> forward to Flask backend
  createPatient: async (patientData: any) => {
    try {
      const headers = await getAuthHeaders();
  const resp = await fetch(`${BACKEND_URL}/api/patients`, {
        method: 'POST',
        headers,
        body: JSON.stringify(patientData)
      });
      const json = await resp.json();
      return json;
    } catch (error) {
      return { error: 'Failed to create patient' };
    }
  },

  getPatients: async () => {
    try {
      const headers = await getAuthHeaders();
  const resp = await fetch(`${BACKEND_URL}/api/patients`, {
        headers
      });
      const json = await resp.json();
      return json;
    } catch (error) {
      return { error: 'Failed to fetch patients' };
    }
  },

  // Analysis
  createAnalysis: async (formData: FormData) => {
    try {
      const headers = await getAuthHeaders();
      // Remove Content-Type for FormData as fetch sets it automatically
      delete headers['Content-Type'];
      const resp = await fetch(`${BACKEND_URL}/api/analyze`, {
        method: 'POST',
        headers,
        body: formData
      });
      return await resp.json();
    } catch (error) {
      return { error: 'Analysis failed' };
    }
  },

  getAnalysis: async (analysisId: string) => {
    if (demoSession?.access_token === 'demo-token-123') {
      const analysis = demoAnalyses.find(a => a.id === analysisId);
      if (!analysis) return { error: 'Analysis not found' };
      return { analysis };
    }
    
    return { error: 'Analysis retrieval not implemented for non-demo mode' };
  },

  // Patient History
  getPatientHistory: async (patientId: string) => {
    try {
      const headers = await getAuthHeaders();
  const resp = await fetch(`${BACKEND_URL}/api/patients/${patientId}/history`, {
        headers
      });
      return await resp.json();
    } catch (error) {
      return { error: 'Failed to load patient history' };
    }
  }
};