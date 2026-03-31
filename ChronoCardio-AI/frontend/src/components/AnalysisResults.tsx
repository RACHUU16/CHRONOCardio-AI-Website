import React, { useEffect, useState } from "react";

import { motion } from 'motion/react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { Logo3D } from './Logo3D';
import { ThemeToggle } from './ThemeToggle';
import { 
  ArrowLeft, 
  Heart, 
  TrendingUp, 
  AlertTriangle,
  CheckCircle,
  FileText,
  Download,
  LogOut,
  Activity,
  Stethoscope,
  Brain
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import { ImageWithFallback } from './figma/ImageWithFallback';

interface AnalysisResultsProps {
  hospitalName: string;
  analysisData: any;
  onNavigate: (page: string, data?: any) => void;
  onLogout: () => void;
  hospitalDetails?: { address?: string; phone?: string };
}

type RiskLevel = 'low' | 'medium' | 'high' | string;

interface Results {
  riskScore: number;
  riskLevel: RiskLevel;
  riskColor: string;
  riskLabel: string;
  riskFactors: string[];
  recommendations: string[];
  tenYearRisk: number;
}

// Mock AI analysis results based on biomarker data
function generateAnalysisResults(biomarkers: any) {
  // Simple risk calculation based on biomarkers
  let riskScore = 0;
  let riskFactors = [];
  let recommendations = [];

  // BMI assessment
  const bmi = parseFloat(biomarkers.bmi || '25');
  if (bmi > 30) {
    riskScore += 15;
    riskFactors.push('Obesity (BMI > 30)');
    recommendations.push('Weight management through diet and exercise');
  } else if (bmi > 25) {
    riskScore += 8;
    riskFactors.push('Overweight (BMI 25-30)');
  }

  // Blood pressure
  const systolic = parseFloat(biomarkers.systolicBp || '120');
  const diastolic = parseFloat(biomarkers.diastolicBp || '80');
  if (systolic > 140 || diastolic > 90) {
    riskScore += 20;
    riskFactors.push('Hypertension');
    recommendations.push('Blood pressure management and monitoring');
  }

  // Cholesterol
  const cholesterol = parseFloat(biomarkers.cholesterol || '200');
  const ldl = parseFloat(biomarkers.ldl || '100');
  if (cholesterol > 240 || ldl > 130) {
    riskScore += 18;
    riskFactors.push('High cholesterol');
    recommendations.push('Cholesterol management with diet and medication');
  }

  // Smoking
  if (biomarkers.smokingStatus === 'current') {
    riskScore += 25;
    riskFactors.push('Current smoking');
    recommendations.push('Smoking cessation program');
  }

  // Diabetes
  if (biomarkers.diabetes === 'type1' || biomarkers.diabetes === 'type2') {
    riskScore += 22;
    riskFactors.push('Diabetes');
    recommendations.push('Diabetes management and monitoring');
  }

  // Family history
  if (biomarkers.familyHistory === 'yes') {
    riskScore += 10;
    riskFactors.push('Family history of CVD');

  }

  // Determine risk level
  let riskLevel: 'low' | 'medium' | 'high';
  let riskColor: string;
  let riskLabel: string;

  if (riskScore < 30) {
    riskLevel = 'low';
    riskColor = '#22C55E';
    riskLabel = 'Low Risk';
  } else if (riskScore < 60) {
    riskLevel = 'medium';
    riskColor = '#F59E0B';
    riskLabel = 'Medium Risk';
  } else {
    riskLevel = 'high';
    riskColor = '#EF4444';
    riskLabel = 'High Risk';
  }

  return {
    riskScore: Math.min(riskScore, 100),
    riskLevel,
    riskColor,
    riskLabel,
    riskFactors,
    recommendations,
    tenYearRisk: Math.min(riskScore * 0.3, 30), // Estimated 10-year risk percentage
  };
}

export function AnalysisResults({ hospitalName, analysisData, onNavigate, onLogout, hospitalDetails }: AnalysisResultsProps) {
  const { patient, month, biomarkers, timestamp, backend } = analysisData;
  const backendResult = backend?.prediction;
  const backendRecs: string[] = Array.isArray(backend?.recommendations) ? backend.recommendations : [];
  const results: Results = backendResult ? {
    riskScore: backendResult.riskScore,
    riskLevel: (backendResult.riskLevel || '').toLowerCase(),
    riskColor: backendResult.riskLevel === 'High' ? '#EF4444' : backendResult.riskLevel === 'Medium' ? '#F59E0B' : '#22C55E',
    riskLabel: backendResult.riskLevel + ' Risk',
    riskFactors: [],
    recommendations: backendRecs,
    tenYearRisk: Math.min(backendResult.riskScore * 0.3, 30)
  } : generateAnalysisResults(biomarkers) as Results;

  const biomarkerTrends = [
    { name: 'Cholesterol', value: parseFloat(biomarkers.cholesterol || '200'), optimal: 200, unit: 'mg/dL' },
    { name: 'LDL', value: parseFloat(biomarkers.ldl || '100'), optimal: 100, unit: 'mg/dL' },
    { name: 'HDL', value: parseFloat(biomarkers.hdl || '50'), optimal: 60, unit: 'mg/dL' },
    { name: 'Systolic BP', value: parseFloat(biomarkers.systolicBp || '120'), optimal: 120, unit: 'mmHg' },
    { name: 'BMI', value: parseFloat(biomarkers.bmi || '25'), optimal: 22, unit: 'kg/m²' },
  ];

  const radarData = [
    { subject: 'Cholesterol', A: Math.max(0, Math.min(100 - ((parseFloat(biomarkers.cholesterol ?? '0') - 150) / 100 * 100), 100)) },
    { subject: 'Blood Pressure', A: Math.max(0, Math.min(100 - ((parseFloat(biomarkers.systolicBp ?? '0') - 90) / 50 * 100), 100)) },
    { subject: 'BMI', A: Math.max(0, Math.min(100 - Math.abs(parseFloat(biomarkers.bmi ?? '0') - 22) / 10 * 100, 100)) },
    { subject: 'Lifestyle', A: Math.max(0, Math.min((parseFloat(biomarkers.physicalActivity ?? '0') || 0) * 20, 100)) },
    { subject: 'Sleep', A: Math.max(0, Math.min(((parseFloat(biomarkers.sleepHours ?? '0') || 0) / 8) * 100, 100)) },
  ];

  const handleGenerateReport = async () => {
    // Build enriched report payload including history-based trend and month label
    let analysisHistory: any = undefined;
    try {
      // Lazy import to avoid direct coupling; api is small enough to import at top if preferred
      const { api } = await import('../utils/supabase/client');
      const history = await api.getPatientHistory(patient.id);
      const analyses = Array.isArray(history.analyses) ? history.analyses : [];
      const previousAnalyses = analyses.length;
      const trendDirection = previousAnalyses > 1
        ? (results.riskScore < (analyses[0]?.riskScore ?? results.riskScore) ? 'improving'
          : results.riskScore > (analyses[0]?.riskScore ?? results.riskScore) ? 'declining' : 'stable')
        : 'stable';
      const firstAnalysisDate = history.patient?.registrationDate || analyses[analyses.length - 1]?.analysisDate || timestamp;
      analysisHistory = {
        previousAnalyses,
        trendDirection,
        firstAnalysisDate,
        allAnalyses: analyses,
      };
    } catch (_) {
      // Non-blocking; proceed without history
    }

    const monthLabel = typeof month === 'number'
      ? `${month}st Month`.replace('1stst', '1st').replace('2st', '2nd').replace('3st', '3rd').replace(/(4|5|6|7|8|9|10|11|12)st/, '$1th')
      : month;

    const reportData = {
      patient: {
        name: `${patient.firstName} ${patient.lastName}`.trim(),
        firstName: patient.firstName,
        lastName: patient.lastName,
        age: patient.age,
        gender: patient.gender,
        mrn: patient.mrn,
        patientId: patient.id,
      },
      hospital: {
        name: hospitalName,
        address: hospitalDetails?.address || '',
        phone: hospitalDetails?.phone || '',
      },
      riskLevel: (results.riskLabel || '').replace(' Risk', '') || (results.riskLevel || '').toString().replace(/^\w/, (c: string) => c.toUpperCase()),
      riskScore: results.riskScore,
      analysisDate: timestamp,
      biomarkers,
      analysisHistory,
      monthLabel,
      recommendations: results.recommendations,
    };

    onNavigate('report', reportData);
  };

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
              <p className="text-sm text-muted-foreground">AI Analysis Results</p>
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
        <div className="flex items-center px-6 py-3 gap-4">
          <Button variant="ghost" onClick={() => onNavigate('analysis')} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Analysis
          </Button>
          <div className="h-4 w-px bg-border" />
          <Badge variant="secondary" className="gap-1">
            <Brain className="h-3 w-3" />
            AI Risk Assessment Complete
          </Badge>
        </div>
      </motion.nav>

      <div className="p-6 max-w-7xl mx-auto">
        {/* Patient Header */}
        <motion.div
          className="mb-6"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <Card className="bg-gradient-to-r from-primary/5 to-accent/5 border-0 shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-bold text-primary">{patient.firstName} {patient.lastName}</h2>
                  <div className="text-muted-foreground">
                    Age: {patient.age} • Gender: {patient.gender} • MRN: {patient.mrn}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    Analysis Date: {new Date(timestamp).toLocaleDateString()} • Month: {month}
                  </div>
                </div>
                <div className="text-right">
                  <Button onClick={handleGenerateReport} className="gap-2">
                    <FileText className="h-4 w-4" />
                    Generate Report
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Risk Assessment Card */}
        <motion.div
          className="mb-8"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <Card className="bg-gradient-to-br from-card to-card/80 border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Heart className="h-5 w-5 text-primary" />
                Cardiovascular Risk Assessment
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div className="text-center">
                    <motion.div 
                      className="inline-flex items-center justify-center w-32 h-32 rounded-full border-8 mb-4"
                      style={{ borderColor: results.riskColor, color: results.riskColor }}
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ duration: 0.8, delay: 0.5 }}
                    >
                      <div className="text-center">
                        <div className="font-bold">{results.riskScore}/100</div>
                        <div className="text-sm font-medium">Risk Score</div>
                      </div>
                    </motion.div>
                    <Badge 
                      className="px-4 py-2 text-white"
                      style={{ backgroundColor: results.riskColor }}
                    >
                      {results.riskLabel}
                    </Badge>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span>10-Year CVD Risk:</span>
                      <span className="font-medium" style={{ color: results.riskColor }}>
                        {results.tenYearRisk.toFixed(1)}%
                      </span>
                    </div>
                    <Progress 
                      value={results.tenYearRisk} 
                      className="h-3"
                      style={{ 
                        '--progress-foreground': results.riskColor 
                      } as React.CSSProperties}
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-semibold text-primary">Risk Factors Identified</h4>
                  {results.riskFactors.length > 0 ? (
                    <div className="space-y-2">
                      {results.riskFactors.map((factor, index) => (
                        <motion.div 
                          key={index}
                          className="flex items-center gap-2 p-2 bg-destructive/10 rounded-lg"
                          initial={{ x: -20, opacity: 0 }}
                          animate={{ x: 0, opacity: 1 }}
                          transition={{ delay: 0.6 + index * 0.1 }}
                        >
                          <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0" />
                          <span className="text-sm">{factor}</span>
                        </motion.div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 p-2 bg-secondary/10 rounded-lg">
                      <CheckCircle className="h-4 w-4 text-secondary" />
                      <span className="text-sm">No significant risk factors identified</span>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Biomarker Trends */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <Card className="bg-gradient-to-br from-card to-card/80 border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-primary" />
                  Biomarker Analysis
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={biomarkerTrends}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                    <YAxis />
                    <Tooltip 
                      formatter={(value: any, name: string, props: any) => [
                        `${value} ${props.payload.unit}`, 
                        name === 'value' ? 'Current' : name
                      ]}
                    />
                    <Bar dataKey="value" fill="#10B981" radius={4} />
                    <Bar dataKey="optimal" fill="#06B6D4" radius={4} opacity={0.6} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </motion.div>

          {/* Health Profile Radar */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.5 }}
          >
            <Card className="bg-gradient-to-br from-card to-card/80 border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Stethoscope className="h-5 w-5 text-primary" />
                  Health Profile Overview
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <RadarChart data={radarData}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="subject" />
                    <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} />
                    <Radar 
                      name="Health Score" 
                      dataKey="A" 
                      stroke="#10B981" 
                      fill="#10B981" 
                      fillOpacity={0.3}
                      strokeWidth={2}
                    />
                    <Tooltip formatter={(value: any) => [`${Math.round(value as number)}%`, 'Health Score']} />
                  </RadarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Recommendations */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.6 }}
        >
          <Card className="bg-gradient-to-br from-card via-card to-secondary/5 border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                AI-Generated Recommendations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h4 className="font-semibold text-primary">Clinical Recommendations</h4>
                  {results.recommendations.length > 0 ? (
                    <div className="space-y-3">
                      {results.recommendations.map((rec, index) => (
                        <motion.div 
                          key={index}
                          className="flex items-start gap-3 p-3 bg-primary/5 rounded-lg"
                          initial={{ x: -20, opacity: 0 }}
                          animate={{ x: 0, opacity: 1 }}
                          transition={{ delay: 0.7 + index * 0.1 }}
                        >
                          <CheckCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                          <span className="text-sm">{rec}</span>
                        </motion.div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-3 bg-secondary/5 rounded-lg">
                      <p className="text-sm">Continue current lifestyle and regular check-ups.</p>
                    </div>
                  )}
                </div>
                
                <div className="space-y-4">
                  <h4 className="font-semibold text-primary">General Guidelines</h4>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3 p-3 bg-accent/5 rounded-lg">
                      <Heart className="h-5 w-5 text-accent flex-shrink-0 mt-0.5" />
                      <span className="text-sm">Regular cardiovascular monitoring and follow-up appointments</span>
                    </div>
                    <div className="flex items-start gap-3 p-3 bg-accent/5 rounded-lg">
                      <Activity className="h-5 w-5 text-accent flex-shrink-0 mt-0.5" />
                      <span className="text-sm">Maintain an active lifestyle with 150 minutes of moderate exercise weekly</span>
                    </div>
                    <div className="flex items-start gap-3 p-3 bg-accent/5 rounded-lg">
                      <Stethoscope className="h-5 w-5 text-accent flex-shrink-0 mt-0.5" />
                      <span className="text-sm">Follow Mediterranean diet rich in fruits, vegetables, and whole grains</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Action Buttons */}
        <motion.div 
          className="flex justify-center gap-4 mt-8"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.7 }}
        >
          <Button variant="outline" onClick={() => onNavigate('analysis')}>
            New Analysis
          </Button>
          <Button onClick={handleGenerateReport} className="gap-2">
            <Download className="h-4 w-4" />
            Download Report
          </Button>
        </motion.div>
      </div>
    </div>
  );
}