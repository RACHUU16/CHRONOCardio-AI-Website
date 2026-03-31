import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Eye, EyeOff, Lock, CheckCircle } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Logo3D } from './Logo3D';
import { ThemeToggle } from './ThemeToggle';
import { supabase, api } from '../utils/supabase/client';
import { toast } from 'sonner';

interface ResetPasswordPageProps {
  onPasswordReset?: () => void;
}

export function ResetPasswordPage({ onPasswordReset }: ResetPasswordPageProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [isValidSession, setIsValidSession] = useState<boolean | null>(null);
  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: ''
  });

  useEffect(() => {
    // Check if user has a valid session (set from the email link)
    const checkResetToken = async () => {
      try {
        // First, check if there's a token in the URL query params
        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get('token');
        const type = urlParams.get('type');
        
        console.log('ResetPasswordPage: Checking token...');
        console.log('Token present:', !!token);
        console.log('Type:', type);
        console.log('Full URL:', window.location.href);
        
        if (type === 'recovery' && token) {
          console.log('Found recovery token in URL, processing...');
          setIsValidSession(null); // Show loading state
          
          // Try verifyOtp first
          try {
            console.log('Attempting verifyOtp with token...');
            const { data, error } = await supabase.auth.verifyOtp({
              token_hash: token,
              type: 'recovery'
            });
            
            if (!error && data.session) {
              console.log('✅ Token verified successfully via verifyOtp');
              window.history.replaceState({}, '', '/reset-password');
              setIsValidSession(true);
              return;
            }
            
            console.log('verifyOtp failed:', error?.message);
            
            // If verifyOtp fails, the token might be in a different format
            // Try checking if Supabase has set a session via cookies
            const { data: { session: cookieSession } } = await supabase.auth.getSession();
            if (cookieSession) {
              console.log('✅ Session found via cookies');
              window.history.replaceState({}, '', '/reset-password');
              setIsValidSession(true);
              return;
            }
            
            // If both fail, show error but stay on the page
            console.error('Token verification failed:', error);
            setIsValidSession(false);
            toast.error('Unable to verify reset link. The token may be invalid or expired. Please request a new password reset.', {
              duration: 6000
            });
            // Don't redirect immediately - let user see the error
            return;
            
          } catch (verifyError: any) {
            console.error('Error in token verification:', verifyError);
            setIsValidSession(false);
            toast.error('Failed to verify reset link. Please try again or request a new one.', {
              duration: 5000
            });
            return;
          }
        }
        
        // Check for existing session (from hash parameters processed by App.tsx)
        console.log('Checking for existing session...');
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Session check error:', error);
          setIsValidSession(false);
          toast.error('Invalid or expired reset link. Please request a new one.');
          // Don't redirect immediately
          return;
        }
        
        if (!session) {
          console.log('No session found');
          setIsValidSession(false);
          toast.error('Invalid or expired reset link. Please request a new one.');
          // Don't redirect immediately - show error on page
          return;
        }
        
        // Session is valid
        console.log('Valid session found');
        setIsValidSession(true);
      } catch (error) {
        console.error('Error checking session:', error);
        setIsValidSession(false);
        toast.error('Failed to verify reset link. Please try again.');
      }
    };
    
    checkResetToken();
  }, [onPasswordReset]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.password || !formData.confirmPassword) {
      toast.error('Please fill in all fields');
      return;
    }

    if (formData.password.length < 6) {
      toast.error('Password must be at least 6 characters long');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setLoading(true);
    const result = await api.updatePassword(formData.password);
    setLoading(false);

    if (result.error) {
      toast.error(result.error);
    } else {
      setSuccess(true);
      toast.success('Password reset successfully!');
      
      // Sign out the recovery session and redirect to login
      await supabase.auth.signOut();
      
      // Redirect to login after 2 seconds
      setTimeout(() => {
        if (onPasswordReset) {
          onPasswordReset();
        } else {
          window.location.href = '/';
        }
      }, 2000);
    }
  };

  // Show loading state while checking session
  if (isValidSession === null) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-card to-background flex items-center justify-center p-8">
        <motion.div
          className="w-full max-w-md"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          <Card className="border-border/50 shadow-xl">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center justify-center space-y-4 py-8">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full"
                />
                <p className="text-muted-foreground">Verifying reset link...</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  // Show error if session is invalid
  if (isValidSession === false) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-card to-background flex items-center justify-center p-8">
        <motion.div
          className="w-full max-w-md"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          <Card className="border-border/50 shadow-xl">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center justify-center space-y-4 py-8">
                <div className="text-center space-y-2">
                  <h3 className="text-xl font-semibold text-destructive">Invalid Reset Link</h3>
                  <p className="text-muted-foreground">
                    The password reset link is invalid or has expired. Please request a new one.
                  </p>
                  <div className="flex gap-2 mt-4">
                    <Button
                      variant="outline"
                      onClick={() => {
                        if (onPasswordReset) {
                          onPasswordReset();
                        } else {
                          window.location.href = '/';
                        }
                      }}
                    >
                      Go to Login
                    </Button>
                    <Button
                      onClick={() => {
                        // Clear URL and reload to try again
                        window.location.href = '/';
                      }}
                    >
                      Request New Link
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-card to-background flex items-center justify-center p-8">
        <motion.div
          className="w-full max-w-md"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          <Card className="border-border/50 shadow-xl">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center justify-center space-y-4 py-8">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: "spring" }}
                >
                  <CheckCircle className="h-16 w-16 text-green-500" />
                </motion.div>
                <div className="text-center space-y-2">
                  <h3 className="text-xl font-semibold">Password Reset Successful!</h3>
                  <p className="text-muted-foreground">
                    Your password has been updated. Redirecting to login...
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

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
            <CardTitle className="text-2xl font-bold">Reset Password</CardTitle>
            <CardDescription>
              Enter your new password below
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">New Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter new password"
                    value={formData.password}
                    onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                    className="pl-10 pr-10"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Password must be at least 6 characters long
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Confirm new password"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                    className="pl-10 pr-10"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
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
                  'Reset Password'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
