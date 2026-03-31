import React, { useState, useEffect } from 'react';
import { AnimatePresence } from 'motion/react';
import { ThemeProvider } from './components/ThemeProvider';
import { SplashScreen } from './components/SplashScreen';
import { LoginPage } from './components/LoginPage';
import { RegisterPage } from './components/RegisterPage';
import { Dashboard } from './components/Dashboard';
import { PatientRegistration } from './components/PatientRegistration';
import { AnalysisPage } from './components/AnalysisPage';
import { AnalysisResults } from './components/AnalysisResults';
import { PatientHistory } from './components/PatientHistory';
import { MedicalReport } from './components/MedicalReport';
import { Toaster } from './components/ui/sonner';
import { toast } from 'sonner';
import { supabase, api, setDemoSession, clearDemoSession } from './utils/supabase/client';
import { ResetPasswordPage } from './components/ResetPasswordPage';

type AppState = 
  | 'splash' 
  | 'login' 
  | 'register' 
  | 'dashboard' 
  | 'register-patient' 
  | 'analysis' 
  | 'analysis-results' 
  | 'patient-history' 
  | 'report' 
  | 'reset-password';

interface User {
  id: string;
  hospitalName: string;
  location: string;
  phone?: string;
  email: string;
  patientId: string;
}

interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  age: string;
  gender: string;
  contactNo: string;
  email: string;
  state: string;
  district: string;
  city: string;
  pincode: string;
  mrn: string;
  existingConditions: string[];
  registrationDate: string;
}

