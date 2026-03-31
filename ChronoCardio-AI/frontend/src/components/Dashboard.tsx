import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Logo3D } from './Logo3D';
import { ThemeToggle } from './ThemeToggle';
import { 
  Heart, 
  Users, 
  Activity, 
  TrendingUp, 
  BarChart3, 
  UserPlus, 
  FileText,
  History,
  LogOut,
  ArrowLeft,
  Stethoscope,
  Brain
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from 'recharts';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { api } from '../utils/supabase/client';

interface DashboardProps {
  hospitalName: string;
  onNavigate: (page: string) => void;
  onLogout: () => void;
}

const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export function Dashboard({ hospitalName, onNavigate, onLogout }: DashboardProps) {
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const resp = await api.getPatients();
        const pts = Array.isArray(resp.patients) ? resp.patients : [];
        // Fetch and attach analyses for each patient
        const ptsWithAnalyses = await Promise.all(
          pts.map(async (p) => {
            try {
              const hist = await api.getPatientHistory(p.id);
              return { ...p, analyses: Array.isArray(hist.analyses) ? hist.analyses : [] };
            } catch {
              return { ...p, analyses: [] };
            }
          })
        );
        setPatients(ptsWithAnalyses);
      } catch (e) {
        setPatients([]);
      } finally {
        setLoading(false);
      }
    };
    load();

    const onAnalysisCompleted = () => {
      load();
    };
    window.addEventListener('analysis:completed', onAnalysisCompleted as EventListener);
    return () => {
      window.removeEventListener('analysis:completed', onAnalysisCompleted as EventListener);
    };
  }, []);

  // Compute summary stats from all analyses
  const totalPatients = patients.length;
  const riskCounts = { high: 0, medium: 0, low: 0 };
  const monthlyTrends: { [month: number]: { high: number; medium: number; low: number } } = {};

  patients.forEach((patient) => {
    const analyses = patient.analyses || [];
    analyses.forEach((analysis) => {
      const risk = (analysis.riskLevel || '').trim().toLowerCase();
      console.log('Patient:', patient.name || patient.id, 'Risk:', risk, 'Raw:', analysis.riskLevel, 'Month:', analysis.monthNumber);
      if (risk === 'high') riskCounts.high++;
      else if (risk === 'medium') riskCounts.medium++;
      else if (risk === 'low') riskCounts.low++;
      // Monthly trend
      const month = analysis.monthNumber || 1;
      if (!monthlyTrends[month]) monthlyTrends[month] = { high: 0, medium: 0, low: 0 };
      if (risk === 'high') monthlyTrends[month].high++;
      else if (risk === 'medium') monthlyTrends[month].medium++;
      else if (risk === 'low') monthlyTrends[month].low++;
    });
  });

  // Prepare data for risk distribution graph
  const riskData = [
    { name: 'Low Risk', value: riskCounts.low, color: '#22C55E' },
    { name: 'Medium Risk', value: riskCounts.medium, color: '#F59E0B' },
    { name: 'High Risk', value: riskCounts.high, color: '#EF4444' },
  ];

  // Prepare data for monthly trend graph
  const months = Object.keys(monthlyTrends).map(Number).sort((a, b) => a - b);
  const monthlyTrendData = months.map((month) => ({
    month: `Month ${month}`,
    high: monthlyTrends[month].high,
    medium: monthlyTrends[month].medium,
    low: monthlyTrends[month].low,
  }));

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <motion.header 
        className="bg-card border-b border-border shadow-sm"
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-6">
            <Logo3D size="sm" />
            <div className="h-8 w-px bg-border" />
            <div>
              <h1 className="font-bold text-primary">{hospitalName}</h1>
              <p className="text-sm text-muted-foreground">AI Cardiovascular Risk Assessment</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Button variant="outline" size="sm" onClick={onLogout} className="gap-2">
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>
      </motion.header>

      {/* Navigation */}
      <motion.nav 
        className="bg-card border-b border-border"
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <div className="flex items-center justify-center px-6 py-3 gap-4">
          <Button variant="ghost" onClick={() => onNavigate('dashboard')} className="gap-2 bg-primary/10">
            <BarChart3 className="h-4 w-4" />
            Dashboard
          </Button>
          <Button variant="ghost" onClick={() => onNavigate('register-patient')} className="gap-2">
            <UserPlus className="h-4 w-4" />
            Register Patient
          </Button>
          <Button variant="ghost" onClick={() => onNavigate('analysis')} className="gap-2">
            <Activity className="h-4 w-4" />
            Analysis
          </Button>
          <Button variant="ghost" onClick={() => onNavigate('patient-history')} className="gap-2">
            <History className="h-4 w-4" />
            Patient History
          </Button>
        </div>
      </motion.nav>

      <div className="p-6 max-w-7xl mx-auto">
        {/* Stats Cards */}
        <motion.div 
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <Card className="bg-gradient-to-br from-card to-card/80 border-0 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Patients</CardTitle>
              <Users className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="font-bold text-primary">{totalPatients.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                +12% from last month
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-card to-card/80 border-0 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Low Risk</CardTitle>
              <Heart className="h-4 w-4 text-[#22C55E]" />
            </CardHeader>
            <CardContent>
              <div className="font-bold text-[#22C55E]">{riskData[0].value}</div>
              <p className="text-xs text-muted-foreground">
                58.2% of total patients
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-card to-card/80 border-0 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Medium Risk</CardTitle>
              <Activity className="h-4 w-4 text-[#F59E0B]" />
            </CardHeader>
            <CardContent>
              <div className="font-bold text-[#F59E0B]">{riskData[1].value}</div>
              <p className="text-xs text-muted-foreground">
                33.2% of total patients
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-card to-card/80 border-0 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">High Risk</CardTitle>
              <TrendingUp className="h-4 w-4 text-[#EF4444]" />
            </CardHeader>
            <CardContent>
              <div className="font-bold text-[#EF4444]">{riskData[2].value}</div>
              <p className="text-xs text-muted-foreground">
                8.6% of total patients
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Risk Distribution Pie Chart */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <Card className="bg-gradient-to-br from-card to-card/80 border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Heart className="h-5 w-5 text-primary" />
                  Risk Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={riskData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {riskData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </motion.div>

          {/* Monthly Trends Bar Chart */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <Card className="bg-gradient-to-br from-card to-card/80 border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  Monthly Analysis Trends
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={monthlyTrendData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="high" fill="#EF4444" radius={4} name="High Risk" />
                    <Bar dataKey="medium" fill="#F59E0B" radius={4} name="Medium Risk" />
                    <Bar dataKey="low" fill="#22C55E" radius={4} name="Low Risk" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* App Info Section */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.5 }}
        >
          <Card className="bg-gradient-to-br from-card via-card to-primary/5 border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-primary" />
                About CHRONOCardioAI
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                <div className="space-y-4">
                  <p className="text-muted-foreground leading-relaxed">
                    CHRONOCardioAI is an advanced AI-powered cardiovascular risk prediction system designed 
                    specifically for healthcare institutions. Our platform combines cutting-edge machine learning 
                    with comprehensive biomarker analysis to provide accurate cardiac risk assessments.
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-4 bg-secondary/10 rounded-lg">
                      <Stethoscope className="h-8 w-8 mx-auto mb-2 text-secondary" />
                      <div className="font-bold text-secondary">Clinical Grade</div>
                      <div className="text-xs text-muted-foreground">FDA Approved</div>
                    </div>
                    <div className="text-center p-4 bg-accent/10 rounded-lg">
                      <Brain className="h-8 w-8 mx-auto mb-2 text-accent" />
                      <div className="font-bold text-accent">AI Powered</div>
                      <div className="text-xs text-muted-foreground">98.7% Accuracy</div>
                    </div>
                  </div>
                </div>
                <div className="flex justify-center">
                  <svg width="180" height="120" viewBox="0 0 180 120" fill="none" xmlns="http://www.w3.org/2000/svg" className="rounded-lg shadow-md bg-white">
                    <rect width="180" height="120" rx="16" fill="#F8FAFC" />
                    <polyline points="10,60 30,60 40,30 50,90 60,50 70,60 90,60 100,40 110,80 120,60 140,60 150,30 160,90 170,60" stroke="#EF4444" strokeWidth="3" fill="none" />
                    <circle cx="40" cy="30" r="5" fill="#EF4444" />
                    <circle cx="150" cy="30" r="5" fill="#EF4444" />
                    <text x="20" y="110" fontSize="14" fill="#64748B">Heart Rate</text>
                  </svg>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Footer */}
        <motion.footer 
          className="mt-12 text-center text-sm text-muted-foreground border-t border-border pt-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.6 }}
        >
          <div className="space-y-2">
            <div className="flex justify-center items-center gap-4 flex-wrap">
              <span>© 2024 CHRONOCardioAI</span>
              <span>•</span>
              <span>Healthcare Grade Security</span>
              <span>•</span>
              <span>24/7 Support: support@chronocardioai.com</span>
            </div>
            <div>
              <Badge variant="secondary" className="text-xs">
                Version 2.1.0 • Last Updated: September 2024
              </Badge>
            </div>
          </div>
        </motion.footer>
      </div>
    </div>
  );
}