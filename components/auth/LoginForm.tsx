'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { User, Lock, ArrowRight, Mail } from 'lucide-react';
import { Input } from '@/components/ui/Input';
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
        <h2 className="text-3xl font-bold text-brown-900 mb-2">Welcome Back</h2>
        <p className="text-brown-600">Sign in to continue to your account</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-semibold text-brown-700 mb-2">
            Username
          </label>
          <div className="relative">
            <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-brown-400">
              <User size={20} />
            </div>
            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={handleChange}
              placeholder="Enter your username"
              autoComplete="username"
              className={`w-full pl-12 pr-4 py-3.5 bg-brown-50 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/20 transition-all ${
                errors.username 
                  ? 'border-orange-500 focus:border-orange-500' 
                  : 'border-brown-200 focus:border-green-500'
              }`}
            />
          </div>
          {errors.username && (
            <p className="mt-2 text-sm text-orange-600 flex items-center gap-1">
              <span>⚠</span> {errors.username}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-semibold text-brown-700 mb-2">
            Password
          </label>
          <div className="relative">
            <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-brown-400">
              <Lock size={20} />
            </div>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Enter your password"
              autoComplete="current-password"
              className={`w-full pl-12 pr-4 py-3.5 bg-brown-50 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/20 transition-all ${
                errors.password 
                  ? 'border-orange-500 focus:border-orange-500' 
                  : 'border-brown-200 focus:border-green-500'
              }`}
            />
          </div>
          {errors.password && (
            <p className="mt-2 text-sm text-orange-600 flex items-center gap-1">
              <span>⚠</span> {errors.password}
            </p>
          )}
        </div>

        {errors.submit && (
          <div className="p-4 bg-orange-50 border-2 border-orange-200 rounded-xl">
            <p className="text-orange-700 text-sm font-medium">{errors.submit}</p>
          </div>
        )}

        <Button
          type="submit"
          variant="primary"
          size="lg"
          isLoading={isLoading}
          className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-semibold py-4 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center gap-2"
        >
          {!isLoading && <ArrowRight size={20} />}
          {isLoading ? 'Signing in...' : 'Sign In'}
        </Button>

        <div className="text-center pt-4">
          <p className="text-sm text-brown-600">
            Don't have an account?{' '}
            <button
              type="button"
              onClick={onSwitchToRegister}
              className="text-green-600 hover:text-green-700 font-semibold transition-colors cursor-pointer underline"
            >
              Sign up here
            </button>
          </p>
        </div>
      </form>
    </div>
  );
}
