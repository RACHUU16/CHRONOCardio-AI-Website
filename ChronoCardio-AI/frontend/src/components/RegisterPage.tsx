import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Eye, EyeOff, Mail, Lock, Building2, Phone, MapPin, Check, X } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Checkbox } from './ui/checkbox';
import { Logo3D } from './Logo3D';
import { ThemeToggle } from './ThemeToggle';

interface RegisterPageProps {
  onRegister: (data: any) => void;
  onNavigateToLogin: () => void;
  loading?: boolean;
}

export function RegisterPage({ onRegister, onNavigateToLogin, loading = false }: RegisterPageProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formData, setFormData] = useState({
    hospitalName: '',
    location: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    agreeToTerms: false
  });
  const [passwordStrength, setPasswordStrength] = useState(0);

  const hospitals = [
    'Apollo Hospital',
    'Fortis Healthcare',
    'Max Healthcare',
    'AIIMS',
    'Medanta',
    'Manipal Hospital',
    'Narayana Health',
    'Other'
  ];

  const checkPasswordStrength = (password: string) => {
    let strength = 0;
    if (password.length >= 8) strength += 1;
    if (/[A-Z]/.test(password)) strength += 1;
    if (/[a-z]/.test(password)) strength += 1;
    if (/[0-9]/.test(password)) strength += 1;
    if (/[^A-Za-z0-9]/.test(password)) strength += 1;
    return strength;
  };

  const handlePasswordChange = (password: string) => {
    setFormData(prev => ({ ...prev, password }));
    setPasswordStrength(checkPasswordStrength(password));
  };

  const generatePatientId = () => {
    return 'CHR' + Math.random().toString(36).substr(2, 9).toUpperCase();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.agreeToTerms || !passwordMatch || passwordStrength < 3) {
      return;
    }
    
    const registrationData = {
      ...formData,
      patientId: generatePatientId(),
      registeredAt: new Date().toISOString()
    };
    
    onRegister(registrationData);
  };

  const passwordMatch = formData.password === formData.confirmPassword && formData.confirmPassword !== '';
  const canSubmit = formData.agreeToTerms && passwordMatch && passwordStrength >= 3;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-card to-background flex items-center justify-center p-8">
      <motion.div
        className="w-full max-w-md"
        initial={{ x: 100, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.2 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <Logo3D size="md" />
          <ThemeToggle />
        </div>

        <Card className="border-border/50 shadow-xl">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold">Join CHRONOCardioAI</CardTitle>
            <CardDescription>
              Create your hospital account to get started
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="hospitalName">Hospital Name</Label>
                  <Select onValueChange={(value) => setFormData(prev => ({ ...prev, hospitalName: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select hospital" />
                    </SelectTrigger>
                    <SelectContent>
                      {hospitals.map(hospital => (
                        <SelectItem key={hospital} value={hospital}>
                          {hospital}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="location">Location</Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="location"
                      placeholder="City, State"
                      value={formData.location}
                      onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="admin@hospital.com"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+1 (555) 123-4567"
                    value={formData.phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Create a strong password"
                    value={formData.password}
                    onChange={(e) => handlePasswordChange(e.target.value)}
                    className="pl-10 pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                
                {/* Password Strength Indicator */}
                {formData.password && (
                  <div className="space-y-1">
                    <div className="flex gap-1">
                      {[...Array(5)].map((_, i) => (
                        <div
                          key={i}
                          className={`h-1 flex-1 rounded-full ${
                            i < passwordStrength 
                              ? passwordStrength <= 2 ? 'bg-destructive' 
                                : passwordStrength <= 3 ? 'bg-yellow-500' 
                                : 'bg-green-500'
                              : 'bg-border'
                          }`}
                        />
                      ))}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Password strength: {
                        passwordStrength <= 2 ? 'Weak' :
                        passwordStrength <= 3 ? 'Medium' : 'Strong'
                      }
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Confirm your password"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                    className="pl-10 pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                
                {formData.confirmPassword && (
                  <div className="flex items-center gap-2 text-xs">
                    {passwordMatch ? (
                      <>
                        <Check className="w-3 h-3 text-green-500" />
                        <span className="text-green-500">Passwords match</span>
                      </>
                    ) : (
                      <>
                        <X className="w-3 h-3 text-destructive" />
                        <span className="text-destructive">Passwords don't match</span>
                      </>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="terms"
                  checked={formData.agreeToTerms}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, agreeToTerms: checked as boolean }))}
                />
                <Label htmlFor="terms" className="text-sm">
                  I agree to the{' '}
                  <button type="button" className="text-primary hover:underline">
                    Terms of Service
                  </button>{' '}
                  and{' '}
                  <button type="button" className="text-primary hover:underline">
                    Privacy Policy
                  </button>
                </Label>
              </div>

              <Button
                type="submit"
                className="w-full bg-secondary hover:bg-secondary/90"
                disabled={!canSubmit || loading}
              >
                {loading ? (
                  <motion.div
                    className="w-4 h-4 border-2 border-current border-t-transparent rounded-full"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  />
                ) : (
                  'Create Account'
                )}
              </Button>

              <div className="text-center">
                <span className="text-sm text-muted-foreground">
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={onNavigateToLogin}
                    className="text-primary hover:underline"
                  >
                    Sign in
                  </button>
                </span>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="mt-8 text-center text-xs text-muted-foreground">
          <p>By registering, you agree to our healthcare data protection standards</p>
        </div>
      </motion.div>
    </div>
  );
}