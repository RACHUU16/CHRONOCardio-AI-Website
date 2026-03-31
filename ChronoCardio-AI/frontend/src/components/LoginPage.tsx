import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Eye, EyeOff, Mail, Lock, Send } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from './ui/dialog';
import { Logo3D } from './Logo3D';
import { ThemeToggle } from './ThemeToggle';
import { api } from '../utils/supabase/client';
import { toast } from 'sonner';

interface LoginPageProps {
  onLogin: (email: string, password: string) => void;
  onNavigateToRegister: () => void;
  loading?: boolean;
}

export function LoginPage({ onLogin, onNavigateToRegister, loading = false }: LoginPageProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.email || !formData.password) {
      return;
    }
    
    onLogin(formData.email, formData.password);
  };

  const handleForgotPassword = async () => {
    if (!forgotPasswordEmail) {
      toast.error('Please enter your email address');
      return;
    }

    setForgotPasswordLoading(true);
    const result = await api.resetPassword(forgotPasswordEmail);
    setForgotPasswordLoading(false);

    if (result.error) {
      toast.error(result.error);
    } else {
      setResetEmailSent(true);
      toast.success('Password reset email sent! Check your inbox.');
    }
  };

  const handleCloseForgotPassword = () => {
    setShowForgotPassword(false);
    setForgotPasswordEmail('');
    setResetEmailSent(false);
  };

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
            <CardTitle className="text-2xl font-bold">Welcome Back</CardTitle>
            <CardDescription>
              Sign in to your CHRONOCardioAI account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="doctor@hospital.com"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
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
                    placeholder="Enter your password"
                    value={formData.password}
                    onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
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
              </div>

              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setShowForgotPassword(true)}
                  className="text-sm text-primary hover:underline"
                >
                  Forgot password?
                </button>
              </div>

              <Button
                type="submit"
                className="w-full bg-primary hover:bg-primary/90"
                disabled={loading}
              >
                {loading ? (
                  <motion.div
                    className="w-4 h-4 border-2 border-current border-t-transparent rounded-full"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  />
                ) : (
                  'Sign In'
                )}
              </Button>

              <div className="text-center">
                <span className="text-sm text-muted-foreground">
                  New to CHRONOCardioAI?{' '}
                  <button
                    type="button"
                    onClick={onNavigateToRegister}
                    className="text-primary hover:underline"
                  >
                    Create account
                  </button>
                </span>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Forgot Password Dialog */}
        <Dialog open={showForgotPassword} onOpenChange={setShowForgotPassword}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Reset Password</DialogTitle>
              <DialogDescription>
                {resetEmailSent 
                  ? "We've sent a password reset link to your email address. Please check your inbox and follow the instructions."
                  : "Enter your email address and we'll send you a link to reset your password."}
              </DialogDescription>
            </DialogHeader>
            
            {!resetEmailSent ? (
              <>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="reset-email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="reset-email"
                        type="email"
                        placeholder="doctor@hospital.com"
                        value={forgotPasswordEmail}
                        onChange={(e) => setForgotPasswordEmail(e.target.value)}
                        className="pl-10"
                        disabled={forgotPasswordLoading}
                      />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={handleCloseForgotPassword}
                    disabled={forgotPasswordLoading}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleForgotPassword}
                    disabled={forgotPasswordLoading || !forgotPasswordEmail}
                    className="gap-2"
                  >
                    {forgotPasswordLoading ? (
                      <motion.div
                        className="w-4 h-4 border-2 border-current border-t-transparent rounded-full"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      />
                    ) : (
                      <>
                        <Send className="h-4 w-4" />
                        Send Reset Link
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </>
            ) : (
              <DialogFooter>
                <Button onClick={handleCloseForgotPassword} className="w-full">
                  Close
                </Button>
              </DialogFooter>
            )}
          </DialogContent>
        </Dialog>
      </motion.div>
    </div>
  );
}