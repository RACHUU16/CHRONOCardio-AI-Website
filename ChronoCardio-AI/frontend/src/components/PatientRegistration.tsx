import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Checkbox } from './ui/checkbox';
import { Badge } from './ui/badge';
import { Logo3D } from './Logo3D';
import { ThemeToggle } from './ThemeToggle';
import { 
  ArrowLeft, 
  UserPlus, 
  Save, 
  MapPin, 
  Phone, 
  Mail, 
  User,
  Calendar,
  LogOut,
  Heart
} from 'lucide-react';

interface PatientRegistrationProps {
  hospitalName: string;
  onNavigate: (page: string) => void;
  onLogout: () => void;
  onRegisterPatient: (patientData: any) => void;
  loading?: boolean;
}

interface PatientData {
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
}

const medicalConditions = [
  'Diabetes', 'Hypertension', 'Hyperlipidemia', 'Previous MI', 'Stroke',
  'COPD', 'Kidney Disease', 'Peripheral Artery Disease', 'Atrial Fibrillation',
  'Heart Failure', 'Obesity', 'Sleep Apnea'
];

const indianStates = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya',
  'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim',
  'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal'
];

export function PatientRegistration({ hospitalName, onNavigate, onLogout, onRegisterPatient, loading = false }: PatientRegistrationProps) {
  const [formData, setFormData] = useState<PatientData>({
    firstName: '',
    lastName: '',
    age: '',
    gender: '',
    contactNo: '',
    email: '',
    state: '',
    district: '',
    city: '',
    pincode: '',
    mrn: `MRN${Date.now()}`, // Auto-generated MRN
    existingConditions: []
  });

  const handleInputChange = (field: keyof PatientData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleConditionToggle = (condition: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      existingConditions: checked 
        ? [...prev.existingConditions, condition]
        : prev.existingConditions.filter(c => c !== condition)
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onRegisterPatient(formData);
    // Reset form
    setFormData({
      firstName: '',
      lastName: '',
      age: '',
      gender: '',
      contactNo: '',
      email: '',
      state: '',
      district: '',
      city: '',
      pincode: '',
      mrn: `MRN${Date.now()}`,
      existingConditions: []
    });
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
              <p className="text-sm text-muted-foreground">Patient Registration System</p>
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
            <UserPlus className="h-3 w-3" />
            New Patient Registration
          </Badge>
        </div>
      </motion.nav>

      <div className="p-6 max-w-4xl mx-auto">
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <Card className="bg-gradient-to-br from-card to-card/80 border-0 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-primary/5 to-accent/5 rounded-t-lg">
              <CardTitle className="flex items-center gap-2">
                <Heart className="h-5 w-5 text-primary" />
                Patient Registration Form
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Personal Information */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-primary flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Personal Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="firstName">First Name *</Label>
                      <Input
                        id="firstName"
                        value={formData.firstName}
                        onChange={(e) => handleInputChange('firstName', e.target.value)}
                        placeholder="Enter first name"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName">Last Name *</Label>
                      <Input
                        id="lastName"
                        value={formData.lastName}
                        onChange={(e) => handleInputChange('lastName', e.target.value)}
                        placeholder="Enter last name"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="age">Age *</Label>
                      <Input
                        id="age"
                        type="number"
                        value={formData.age}
                        onChange={(e) => handleInputChange('age', e.target.value)}
                        placeholder="Enter age"
                        min="1"
                        max="120"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="gender">Gender *</Label>
                      <Select value={formData.gender} onValueChange={(value) => handleInputChange('gender', value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select gender" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="male">Male</SelectItem>
                          <SelectItem value="female">Female</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* Contact Information */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-primary flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    Contact Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="contactNo">Contact Number *</Label>
                      <Input
                        id="contactNo"
                        type="tel"
                        value={formData.contactNo}
                        onChange={(e) => handleInputChange('contactNo', e.target.value)}
                        placeholder="Enter contact number"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email Address</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => handleInputChange('email', e.target.value)}
                        placeholder="Enter email address"
                      />
                    </div>
                  </div>
                </div>

                {/* Address Information */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-primary flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Address Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="state">State *</Label>
                      <Select value={formData.state} onValueChange={(value) => handleInputChange('state', value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select state" />
                        </SelectTrigger>
                        <SelectContent>
                          {indianStates.map(state => (
                            <SelectItem key={state} value={state}>{state}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="district">District *</Label>
                      <Input
                        id="district"
                        value={formData.district}
                        onChange={(e) => handleInputChange('district', e.target.value)}
                        placeholder="Enter district"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="city">City *</Label>
                      <Input
                        id="city"
                        value={formData.city}
                        onChange={(e) => handleInputChange('city', e.target.value)}
                        placeholder="Enter city"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="pincode">Pincode *</Label>
                      <Input
                        id="pincode"
                        value={formData.pincode}
                        onChange={(e) => handleInputChange('pincode', e.target.value)}
                        placeholder="Enter pincode"
                        pattern="[0-9]{6}"
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Medical Information */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-primary flex items-center gap-2">
                    <Heart className="h-4 w-4" />
                    Medical Information
                  </h3>
                  <div className="space-y-2">
                    <Label>Medical Record Number (Auto-generated)</Label>
                    <Input value={formData.mrn} disabled className="bg-muted" />
                  </div>
                  <div className="space-y-2">
                    <Label>Existing Medical Conditions</Label>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 p-4 border rounded-lg">
                      {medicalConditions.map(condition => (
                        <div key={condition} className="flex items-center space-x-2">
                          <Checkbox
                            id={condition}
                            checked={formData.existingConditions.includes(condition)}
                            onCheckedChange={(checked) => 
                              handleConditionToggle(condition, checked as boolean)
                            }
                          />
                          <Label htmlFor={condition} className="text-sm font-normal">
                            {condition}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex justify-between pt-6 border-t">
                  <Button type="button" variant="outline" onClick={() => onNavigate('dashboard')}>
                    Cancel
                  </Button>
                  <Button type="submit" className="gap-2" disabled={loading}>
                    {loading ? (
                      <motion.div
                        className="w-4 h-4 border-2 border-current border-t-transparent rounded-full"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    {loading ? 'Registering...' : 'Register Patient'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}