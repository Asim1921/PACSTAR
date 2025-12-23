'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { User, Mail, Lock, Users, Hash, MapPin, ArrowRight, CheckCircle, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { authAPI } from '@/lib/api';
import { useToast } from '@/components/ui/ToastProvider';

type RegistrationType = 'team_code' | 'create_team' | 'individual';

type Zone = {
  value: string;
  label: string;
};

const AVAILABLE_ZONES: Zone[] = [
  { value: 'zone1', label: 'Zone 1' },
  { value: 'zone2', label: 'Zone 2' },
  { value: 'zone3', label: 'Zone 3' },
  { value: 'zone4', label: 'Zone 4' },
  { value: 'zone5', label: 'Zone 5' },
  { value: 'main', label: 'Main Zone' },
];

interface RegisterFormProps {
  onSwitchToLogin?: () => void;
}

export default function RegisterForm({ onSwitchToLogin }: RegisterFormProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    registrationType: 'team_code' as RegistrationType,
    teamCode: '',
    teamName: '',
    zone: 'zone1',
  });

  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showTeamCodeModal, setShowTeamCodeModal] = useState(false);
  const [teamCode, setTeamCode] = useState<string | null>(null);

  const registrationOptions = [
    {
      value: 'team_code',
      label: 'Join Existing Team',
      description: 'Enter a team code to join',
      icon: Users,
      colorClass: 'neon-cyan',
    },
    {
      value: 'create_team',
      label: 'Create New Team',
      description: 'Start your own team',
      icon: Users,
      colorClass: 'neon-green',
    },
    {
      value: 'individual',
      label: 'Individual Account',
      description: 'Join as an individual',
      icon: User,
      colorClass: 'neon-purple',
    },
  ];

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const handleRegistrationTypeChange = (value: string) => {
    setFormData((prev) => ({
      ...prev,
      registrationType: value as RegistrationType,
      teamCode: '',
      teamName: '',
    }));
    setErrors({});
  };

  const validate = () => {
    const newErrors: { [key: string]: string } = {};

    if (!formData.username.trim()) {
      newErrors.username = 'Username is required';
    } else if (formData.username.length < 3) {
      newErrors.username = 'Username must be at least 3 characters';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.password)) {
      newErrors.password = 'Password must contain uppercase, lowercase, and number';
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    if (formData.registrationType === 'team_code' && !formData.teamCode.trim()) {
      newErrors.teamCode = 'Team code is required';
    }

    if (formData.registrationType === 'create_team' && !formData.teamName.trim()) {
      newErrors.teamName = 'Team name is required';
    }

    if (formData.registrationType === 'create_team' && !formData.zone.trim()) {
      newErrors.zone = 'Zone selection is required when creating a team';
    }

    if (formData.registrationType === 'individual' && !formData.zone.trim()) {
      newErrors.zone = 'Zone selection is required';
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
      const registrationData: any = {
        username: formData.username,
        email: formData.email,
        password: formData.password,
        zone: null,
        team_code: null,
        create_team: false,
        team_name: null,
      };

      // Set registration data based on type
      if (formData.registrationType === 'team_code') {
        registrationData.team_code = formData.teamCode;
        // Don't set zone when joining with team code
      } else if (formData.registrationType === 'create_team') {
        registrationData.create_team = true;
        registrationData.team_name = formData.teamName;
        registrationData.zone = formData.zone;  // Include zone when creating team
      } else if (formData.registrationType === 'individual') {
        registrationData.zone = formData.zone;  // Individual registration uses zone
        // Explicitly ensure team_code is null for individual registration
        registrationData.team_code = null;
      }

      // Clear old user data before registration
      sessionStorage.removeItem('user_info');
      sessionStorage.removeItem('user_id');
      sessionStorage.removeItem('team_info');

      const response = await authAPI.register(registrationData);
      
      // Check if token was saved
      const token = sessionStorage.getItem('auth_token');
      if (token) {
        // Try to fetch current user profile using the token
        try {
          const userProfile = await authAPI.me();
          if (userProfile && userProfile.id) {
            sessionStorage.setItem('user_info', JSON.stringify(userProfile));
            sessionStorage.setItem('user_id', userProfile.id);
          }
        } catch (meError: any) {
          console.log('auth/me failed after registration, using response data:', meError);
          // Fallback: Use response data
          if (response.id) {
            sessionStorage.setItem('user_id', response.id);
            sessionStorage.setItem('user_info', JSON.stringify({
              id: response.id,
              username: response.username || formData.username,
              email: response.email || formData.email,
              role: response.role || 'User',
              zone: response.zone || (formData.registrationType === 'individual' ? formData.zone : 'zone1'),
            }));
          } else if (response.user) {
        sessionStorage.setItem('user_info', JSON.stringify(response.user));
        if (response.user.id) {
          sessionStorage.setItem('user_id', response.user.id);
        }
          }
        }
      } else {
        // No token, use response data if available
        if (response.id) {
        sessionStorage.setItem('user_id', response.id);
        sessionStorage.setItem('user_info', JSON.stringify({
          id: response.id,
            username: response.username || formData.username,
            email: response.email || formData.email,
            role: response.role || 'User',
            zone: response.zone || (formData.registrationType === 'individual' ? formData.zone : 'zone1'),
        }));
        } else if (response.user) {
          sessionStorage.setItem('user_info', JSON.stringify(response.user));
          if (response.user.id) {
            sessionStorage.setItem('user_id', response.user.id);
          }
        }
      }
      
      // Show team code modal if team was created
      if (formData.registrationType === 'create_team' && response.team_code) {
        setTeamCode(response.team_code);
        setShowTeamCodeModal(true);
        showToast('Team created successfully!', 'success');
      } else {
        showToast('User registration successful', 'success');
        setTimeout(() => {
          window.location.href = '/dashboard';
        }, 500);
      }
    } catch (error: any) {
      const errorDetail = error.response?.data?.detail || '';
      const newErrors: { [key: string]: string } = {};

      if (Array.isArray(errorDetail)) {
        errorDetail.forEach((err: any) => {
          const field = err.loc?.[err.loc.length - 1];
          const message = (err.msg || err.message || JSON.stringify(err)).toLowerCase();
          
          if ((field === 'email' || message.includes('email')) && 
              (message.includes('already') || message.includes('taken'))) {
            newErrors.email = 'This email has already been taken.';
          }
          
          if ((field === 'username' || message.includes('username')) && 
              (message.includes('already') || message.includes('taken'))) {
            newErrors.username = 'This username has already been taken.';
          }
          
          if ((field === 'team_name' || message.includes('team')) && 
              (message.includes('already') || message.includes('taken'))) {
            newErrors.teamName = 'This team name has already been taken.';
          }
        });
      } else {
        const errorMessage = typeof errorDetail === 'string' ? errorDetail.toLowerCase() : '';
        if (errorMessage.includes('email') && errorMessage.includes('already')) {
          newErrors.email = 'This email has already been taken.';
        }
        if (errorMessage.includes('username') && errorMessage.includes('already')) {
          newErrors.username = 'This username has already been taken.';
        }
        if (errorMessage.includes('team') && errorMessage.includes('already')) {
          newErrors.teamName = 'This team name has already been taken.';
        }
      }

      if (Object.keys(newErrors).length === 0) {
        newErrors.submit = typeof errorDetail === 'string' ? errorDetail : 'Registration failed. Please try again.';
      }

      setErrors(newErrors);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full">
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-white mb-2 gradient-text">Create Account</h2>
        <p className="text-white/60">Join us and start your cybersecurity journey</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <div className="space-y-5">
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
                placeholder="Choose a username"
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
              Email
            </label>
            <div className="relative group">
              <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-neon-green/60 group-focus-within:text-neon-green transition-colors">
                <Mail size={20} />
              </div>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="Enter your email"
                autoComplete="email"
                className={`w-full pl-12 pr-4 py-3.5 bg-cyber-900/50 border-2 rounded-xl focus:outline-none transition-all text-white placeholder:text-white/30 ${
                  errors.email 
                    ? 'border-neon-orange/50 focus:border-neon-orange focus:ring-4 focus:ring-neon-orange/20' 
                    : 'border-neon-green/20 focus:border-neon-green focus:ring-4 focus:ring-neon-green/20'
                }`}
              />
            </div>
            {errors.email && (
              <p className="mt-2 text-sm text-neon-orange flex items-center gap-1">
                <span>⚠</span> {errors.email}
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
                placeholder="Create a strong password"
                autoComplete="new-password"
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

          <div>
            <label className="block text-sm font-semibold text-white/90 mb-2">
              Confirm Password
            </label>
            <div className="relative group">
              <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-neon-green/60 group-focus-within:text-neon-green transition-colors">
                <Lock size={20} />
              </div>
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="Confirm your password"
                autoComplete="new-password"
                className={`w-full pl-12 pr-12 py-3.5 bg-cyber-900/50 border-2 rounded-xl focus:outline-none transition-all text-white placeholder:text-white/30 ${
                  errors.confirmPassword 
                    ? 'border-neon-orange/50 focus:border-neon-orange focus:ring-4 focus:ring-neon-orange/20' 
                    : 'border-neon-green/20 focus:border-neon-green focus:ring-4 focus:ring-neon-green/20'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-4 top-1/2 transform -translate-y-1/2 text-white/40 hover:text-neon-green transition-colors"
              >
                {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            {errors.confirmPassword && (
              <p className="mt-2 text-sm text-neon-orange flex items-center gap-1">
                <span>⚠</span> {errors.confirmPassword}
              </p>
            )}
          </div>
        </div>

        {/* Registration Type */}
        <div>
          <label className="block text-sm font-semibold text-white/90 mb-3">
            Registration Type
          </label>
          <div className="grid grid-cols-1 gap-3">
            {registrationOptions.map((option) => {
              const Icon = option.icon;
              const isSelected = formData.registrationType === option.value;
              const getSelectedClasses = () => {
                if (option.value === 'team_code') {
                  return 'border-neon-cyan/50 bg-neon-cyan/10 shadow-lg shadow-neon-cyan/20';
                } else if (option.value === 'create_team') {
                  return 'border-neon-green/50 bg-neon-green/10 shadow-lg shadow-neon-green/20';
                } else {
                  return 'border-neon-purple/50 bg-neon-purple/10 shadow-lg shadow-neon-purple/20';
                }
              };
              const getIconClasses = () => {
                if (option.value === 'team_code') {
                  return 'bg-neon-cyan/20 border-neon-cyan/40';
                } else if (option.value === 'create_team') {
                  return 'bg-neon-green/20 border-neon-green/40';
                } else {
                  return 'bg-neon-purple/20 border-neon-purple/40';
                }
              };
              const getIconColor = () => {
                if (option.value === 'team_code') {
                  return 'text-neon-cyan';
                } else if (option.value === 'create_team') {
                  return 'text-neon-green';
                } else {
                  return 'text-neon-purple';
                }
              };
              const getCheckColor = () => {
                if (option.value === 'team_code') {
                  return 'text-neon-cyan';
                } else if (option.value === 'create_team') {
                  return 'text-neon-green';
                } else {
                  return 'text-neon-purple';
                }
              };
              const getPulseBg = () => {
                if (option.value === 'team_code') {
                  return 'bg-neon-cyan/5';
                } else if (option.value === 'create_team') {
                  return 'bg-neon-green/5';
                } else {
                  return 'bg-neon-purple/5';
                }
              };
              return (
              <button
                key={option.value}
                type="button"
                onClick={() => handleRegistrationTypeChange(option.value)}
                  className={`p-4 rounded-xl border-2 text-left transition-all relative overflow-hidden group ${
                    isSelected
                      ? getSelectedClasses()
                      : 'border-neon-green/20 bg-cyber-900/30 hover:border-neon-green/40 hover:bg-cyber-900/50'
                  }`}
                >
                  {isSelected && (
                    <div className={`absolute inset-0 ${getPulseBg()} animate-pulse`} />
                  )}
                  <div className="flex items-center justify-between relative z-10">
                    <div className="flex items-center gap-3 flex-1">
                      <div className={`w-10 h-10 rounded-lg ${getIconClasses()} backdrop-blur-sm flex items-center justify-center border`}>
                        <Icon className={getIconColor()} size={20} />
                      </div>
                  <div>
                        <div className="font-semibold text-white mb-1">{option.label}</div>
                        <div className="text-sm text-white/60">{option.description}</div>
                      </div>
                  </div>
                    {isSelected && (
                      <CheckCircle className={getCheckColor()} size={24} />
                  )}
                </div>
              </button>
              );
            })}
          </div>
        </div>

        {/* Conditional Fields */}
        {formData.registrationType === 'team_code' && (
          <div>
            <label className="block text-sm font-semibold text-white/90 mb-2">
              Team Code
            </label>
            <div className="relative group">
              <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-neon-cyan/60 group-focus-within:text-neon-cyan transition-colors">
                <Hash size={20} />
              </div>
              <input
                type="text"
                name="teamCode"
                value={formData.teamCode}
                onChange={handleChange}
                placeholder="Enter team code"
                className={`w-full pl-12 pr-4 py-3.5 bg-cyber-900/50 border-2 rounded-xl focus:outline-none transition-all text-white placeholder:text-white/30 ${
                  errors.teamCode 
                    ? 'border-neon-orange/50 focus:border-neon-orange focus:ring-4 focus:ring-neon-orange/20' 
                    : 'border-neon-cyan/20 focus:border-neon-cyan focus:ring-4 focus:ring-neon-cyan/20'
                }`}
              />
            </div>
            {errors.teamCode && (
              <p className="mt-2 text-sm text-neon-orange flex items-center gap-1">
                <span>⚠</span> {errors.teamCode}
              </p>
            )}
            <p className="mt-2 text-sm text-neon-cyan/70 flex items-center gap-2">
              <Users size={16} />
              Enter the team code provided by your team leader
            </p>
          </div>
        )}

        {formData.registrationType === 'create_team' && (
          <>
            <div>
              <label className="block text-sm font-semibold text-white/90 mb-2">
                Team Name
              </label>
              <div className="relative group">
                <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-neon-green/60 group-focus-within:text-neon-green transition-colors">
                  <Users size={20} />
                </div>
                <input
                  type="text"
                  name="teamName"
                  value={formData.teamName}
                  onChange={handleChange}
                  placeholder="Enter your team name"
                  className={`w-full pl-12 pr-4 py-3.5 bg-cyber-900/50 border-2 rounded-xl focus:outline-none transition-all text-white placeholder:text-white/30 ${
                    errors.teamName 
                      ? 'border-neon-orange/50 focus:border-neon-orange focus:ring-4 focus:ring-neon-orange/20' 
                      : 'border-neon-green/20 focus:border-neon-green focus:ring-4 focus:ring-neon-green/20'
                  }`}
                />
              </div>
              {errors.teamName && (
                <p className="mt-2 text-sm text-neon-orange flex items-center gap-1">
                  <span>⚠</span> {errors.teamName}
                </p>
              )}
              <p className="mt-2 text-sm text-neon-green/70 flex items-center gap-2">
                <CheckCircle size={16} />
                You'll become the team leader and receive a team code
              </p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-white/90 mb-2">
                Zone
              </label>
              <div className="relative group">
                <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-neon-green/60 group-focus-within:text-neon-green transition-colors z-10">
                  <MapPin size={20} />
                </div>
                <select
                  name="zone"
                  value={formData.zone}
                  onChange={handleChange}
                  className={`w-full pl-12 pr-4 py-3.5 bg-cyber-900/50 border-2 rounded-xl focus:outline-none transition-all text-white appearance-none ${
                    errors.zone 
                      ? 'border-neon-orange/50 focus:border-neon-orange focus:ring-4 focus:ring-neon-orange/20' 
                      : 'border-neon-green/20 focus:border-neon-green focus:ring-4 focus:ring-neon-green/20'
                  }`}
                >
                  {AVAILABLE_ZONES.map((zone) => (
                    <option key={zone.value} value={zone.value} className="bg-cyber-900">
                      {zone.label}
                    </option>
                  ))}
                </select>
                <div className="absolute right-4 top-1/2 transform -translate-y-1/2 pointer-events-none">
                  <div className="w-0 h-0 border-l-4 border-l-white/40 border-t-4 border-t-transparent border-b-4 border-b-transparent" />
                </div>
              </div>
              {errors.zone && (
                <p className="mt-2 text-sm text-neon-orange flex items-center gap-1">
                  <span>⚠</span> {errors.zone}
                </p>
              )}
              <p className="mt-2 text-sm text-neon-green/70 flex items-center gap-2">
                <MapPin size={16} />
                Select the zone for your team
              </p>
            </div>
          </>
        )}

        {formData.registrationType === 'individual' && (
          <div>
            <label className="block text-sm font-semibold text-white/90 mb-2">
              Zone
            </label>
            <div className="relative group">
              <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-neon-purple/60 group-focus-within:text-neon-purple transition-colors z-10">
                <MapPin size={20} />
              </div>
              <select
                name="zone"
                value={formData.zone}
                onChange={handleChange}
                className={`w-full pl-12 pr-4 py-3.5 bg-cyber-900/50 border-2 rounded-xl focus:outline-none transition-all text-white appearance-none ${
                  errors.zone 
                    ? 'border-neon-orange/50 focus:border-neon-orange focus:ring-4 focus:ring-neon-orange/20' 
                    : 'border-neon-purple/20 focus:border-neon-purple focus:ring-4 focus:ring-neon-purple/20'
                }`}
              >
                {AVAILABLE_ZONES.map((zone) => (
                  <option key={zone.value} value={zone.value} className="bg-cyber-900">
                    {zone.label}
                  </option>
                ))}
              </select>
              <div className="absolute right-4 top-1/2 transform -translate-y-1/2 pointer-events-none">
                <div className="w-0 h-0 border-l-4 border-l-white/40 border-t-4 border-t-transparent border-b-4 border-b-transparent" />
              </div>
            </div>
            {errors.zone && (
              <p className="mt-2 text-sm text-neon-orange flex items-center gap-1">
                <span>⚠</span> {errors.zone}
              </p>
            )}
            <p className="mt-2 text-sm text-neon-purple/70 flex items-center gap-2">
              <MapPin size={16} />
              Pick a zone to join. Users with the same zone form a team automatically
            </p>
          </div>
        )}

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
          {isLoading ? 'Creating account...' : 'Create Account'}
        </Button>

        <div className="text-center pt-4">
          <p className="text-sm text-white/60">
            Already have an account?{' '}
            <button
              type="button"
              onClick={onSwitchToLogin}
              className="text-neon-green hover:text-neon-cyan font-semibold transition-colors cursor-pointer underline decoration-neon-green/50 hover:decoration-neon-cyan"
            >
              Sign in here
            </button>
          </p>
        </div>
      </form>

      {/* Team Code Modal */}
      {showTeamCodeModal && teamCode && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-cyber-900 border-2 border-neon-green/50 rounded-xl p-8 max-w-md w-full shadow-2xl">
            <div className="text-center">
              <div className="mb-4">
                <CheckCircle className="w-16 h-16 text-neon-green mx-auto mb-4" />
                <h3 className="text-2xl font-bold text-white mb-2">Team Created Successfully!</h3>
                <p className="text-white/70 mb-6">Your team has been created. Share this code with your teammates so they can join:</p>
              </div>
              
              <div className="bg-cyber-800 border-2 border-neon-green/30 rounded-lg p-4 mb-6">
                <p className="text-sm text-white/60 mb-2">Team Code</p>
                <div className="flex items-center justify-center gap-3">
                  <code className="text-3xl font-bold text-neon-green tracking-wider">{teamCode}</code>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(teamCode);
                      showToast('Team code copied to clipboard!', 'success');
                    }}
                    className="px-4 py-2 bg-neon-green/20 hover:bg-neon-green/30 border border-neon-green/50 rounded-lg text-neon-green font-semibold transition-colors"
                  >
                    Copy
                  </button>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowTeamCodeModal(false);
                    window.location.href = '/dashboard';
                  }}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-neon-green to-neon-cyan hover:from-neon-green hover:to-neon-cyan/80 text-cyber-darker font-bold rounded-xl transition-all"
                >
                  Continue to Dashboard
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
