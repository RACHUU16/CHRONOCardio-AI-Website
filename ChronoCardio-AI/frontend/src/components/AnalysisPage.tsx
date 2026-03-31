import React, { useState, useEffect } from 'react';
import { api, generateECGFindings } from '../utils/supabase/client';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { Logo3D } from './Logo3D';
import { ThemeToggle } from './ThemeToggle';
import { 
  ArrowLeft, 
  User, 
  Search,
  Calendar,
  Upload,
  Activity,
  Brain,
  LogOut,
  FileText,
  Stethoscope,
  TrendingUp
} from 'lucide-react';

interface AnalysisPageProps {
  hospitalName: string;
  patients: any[];
  onNavigate: (page: string, data?: any) => void;
  onLogout: () => void;
}

interface BiomarkerData {
  // Demographics
  bmi: string;
  smokingStatus: string;
  diabetes: string;
  familyHistory: string;
  comorbidities: string;
  physicalActivity: string;
  dietQuality: string;
  stressLevel: string;
  sleepHours: string;
  
  // Clinical
  cholesterol: string;
  ldl: string;
  hdl: string;
  systolicBp: string;
  diastolicBp: string;
  hsCrp: string;
  hba1c: string;
  
  // ECG
  ecgImage: File | null;
}

export function AnalysisPage({ hospitalName, patients, onNavigate, onLogout }: AnalysisPageProps) {
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [biomarkers, setBiomarkers] = useState<BiomarkerData>({
    bmi: '',
    smokingStatus: '',
    diabetes: '',
    familyHistory: '',
    comorbidities: '',
    physicalActivity: '',
    dietQuality: '',
    stressLevel: '',
    sleepHours: '',
    cholesterol: '',
    ldl: '',
    hdl: '',
    systolicBp: '',
    diastolicBp: '',
    hsCrp: '',
    hba1c: '',
    ecgImage: null
  });

  const filteredPatients = patients.filter(patient => 
    `${patient.firstName} ${patient.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    patient.mrn.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleBiomarkerChange = (field: keyof BiomarkerData, value: string) => {
    setBiomarkers(prev => ({ ...prev, [field]: value }));
  };

  const handleEcgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setBiomarkers(prev => ({ ...prev, ecgImage: file }));
  };

  const handleStartAnalysis = async () => {
    if (!selectedPatient || !selectedMonth) {
      toast.error('Please select patient and month');
      return;
    }
    if (!biomarkers.ecgImage) {
      toast.error('Please upload an ECG image');
      return;
    }

    try {
      // Prevent duplicate analysis for the same month for this patient
      try {
        const history = await api.getPatientHistory(selectedPatient.id);
        const analyses = Array.isArray(history.analyses) ? history.analyses : [];
        const monthExists = analyses.some((a: any) => Number(a.monthNumber) === Number(selectedMonth));
        if (monthExists) {
          toast.info('Analysis already done for this month', {
            description: 'You can view the previous analysis in Patient History.',
          });
          return;
        }
      } catch (_) {
        // If history fetch fails, allow analysis to proceed
      }

      const formData = new FormData();
      formData.append('ecgImage', biomarkers.ecgImage);
      formData.append('patientId', selectedPatient.id);
      formData.append('month', String(selectedMonth));
      formData.append('biomarkers', JSON.stringify({
        bmi: biomarkers.bmi,
        smokingStatus: biomarkers.smokingStatus,
        diabetes: biomarkers.diabetes,
        familyHistory: biomarkers.familyHistory,
        comorbidities: biomarkers.comorbidities,
        physicalActivity: biomarkers.physicalActivity,
        dietQuality: biomarkers.dietQuality,
        stressLevel: biomarkers.stressLevel,
        sleepHours: biomarkers.sleepHours,
        cholesterol: biomarkers.cholesterol,
        ldl: biomarkers.ldl,
        hdl: biomarkers.hdl,
        systolicBp: biomarkers.systolicBp,
        diastolicBp: biomarkers.diastolicBp,
        hsCrp: biomarkers.hsCrp,
        hba1c: biomarkers.hba1c,
      }));

      const resp = await api.createAnalysis(formData);
      if (resp.error) {
        toast.error('Analysis failed', { description: resp.error });
        return;
      }
      if (resp.db && resp.db.saved === false) {
        toast.warning('Analysis saved locally, but DB insert failed', {
          description: resp.db.error || 'Unknown database error',
        });
      }

      // Compose analysisData with a dynamic ECG summary derived from the backend prediction
      const ecgData = {
        findings: Array.isArray(resp?.record?.ecgFindings) ? resp.record.ecgFindings : generateECGFindings(resp?.prediction?.riskLevel || resp?.record?.riskLevel || 'Medium'),
        heartRate: resp?.record?.heartRate || undefined,
        fileName: resp?.record?.ecgFileName || resp?.record?.fileName || null,
        prediction: resp?.prediction || null,
      };

      const analysisData = {
        patient: selectedPatient,
        month: selectedMonth,
        biomarkers,
        timestamp: new Date().toISOString(),
        backend: resp,
        ecgData,
      };

      // Dispatch a global event so other components (Dashboard) can react and refresh
      try {
        window.dispatchEvent(new CustomEvent('analysis:completed', { detail: { patientId: selectedPatient.id, analysis: analysisData } }));
      } catch (_) {}

      onNavigate('analysis-results', analysisData);
    } catch (e) {
      toast.error('Unexpected error running analysis');
    }
  };

  const months = [
    '1st Month', '2nd Month', '3rd Month', '4th Month', '5th Month', '6th Month',
    '7th Month', '8th Month', '9th Month', '10th Month', '11th Month', '12th Month'
  ];

  // Determine which months already have analyses for the selected patient
  const [completedMonths, setCompletedMonths] = useState<number[]>([]);

  useEffect(() => {
    const loadCompleted = async () => {
      if (!selectedPatient) { setCompletedMonths([]); return; }
      try {
        const history = await api.getPatientHistory(selectedPatient.id);
        const arr = Array.isArray(history.analyses) ? history.analyses : [];
        const monthsSet = new Set<number>();
        arr.forEach((a: any) => { if (a.monthNumber) monthsSet.add(Number(a.monthNumber)); });
        setCompletedMonths(Array.from(monthsSet));
      } catch (_) {
        setCompletedMonths([]);
      }
    };
    loadCompleted();
  }, [selectedPatient]);

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
              <p className="text-sm text-muted-foreground">AI Risk Analysis System</p>
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
          <Button variant="ghost" onClick={() => onNavigate('dashboard')} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Button>
          <div className="h-4 w-px bg-border" />
          <Badge variant="secondary" className="gap-1">
            <Activity className="h-3 w-3" />
            Cardiovascular Risk Analysis
          </Badge>
        </div>
      </motion.nav>

      <div className="p-6 max-w-6xl mx-auto">
        {!selectedPatient ? (
          /* Patient Selection */
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <Card className="bg-gradient-to-br from-card to-card/80 border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5 text-primary" />
                  Select Patient for Analysis
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search by patient name or MRN..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  
                  <div className="grid gap-3 max-h-96 overflow-y-auto">
                    {filteredPatients.map((patient, index) => (
                      <motion.div
                        key={patient.mrn}
                        className="p-4 border border-border rounded-lg cursor-pointer hover:bg-accent/50 transition-colors"
                        onClick={() => setSelectedPatient(patient)}
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium">{patient.firstName} {patient.lastName}</div>
                            <div className="text-sm text-muted-foreground">
                              {patient.age} years • {patient.gender} • {patient.mrn}
                            </div>
                            {patient.existingConditions.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {patient.existingConditions.slice(0, 3).map((condition: string) => (
                                  <Badge key={condition} variant="outline" className="text-xs">
                                    {condition}
                                  </Badge>
                                ))}
                                {patient.existingConditions.length > 3 && (
                                  <Badge variant="outline" className="text-xs">
                                    +{patient.existingConditions.length - 3} more
                                  </Badge>
                                )}
                              </div>
                            )}
                          </div>
                          <Button size="sm" variant="outline">Select</Button>
                        </div>
                      </motion.div>
                    ))}
                    {filteredPatients.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        No patients found matching your search.
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ) : !selectedMonth ? (
          /* Month Selection */
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            <Card className="bg-gradient-to-br from-card to-card/80 border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-primary" />
                  Select Analysis Month - {selectedPatient.firstName} {selectedPatient.lastName}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 mb-6">
                  <Button variant="outline" onClick={() => setSelectedPatient(null)}>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Change Patient
                  </Button>
                  <Badge variant="secondary">MRN: {selectedPatient.mrn}</Badge>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {months.map((month, index) => (
                    <motion.div
                      key={month}
                      className={`p-4 border border-border rounded-lg transition-colors text-center ${completedMonths.includes(index + 1) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-accent/50'}`}
                      onClick={() => {
                        if (completedMonths.includes(index + 1)) {
                          toast.info('Analysis already done for this month', { description: 'Choose a different month.' });
                          return;
                        }
                        setSelectedMonth(index + 1);
                      }}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <Calendar className="h-6 w-6 mx-auto mb-2 text-primary" />
                      <div className="font-medium">{month}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {completedMonths.includes(index + 1) ? 'Already analyzed' : 'Click to select'}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          /* Biomarker Input Form */
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            <Card className="bg-gradient-to-br from-card to-card/80 border-0 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-primary/5 to-accent/5 rounded-t-lg">
                <CardTitle className="flex items-center gap-2">
                  <Stethoscope className="h-5 w-5 text-primary" />
                  Biomarker Analysis - {selectedPatient.firstName} {selectedPatient.lastName} ({months[selectedMonth - 1]})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="flex items-center gap-4 mb-6">
                  <Button variant="outline" onClick={() => setSelectedMonth(null)}>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Change Month
                  </Button>
                  <Badge variant="secondary">MRN: {selectedPatient.mrn}</Badge>
                  <Badge variant="outline">{months[selectedMonth - 1]}</Badge>
                </div>

                <div className="space-y-8">
                  {/* Demographics Section */}
                  <div className="space-y-4">
                    <h3 className="font-semibold text-primary flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Demographics & Lifestyle
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="bmi">BMI</Label>
                        <Input
                          id="bmi"
                          type="number"
                          step="0.1"
                          placeholder="25.0"
                          value={biomarkers.bmi}
                          onChange={(e) => handleBiomarkerChange('bmi', e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="smokingStatus">Smoking Status</Label>
                        <Select value={biomarkers.smokingStatus} onValueChange={(value) => handleBiomarkerChange('smokingStatus', value)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="never">Never</SelectItem>
                            <SelectItem value="former">Former</SelectItem>
                            <SelectItem value="current">Current</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="diabetes">Diabetes</Label>
                        <Select value={biomarkers.diabetes} onValueChange={(value) => handleBiomarkerChange('diabetes', value)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="no">No</SelectItem>
                            <SelectItem value="type1">Type 1</SelectItem>
                            <SelectItem value="type2">Type 2</SelectItem>
                            <SelectItem value="prediabetes">Pre-diabetes</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="familyHistory">Family History (CVD)</Label>
                        <Select value={biomarkers.familyHistory} onValueChange={(value) => handleBiomarkerChange('familyHistory', value)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="no">No</SelectItem>
                            <SelectItem value="yes">Yes</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="physicalActivity">Physical Activity (hrs/week)</Label>
                        <Input
                          id="physicalActivity"
                          type="number"
                          step="0.5"
                          placeholder="2.5"
                          value={biomarkers.physicalActivity}
                          onChange={(e) => handleBiomarkerChange('physicalActivity', e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="sleepHours">Sleep (hours/night)</Label>
                        <Input
                          id="sleepHours"
                          type="number"
                          step="0.5"
                          placeholder="7.0"
                          value={biomarkers.sleepHours}
                          onChange={(e) => handleBiomarkerChange('sleepHours', e.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Clinical Biomarkers */}
                  <div className="space-y-4">
                    <h3 className="font-semibold text-primary flex items-center gap-2">
                      <Activity className="h-4 w-4" />
                      Clinical Biomarkers
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="cholesterol">Total Cholesterol (mg/dL)</Label>
                        <Input
                          id="cholesterol"
                          type="number"
                          placeholder="200"
                          value={biomarkers.cholesterol}
                          onChange={(e) => handleBiomarkerChange('cholesterol', e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="ldl">LDL Cholesterol (mg/dL)</Label>
                        <Input
                          id="ldl"
                          type="number"
                          placeholder="100"
                          value={biomarkers.ldl}
                          onChange={(e) => handleBiomarkerChange('ldl', e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="hdl">HDL Cholesterol (mg/dL)</Label>
                        <Input
                          id="hdl"
                          type="number"
                          placeholder="50"
                          value={biomarkers.hdl}
                          onChange={(e) => handleBiomarkerChange('hdl', e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="systolicBp">Systolic BP (mmHg)</Label>
                        <Input
                          id="systolicBp"
                          type="number"
                          placeholder="120"
                          value={biomarkers.systolicBp}
                          onChange={(e) => handleBiomarkerChange('systolicBp', e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="diastolicBp">Diastolic BP (mmHg)</Label>
                        <Input
                          id="diastolicBp"
                          type="number"
                          placeholder="80"
                          value={biomarkers.diastolicBp}
                          onChange={(e) => handleBiomarkerChange('diastolicBp', e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="hsCrp">hs-CRP (mg/L)</Label>
                        <Input
                          id="hsCrp"
                          type="number"
                          step="0.1"
                          placeholder="1.0"
                          value={biomarkers.hsCrp}
                          onChange={(e) => handleBiomarkerChange('hsCrp', e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="hba1c">HbA1c (%)</Label>
                        <Input
                          id="hba1c"
                          type="number"
                          step="0.1"
                          placeholder="5.7"
                          value={biomarkers.hba1c}
                          onChange={(e) => handleBiomarkerChange('hba1c', e.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  {/* ECG Upload */}
                  <div className="space-y-4">
                    <h3 className="font-semibold text-primary flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" />
                      ECG Analysis
                    </h3>
                    <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
                      <Upload className="h-8 w-8 mx-auto mb-4 text-muted-foreground" />
                      <div className="space-y-2">
                        <Label htmlFor="ecgUpload" className="cursor-pointer text-primary hover:text-primary/80">
                          Upload ECG Image
                        </Label>
                        <Input
                          id="ecgUpload"
                          type="file"
                          accept="image/*"
                          onChange={handleEcgUpload}
                          className="hidden"
                        />
                        {biomarkers.ecgImage && (
                          <div className="mt-2 text-sm text-muted-foreground">
                            Selected: {biomarkers.ecgImage.name}
                          </div>
                        )}
                        <p className="text-xs text-muted-foreground">
                          Supported formats: JPG, PNG, PDF. Max size: 5MB
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex justify-between pt-6 border-t">
                    <Button variant="outline" onClick={() => setSelectedMonth(null)}>
                      Back
                    </Button>
                    <Button onClick={handleStartAnalysis} className="gap-2" size="lg">
                      <Brain className="h-4 w-4" />
                      Start AI Analysis
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>
    </div>
  );
}