export default function App() {
  const [currentState, setCurrentState] = useState<AppState>('splash');
  const [user, setUser] = useState<User | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [analysisData, setAnalysisData] = useState<any>(null);
  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Check for existing session on app load
  useEffect(() => {
    // Handle Supabase auth callback (password reset link)
    const handleAuthCallback = async () => {
      const hash = window.location.hash;
      const currentUrl = window.location.href;
      const searchParams = new URLSearchParams(window.location.search);
      const pathname = window.location.pathname;
      
      // Check if we're on Supabase verify endpoint
      if (currentUrl.includes('supabase.co/auth/v1/verify')) {
        // Don't redirect manually - let Supabase handle it
        console.log('On Supabase verify endpoint - waiting for redirect...');
        return; // Let the page load and Supabase will redirect
      }
      
      // Check if we have token in query params (Supabase redirected here)
      const token = searchParams.get('token');
      const type = searchParams.get('type');
      
      // IMPORTANT: If we have a recovery token, show reset page regardless of session
      if (type === 'recovery' && token && pathname === '/reset-password') {
        console.log('Found recovery token in URL - showing reset page');
        setCurrentState('reset-password');
        return; // Let ResetPasswordPage handle token verification
      }
      
      // Check if this is a password reset callback (hash parameters)
      if (hash && (hash.includes('type=recovery') || hash.includes('access_token'))) {
        try {
          console.log('Processing hash parameters...');
          const hashParams = new URLSearchParams(hash.substring(1));
          const accessToken = hashParams.get('access_token');
          const refreshToken = hashParams.get('refresh_token');
          const hashType = hashParams.get('type');
          
          if (hashType === 'recovery' && accessToken) {
            console.log('Setting session from hash params...');
            const { data, error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken || ''
            });
            
            if (error) {
              console.error('Auth callback error:', error);
              toast.error('Invalid or expired reset link. Please request a new one.');
              window.location.hash = '';
              setCurrentState('login');
              return;
            }
            
            window.history.replaceState({}, '', '/reset-password');
            setCurrentState('reset-password');
            return;
          }
        } catch (error) {
          console.error('Error handling auth callback:', error);
          toast.error('Failed to process reset link. Please try again.');
          window.location.hash = '';
          setCurrentState('login');
          return;
        }
      }
      
      // Check if we're on the reset password page
      if (pathname === '/reset-password') {
        // If there's a token in URL, show reset page (let it handle verification)
        if (token && type === 'recovery') {
          console.log('On reset-password page with token - showing page');
          setCurrentState('reset-password');
          return;
        }
        
        // Check if there's already a valid session
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          console.log('Session found on reset-password page');
          setCurrentState('reset-password');
        } else {
          // No session and no token, redirect to login
          console.log('No session or token, redirecting to login');
          setCurrentState('login');
        }
        return;
      }
      
      checkSession();
    };
    
    handleAuthCallback();
  }, []);

  // Add this as a separate useEffect that runs on every hash change
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash && (hash.includes('type=recovery') || hash.includes('access_token'))) {
        console.log('Hash change detected:', hash);
        // Force re-run the auth callback handler
        const hashParams = new URLSearchParams(hash.substring(1));
        const type = hashParams.get('type');
        if (type === 'recovery') {
          setCurrentState('reset-password');
        }
      }
    };
    
    window.addEventListener('hashchange', handleHashChange);
    // Also check immediately
    handleHashChange();
    
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []);

  const checkSession = async () => {
    try {
      // Check for demo session in localStorage first
      const demoSession = localStorage.getItem('demo-session');
      if (demoSession) {
        const sessionData = JSON.parse(demoSession);
        setDemoSession(sessionData);
        
        // Set demo user data
        setUser({
          id: 'demo-user-123',
          hospitalName: 'Demo General Hospital',
          location: 'Mumbai, Maharashtra',
          email: 'demo@hospital.com',
          patientId: 'DEMO001'
        });
        
        // Load patients
        await loadPatients();
        setCurrentState('dashboard');
        return;
      }

      // Check for real Supabase session
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        // User is already logged in, get their data
        const userData = session.user.user_metadata;
        setUser({
          id: session.user.id,
          hospitalName: userData.hospitalName,
          location: userData.location,
          email: session.user.email || '',
          patientId: userData.patientId
        });
        // Load patients
        await loadPatients();
        setCurrentState('dashboard');
      }
    } catch (error) {
      console.error('Error checking session:', error);
    }
  };

  const loadPatients = async () => {
    try {
      const response = await api.getPatients();
      
      if (response.error) {
        console.error('API error loading patients:', response.error);
        toast.error('Failed to load patients', {
          description: response.error
        });
        return;
      }
      
      if (response.patients && Array.isArray(response.patients)) {
        setPatients(response.patients);
      } else {
        console.warn('Unexpected response format from getPatients:', response);
        setPatients([]); // Set empty array as fallback
      }
    } catch (error) {
      console.error('Error loading patients:', error);
      toast.error('Failed to load patients', {
        description: 'An unexpected error occurred while loading patient data.'
      });
      setPatients([]); // Set empty array as fallback
    }
  };

  const handleSplashComplete = () => {
    setCurrentState('login');
  };

  const handleLogin = async (email: string, password: string) => {
    setLoading(true);
    try {
      const response = await api.signin(email, password);
      
      if (response.error) {
        toast.error('Login failed', {
          description: response.error,
        });
        setLoading(false);
        return;
      }

      const userData = response.userData;
      if (!response.user || !userData) {
        toast.error('Login failed', { description: 'Invalid response from server.' });
        setLoading(false);
        return;
      }
      
      // Store demo session if it's a demo user
      if (response.session?.access_token === 'demo-token-123') {
        setDemoSession(response.session);
        localStorage.setItem('demo-session', JSON.stringify(response.session));
      }
      
      setUser({
        id: response.user.id,
        hospitalName: userData.hospitalName,
        location: userData.location,
        phone: (userData as any).phone || '',
        email: response.user.email,
        patientId: userData.patientId
      });

      // Load patients
      await loadPatients();
      
      setCurrentState('dashboard');
      
      toast.success(`Welcome to ${userData.hospitalName}! Successfully logged in.`, {
        description: 'You can now access the CHRONOCardioAI platform.',
      });
    } catch (error) {
      console.error('Login error:', error);
      toast.error('Login failed', {
        description: 'An unexpected error occurred. Please try again.',
      });
    }
    setLoading(false);
  };

  const handleRegister = async (userData: any) => {
    setLoading(true);
    try {
      const response = await api.signup(
        userData.email,
        userData.password,
        userData.hospitalName,
        userData.location,
        userData.phone
      );
      
      if (response.error) {
        toast.error('Registration failed', {
          description: response.error,
        });
        setLoading(false);
        return;
      }

      // Check if email confirmation is needed
      if ((response as any).needsEmailConfirmation) {
        toast.success('Registration successful!', {
          description: 'Please check your email to confirm your account, then login.',
        });
        setCurrentState('login');
        setLoading(false);
        return;
      }

      // Auto-login after registration (if email confirmation not required)
      try {
        await handleLogin(userData.email, userData.password);
        
        toast.success(`Registration successful for ${userData.hospitalName}!`, {
          description: 'Your account has been created. Welcome to CHRONOCardioAI.',
        });
      } catch (loginError) {
        // If auto-login fails, user might need to confirm email first
        toast.info('Account created!', {
          description: 'Please login with your credentials. If you don\'t see an email, check spam.',
        });
        setCurrentState('login');
      }
    } catch (error) {
      console.error('Registration error:', error);
      toast.error('Registration failed', {
        description: error instanceof Error ? error.message : 'An unexpected error occurred. Please try again.',
      });
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      // Clear demo session if it exists
      localStorage.removeItem('demo-session');
      clearDemoSession();
      
      await supabase.auth.signOut();
      setUser(null);
      setPatients([]);
      setAnalysisData(null);
      setReportData(null);
      setCurrentState('login');
      toast.info('Successfully logged out. See you next time!');
    } catch (error) {
      console.error('Logout error:', error);
      toast.error('Error during logout');
    }
  };

  const handleNavigate = (page: string, data?: any) => {
    if (page === 'analysis-results') {
      setAnalysisData(data);
      // Refresh patients so dashboard and history reflect the new analysis immediately
      loadPatients().catch(() => {});
    } else if (page === 'report') {
      setReportData(data);
    }
    setCurrentState(page as AppState);
  };

  const handleRegisterPatient = async (patientData: any) => {
    setLoading(true);
    try {
      const response = await api.createPatient(patientData);
      
      if (response.error) {
        toast.error('Patient registration failed', {
          description: response.error,
        });
        setLoading(false);
        return;
      }

      if (response.db && response.db.saved === false) {
        toast.warning('Saved locally, but failed to persist to DB', {
          description: response.db.error || 'Unknown database error',
        });
      }

      // Refresh patients list
      await loadPatients();
      
      toast.success('Patient registered successfully!', {
        description: `${patientData.firstName} ${patientData.lastName} has been added to the system.`,
      });

      // Navigate back to dashboard after successful registration
      setCurrentState('dashboard');
    } catch (error) {
      console.error('Patient registration error:', error);
      toast.error('Patient registration failed', {
        description: 'An unexpected error occurred. Please try again.',
      });
    }
    setLoading(false);
  };

  const renderCurrentPage = () => {
    switch (currentState) {
      case 'splash':
        return <SplashScreen onComplete={handleSplashComplete} />;
      
      case 'login':
        return (
          <LoginPage 
            onLogin={handleLogin}
            onNavigateToRegister={() => setCurrentState('register')}
            loading={loading}
          />
        );
      
      case 'register':
        return (
          <RegisterPage 
            onRegister={handleRegister}
            onNavigateToLogin={() => setCurrentState('login')}
            loading={loading}
          />
        );
      
      case 'dashboard':
        return user ? (
          <Dashboard 
            hospitalName={user.hospitalName}
            onNavigate={handleNavigate}
            onLogout={handleLogout}
          />
        ) : null;
      
      case 'register-patient':
        return user ? (
          <PatientRegistration 
            hospitalName={user.hospitalName}
            onNavigate={handleNavigate}
            onLogout={handleLogout}
            onRegisterPatient={handleRegisterPatient}
            loading={loading}
          />
        ) : null;
      
      case 'analysis':
        return user ? (
          <AnalysisPage 
            hospitalName={user.hospitalName}
            patients={patients}
            onNavigate={handleNavigate}
            onLogout={handleLogout}
          />
        ) : null;
      
      case 'analysis-results':
        return user && analysisData ? (
          <AnalysisResults 
            hospitalName={user.hospitalName}
            analysisData={analysisData}
            onNavigate={handleNavigate}
            onLogout={handleLogout}
            hospitalDetails={{ address: user.location, phone: user.phone }}
          />
        ) : null;
      
      case 'patient-history':
        return user ? (
          <PatientHistory 
            hospitalName={user.hospitalName}
            onNavigate={handleNavigate}
            onLogout={handleLogout}
          />
        ) : null;
      
      case 'report':
        return user && reportData ? (
          <MedicalReport 
            hospitalName={user.hospitalName}
            reportData={reportData}
            onNavigate={handleNavigate}
            onLogout={handleLogout}
          />
        ) : null;
      
      case 'reset-password':
        return (
          <ResetPasswordPage 
            onPasswordReset={() => {
              setCurrentState('login');
              window.history.pushState({}, '', '/');
            }} 
          />
        );
      
      default:
        return null;
    }
  };

  return (
    <ThemeProvider>
      <div className="min-h-screen bg-background font-sans antialiased">
        <AnimatePresence mode="wait">
          {renderCurrentPage()}
        </AnimatePresence>
        <Toaster position="top-right" richColors />
      </div>
    </ThemeProvider>
  );
}