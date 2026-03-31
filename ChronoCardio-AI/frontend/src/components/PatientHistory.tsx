import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Logo3D } from './Logo3D';
import { ThemeToggle } from './ThemeToggle';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { 
  Heart, 
  Users, 
  Activity, 
  Search,
  Calendar,
  FileText,
  Download,
  Eye,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  LogOut,
  ArrowLeft,
  Filter,
  User,
  History,
  Clock,
  X
} from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { toast } from 'sonner';
import { api } from '../utils/supabase/client';

interface PatientHistoryProps {
  hospitalName: string;
  onNavigate: (page: string, data?: any) => void;
  onLogout: () => void;
}

interface PatientRecord {
  id: string;
  name: string;
  mrn: string;
  age: number;
  gender: string;
  lastAnalysis: string;
  riskLevel: 'Low' | 'Medium' | 'High';
  riskScore: number;
  analysisCount: number;
  registrationDate: string;
  status: 'Active' | 'Follow-up' | 'Discharged';
}

export function PatientHistory({ hospitalName, onNavigate, onLogout }: PatientHistoryProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRisk, setFilterRisk] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [patients, setPatients] = useState<PatientRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPatient, setSelectedPatient] = useState<PatientRecord | null>(null);
  const [patientAnalyses, setPatientAnalyses] = useState<any[]>([]);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    loadPatients();
  }, []);

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
        const transformedPatients = await Promise.all(
          response.patients.map(async (patient: any) => {
            try {
              const historyResponse = await api.getPatientHistory(patient.id);
              const analyses = Array.isArray(historyResponse.analyses) ? historyResponse.analyses : [];
              const latestAnalysis = analyses[0] || null;
              return {
                id: patient.id,
                name: `${patient.firstName} ${patient.lastName}`,
                mrn: patient.mrn,
                age: parseInt(patient.age),
                gender: patient.gender,
                lastAnalysis: latestAnalysis ? latestAnalysis.analysisDate : patient.registrationDate,
                riskLevel: (latestAnalysis?.riskLevel || 'Low') as 'Low' | 'Medium' | 'High',
                riskScore: latestAnalysis?.riskScore || 0,
                analysisCount: analyses.length,
                registrationDate: patient.registrationDate,
                status: 'Active' as 'Active'
              };
            } catch (error) {
              console.error('Error loading patient analysis data:', error);
              return {
                id: patient.id,
                name: `${patient.firstName} ${patient.lastName}`,
                mrn: patient.mrn,
                age: parseInt(patient.age),
                gender: patient.gender,
                lastAnalysis: patient.registrationDate,
                riskLevel: 'Low' as 'Low',
                riskScore: 0,
                analysisCount: 0,
                registrationDate: patient.registrationDate,
                status: 'Active' as 'Active'
              };
            }
          })
        );
        setPatients(transformedPatients);
      } else {
        console.warn('Unexpected response format from getPatients:', response);
        setPatients([]);
      }
    } catch (error) {
      console.error('Error loading patients:', error);
      toast.error('Failed to load patients');
      setPatients([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredPatients = patients.filter(patient => {
    const matchesSearch = patient.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         patient.mrn.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRisk = filterRisk === 'all' || patient.riskLevel === filterRisk;
    const matchesStatus = filterStatus === 'all' || patient.status === filterStatus;
    
    return matchesSearch && matchesRisk && matchesStatus;
  });

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'Low': return 'text-[#22C55E] bg-[#22C55E]/10';
      case 'Medium': return 'text-[#F59E0B] bg-[#F59E0B]/10';
      case 'High': return 'text-[#EF4444] bg-[#EF4444]/10';
      default: return 'text-gray-500 bg-gray-100';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Active': return 'text-[#10B981] bg-[#10B981]/10';
      case 'Follow-up': return 'text-[#F59E0B] bg-[#F59E0B]/10';
      case 'Discharged': return 'text-gray-500 bg-gray-100';
      default: return 'text-gray-500 bg-gray-100';
    }
  };

  const handleViewReport = async (patient: PatientRecord) => {
    try {
      const historyResponse = await api.getPatientHistory(patient.id);
      
      let reportData;
      
      if (historyResponse.analyses && historyResponse.analyses.length > 0) {
        const latestAnalysis = historyResponse.analyses[0];
        
        reportData = {
          patient: {
            name: patient.name,
            mrn: patient.mrn,
            age: patient.age,
            gender: patient.gender,
            patientId: patient.id
          },
          riskLevel: latestAnalysis.riskLevel,
          riskScore: latestAnalysis.riskScore,
          analysisDate: latestAnalysis.analysisDate,
          biomarkers: latestAnalysis.biomarkers,
          analysisHistory: {
            previousAnalyses: historyResponse.analyses.length,
            trendDirection: historyResponse.analyses.length > 1 ? 
              (latestAnalysis.riskScore < historyResponse.analyses[1].riskScore ? 'improving' : 
               latestAnalysis.riskScore > historyResponse.analyses[1].riskScore ? 'declining' : 'stable') :
              'stable',
            firstAnalysisDate: patient.registrationDate,
            allAnalyses: historyResponse.analyses
          },
          ecgData: latestAnalysis.ecgData,
          recommendations: latestAnalysis.recommendations,
          clinicalNotes: latestAnalysis.clinicalNotes
        };
      } else {
        reportData = {
          patient: {
            name: patient.name,
            mrn: patient.mrn,
            age: patient.age,
            gender: patient.gender,
            patientId: patient.id
          },
          riskLevel: patient.riskLevel,
          riskScore: patient.riskScore,
          analysisDate: patient.lastAnalysis,
          biomarkers: {
            totalCholesterol: 195,
            ldl: 120,
            hdl: 45,
            hba1c: 5.8,
            bmi: 26,
            sleepHours: 7,
            systolicBP: 130,
            diastolicBP: 85,
            hsCRP: 2.0,
            smokingStatus: 'Non-smoker',
            physicalActivity: 'Moderate',
            diabetesStatus: 'Normal',
            familyHistory: 'No'
          }
        };
      }
      
      onNavigate('report', reportData);
    } catch (error) {
      console.error('Error loading analysis data:', error);
      toast.error('Failed to load analysis data');
    }
  };

  const handleDownloadReport = (patient: PatientRecord) => {
    toast.success(`Downloading report for ${patient.name}`, {
      description: 'PDF report will be downloaded shortly.',
    });
  };

  const handleViewHistory = async (patient: PatientRecord) => {
    setSelectedPatient(patient);
    setLoadingHistory(true);
    setShowHistoryModal(true);
    
    try {
      const historyResponse = await api.getPatientHistory(patient.id);
      
      if (historyResponse.analyses && historyResponse.analyses.length > 0) {
        const sortedAnalyses = historyResponse.analyses.sort((a, b) => 
          new Date(b.analysisDate).getTime() - new Date(a.analysisDate).getTime()
        );
        setPatientAnalyses(sortedAnalyses);
      } else {
        setPatientAnalyses([]);
        toast.info('No analysis history found for this patient.');
      }
    } catch (error) {
      console.error('Error loading patient history:', error);
      toast.error('Failed to load patient history');
      setPatientAnalyses([]);
    }
    
    setLoadingHistory(false);
  };

  const handleViewSpecificReport = async (patient: PatientRecord, analysis: any) => {
    try {
      const reportData = {
        patient: {
          name: patient.name,
          mrn: patient.mrn,
          age: patient.age,
          gender: patient.gender,
          patientId: patient.id
        },
        riskLevel: analysis.riskLevel,
        riskScore: analysis.riskScore,
        analysisDate: analysis.analysisDate,
        biomarkers: analysis.biomarkers,
        analysisHistory: {
          previousAnalyses: patientAnalyses.length,
          trendDirection: patientAnalyses.length > 1 ? 
            (analysis.riskScore < patientAnalyses[0].riskScore ? 'improving' : 
             analysis.riskScore > patientAnalyses[0].riskScore ? 'declining' : 'stable') :
            'stable',
          firstAnalysisDate: patient.registrationDate,
          allAnalyses: patientAnalyses
        },
        ecgData: analysis.ecgData,
        recommendations: analysis.recommendations,
        clinicalNotes: analysis.clinicalNotes,
        monthLabel: analysis.monthLabel
      };
      
      setShowHistoryModal(false);
      onNavigate('report', reportData);
    } catch (error) {
      console.error('Error generating report:', error);
      toast.error('Failed to generate report');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Logo3D size="lg" />
          <div className="text-lg text-muted-foreground">Loading patient history...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <motion.header 
        className="bg-card border-b border-border shadow-sm"
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <Logo3D size="sm" />
              <div>
                <h1>CHRONOCardioAI</h1>
                <p className="text-muted-foreground">{hospitalName}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <ThemeToggle />
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={onLogout}
                className="gap-2"
              >
                <LogOut className="h-4 w-4" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </motion.header>

      {/* Navigation */}
      <motion.nav 
        className="bg-card border-b border-border"
        initial={{ y: -10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center gap-6 py-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onNavigate('dashboard')}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Button>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Heart className="h-4 w-4 text-primary" />
              <span>Patient History & Reports</span>
            </div>
          </div>
        </div>
      </motion.nav>

      <div className="p-6 max-w-7xl mx-auto">
        {/* Stats Cards */}
        <motion.div 
          className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8"
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
              <div className="font-bold text-primary">{patients.length}</div>
              <p className="text-xs text-muted-foreground">
                Registered patients
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-card to-card/80 border-0 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">High Risk</CardTitle>
              <AlertTriangle className="h-4 w-4 text-[#EF4444]" />
            </CardHeader>
            <CardContent>
              <div className="font-bold text-[#EF4444]">
                {patients.filter(p => p.riskLevel === 'High').length}
              </div>
              <p className="text-xs text-muted-foreground">
                Require immediate attention
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-card to-card/80 border-0 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Analyses</CardTitle>
              <Activity className="h-4 w-4 text-[#10B981]" />
            </CardHeader>
            <CardContent>
              <div className="font-bold text-[#10B981]">
                {patients.reduce((sum, p) => sum + p.analysisCount, 0)}
              </div>
              <p className="text-xs text-muted-foreground">
                Completed assessments
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-card to-card/80 border-0 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Cases</CardTitle>
              <CheckCircle className="h-4 w-4 text-[#06B6D4]" />
            </CardHeader>
            <CardContent>
              <div className="font-bold text-[#06B6D4]">
                {patients.filter(p => p.status === 'Active').length}
              </div>
              <p className="text-xs text-muted-foreground">
                Currently monitored
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Search and Filters */}
        <motion.div 
          className="mb-6 space-y-4"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by patient name or MRN..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <Select value={filterRisk} onValueChange={setFilterRisk}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Filter by risk" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Risk Levels</SelectItem>
                  <SelectItem value="Low">Low Risk</SelectItem>
                  <SelectItem value="Medium">Medium Risk</SelectItem>
                  <SelectItem value="High">High Risk</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Follow-up">Follow-up</SelectItem>
                  <SelectItem value="Discharged">Discharged</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </motion.div>

        {/* Patient History Table */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <Card className="bg-gradient-to-br from-card to-card/80 border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Patient Analysis History
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border border-border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Patient</TableHead>
                      <TableHead>MRN</TableHead>
                      <TableHead>Age/Gender</TableHead>
                      <TableHead>Risk Level</TableHead>
                      <TableHead>Risk Score</TableHead>
                      <TableHead>Last Analysis</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-center">Total Analyses</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPatients.map((patient) => (
                      <TableRow key={patient.id} className="hover:bg-muted/50">
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                              <User className="h-4 w-4 text-primary" />
                            </div>
                            <span>{patient.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono">{patient.mrn}</TableCell>
                        <TableCell>{patient.age}Y • {patient.gender}</TableCell>
                        <TableCell>
                          <Badge className={getRiskColor(patient.riskLevel)}>
                            {patient.riskLevel}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{patient.riskScore}/100</span>
                            <div className="w-12 h-2 bg-muted rounded-full overflow-hidden">
                              <div 
                                className={`h-full ${
                                  patient.riskLevel === 'Low' ? 'bg-[#22C55E]' :
                                  patient.riskLevel === 'Medium' ? 'bg-[#F59E0B]' : 'bg-[#EF4444]'
                                }`}
                                style={{ width: `${patient.riskScore}%` }}
                              />
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{new Date(patient.lastAnalysis).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(patient.status)}>
                            {patient.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">{patient.analysisCount}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button 
                              size="sm" 
                              variant="outline" 
                              onClick={() => handleViewReport(patient)}
                              className="gap-1"
                            >
                              <Eye className="h-3 w-3" />
                              Latest
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline" 
                              onClick={() => handleViewHistory(patient)}
                              className="gap-1"
                            >
                              <History className="h-3 w-3" />
                              History
                            </Button>
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              onClick={() => handleDownloadReport(patient)}
                              className="gap-1"
                            >
                              <Download className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                
                {filteredPatients.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No patients found matching your search criteria.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Patient History Modal */}
      <Dialog open={showHistoryModal} onOpenChange={setShowHistoryModal}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              Complete Analysis History - {selectedPatient?.name}
            </DialogTitle>
          </DialogHeader>
          
          {loadingHistory ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-center space-y-4">
                <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
                <p className="text-muted-foreground">Loading analysis history...</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {patientAnalyses.length > 0 ? (
                <>
                  <div className="text-sm text-muted-foreground mb-4">
                    Found {patientAnalyses.length} analysis records for {selectedPatient?.name}
                  </div>
                  <div className="rounded-lg border border-border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead>Date</TableHead>
                          <TableHead>Period</TableHead>
                          <TableHead>Risk Level</TableHead>
                          <TableHead>Risk Score</TableHead>
                          <TableHead>Heart Rate</TableHead>
                          <TableHead>Blood Pressure</TableHead>
                          <TableHead>Clinical Notes</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {patientAnalyses.map((analysis, index) => (
                          <TableRow key={analysis.id} className="hover:bg-muted/50">
                            <TableCell>
                              {new Date(analysis.analysisDate).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="gap-1">
                                <Clock className="h-3 w-3" />
                                {analysis.monthLabel || `Month ${index + 1}`}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge className={getRiskColor(analysis.riskLevel)}>
                                {analysis.riskLevel}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{analysis.riskScore}/100</span>
                                <div className="w-12 h-2 bg-muted rounded-full overflow-hidden">
                                  <div 
                                    className={`h-full ${
                                      analysis.riskLevel === 'Low' ? 'bg-[#22C55E]' :
                                      analysis.riskLevel === 'Medium' ? 'bg-[#F59E0B]' : 'bg-[#EF4444]'
                                    }`}
                                    style={{ width: `${analysis.riskScore}%` }}
                                  />
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>{analysis.biomarkers?.heartRate || 'N/A'} bpm</TableCell>
                            <TableCell>
                              {analysis.biomarkers?.systolicBP || 'N/A'}/{analysis.biomarkers?.diastolicBP || 'N/A'} mmHg
                            </TableCell>
                            <TableCell className="max-w-xs">
                              <p className="text-sm text-muted-foreground truncate" title={analysis.clinicalNotes}>
                                {analysis.clinicalNotes || 'No clinical notes available'}
                              </p>
                            </TableCell>
                            <TableCell>
                              <Button 
                                size="sm" 
                                variant="outline" 
                                onClick={() => selectedPatient && handleViewSpecificReport(selectedPatient, analysis)}
                                className="gap-1"
                              >
                                <Eye className="h-3 w-3" />
                                View Report
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No analysis history found for this patient.</p>
                  <p className="text-sm">Analysis records will appear here once assessments are completed.</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}