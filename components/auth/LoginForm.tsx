'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { User, Lock, ArrowRight, Mail, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { authAPI } from '@/lib/api';
import { useToast } from '@/components/ui/ToastProvider';

interface LoginFormProps {
  onSwitchToRegister?: () => void;
}

export default function LoginForm({ onSwitchToRegister }: LoginFormProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [formData, setFormData] = useState({
    username: '',
    password: '',
  });
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const validate = () => {
    const newErrors: { [key: string]: string } = {};

    if (!formData.username.trim()) {
      newErrors.username = 'Username is required';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    setIsLoading(true);
    try {
      const response = await authAPI.login(formData.username, formData.password);
      
      const token = localStorage.getItem('auth_token');
      if (!token) {
        throw new Error('Token was not saved. Please try again.');
      }
      
      if (response.user) {
        localStorage.setItem('user_info', JSON.stringify(response.user));
        if (response.user.id) {
          localStorage.setItem('user_id', response.user.id);
        }
      } else if (response.id) {
        localStorage.setItem('user_id', response.id);
        localStorage.setItem('user_info', JSON.stringify({
          id: response.id,
          username: formData.username,
          role: 'User',
          zone: 'zone1',
        }));
      } else {
        localStorage.setItem('user_info', JSON.stringify({
          username: formData.username,
          role: 'User',
          zone: 'zone1',
        }));
      }
      
      showToast('User logged in successfully', 'success');
      
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 800);
    } catch (error: any) {
      setErrors({
        submit: error.response?.data?.detail || 'Login failed. Please check your credentials.',
      });
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full">
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-white mb-2 gradient-text">Welcome Back</h2>
        <p className="text-white/60">Sign in to continue to your account</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-semibold text-white/90 mb-2">
            Username
          </label>
          <div className="relative group">
            <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-neon-green/60 group-focus-within:text-neon-green transition-colors">
              <User size={20} />
            </div>
            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={handleChange}
              placeholder="Enter your username"
              autoComplete="username"
              className={`w-full pl-12 pr-4 py-3.5 bg-cyber-900/50 border-2 rounded-xl focus:outline-none transition-all text-white placeholder:text-white/30 ${
                errors.username 
                  ? 'border-neon-orange/50 focus:border-neon-orange focus:ring-4 focus:ring-neon-orange/20' 
                  : 'border-neon-green/20 focus:border-neon-green focus:ring-4 focus:ring-neon-green/20'
              }`}
            />
          </div>
          {errors.username && (
            <p className="mt-2 text-sm text-neon-orange flex items-center gap-1">
              <span>⚠</span> {errors.username}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-semibold text-white/90 mb-2">
            Password
          </label>
          <div className="relative group">
            <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-neon-green/60 group-focus-within:text-neon-green transition-colors">
              <Lock size={20} />
            </div>
            <input
              type={showPassword ? 'text' : 'password'}
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Enter your password"
              autoComplete="current-password"
              className={`w-full pl-12 pr-12 py-3.5 bg-cyber-900/50 border-2 rounded-xl focus:outline-none transition-all text-white placeholder:text-white/30 ${
                errors.password 
                  ? 'border-neon-orange/50 focus:border-neon-orange focus:ring-4 focus:ring-neon-orange/20' 
                  : 'border-neon-green/20 focus:border-neon-green focus:ring-4 focus:ring-neon-green/20'
              }`}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 transform -translate-y-1/2 text-white/40 hover:text-neon-green transition-colors"
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
          {errors.password && (
            <p className="mt-2 text-sm text-neon-orange flex items-center gap-1">
              <span>⚠</span> {errors.password}
            </p>
          )}
        </div>

        {errors.submit && (
          <div className="p-4 bg-neon-orange/10 border-2 border-neon-orange/30 rounded-xl backdrop-blur-sm">
            <p className="text-neon-orange text-sm font-medium">{errors.submit}</p>
          </div>
        )}

        <Button
          type="submit"
          variant="primary"
          size="lg"
          isLoading={isLoading}
          className="w-full bg-gradient-to-r from-neon-green to-neon-cyan hover:from-neon-green hover:to-neon-cyan/80 text-cyber-darker font-bold py-4 rounded-xl shadow-lg shadow-neon-green/20 hover:shadow-xl hover:shadow-neon-green/30 transition-all duration-300 flex items-center justify-center gap-2 btn-primary"
        >
          {!isLoading && <ArrowRight size={20} />}
          {isLoading ? 'Signing in...' : 'Sign In'}
        </Button>

        <div className="text-center pt-4">
          <p className="text-sm text-white/60">
            Don't have an account?{' '}
            <button
              type="button"
              onClick={onSwitchToRegister}
              className="text-neon-green hover:text-neon-cyan font-semibold transition-colors cursor-pointer underline decoration-neon-green/50 hover:decoration-neon-cyan"
            >
              Sign up here
            </button>
          </p>
        </div>
      </form>
    </div>
  );
}
