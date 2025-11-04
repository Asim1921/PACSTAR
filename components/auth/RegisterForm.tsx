'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { User, Mail, Lock as LockIcon, Users, Hash, MapPin } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { RadioGroup } from '@/components/ui/RadioGroup';
import { InfoBox } from '@/components/ui/InfoBox';
import { authAPI } from '@/lib/api';

type RegistrationType = 'team_code' | 'create_team' | 'individual';

export default function RegisterForm() {
  const router = useRouter();
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

  const zones = [
    { value: 'zone1', label: 'Zone 1' },
    { value: 'zone2', label: 'Zone 2' },
    { value: 'zone3', label: 'Zone 3' },
    { value: 'zone4', label: 'Zone 4' },
  ];

  const registrationOptions = [
    {
      value: 'team_code',
      label: 'Join a team (Team Code)',
      description: 'Enter a team code to join an existing team',
    },
    {
      value: 'create_team',
      label: 'Create new team',
      description: 'Create your own team and become the team leader',
    },
    {
      value: 'individual',
      label: 'Individual (Zone)',
      description: 'Join as an individual and get assigned to a zone automatically',
    },
  ];

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear error when user starts typing
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

    // Username validation
    if (!formData.username.trim()) {
      newErrors.username = 'Username is required';
    } else if (formData.username.length < 3) {
      newErrors.username = 'Username must be at least 3 characters';
    }

    // Email validation
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    // Password validation
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.password)) {
      newErrors.password = 'Password must contain uppercase, lowercase, and number';
    }

    // Confirm password validation
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    // Registration type specific validation
    if (formData.registrationType === 'team_code' && !formData.teamCode.trim()) {
      newErrors.teamCode = 'Team code is required';
    }

    if (formData.registrationType === 'create_team' && !formData.teamName.trim()) {
      newErrors.teamName = 'Team name is required';
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
        registration_type: formData.registrationType,
      };

      if (formData.registrationType === 'team_code') {
        registrationData.team_code = formData.teamCode;
      } else if (formData.registrationType === 'create_team') {
        registrationData.team_name = formData.teamName;
      } else if (formData.registrationType === 'individual') {
        registrationData.zone = formData.zone;
      }

      const response = await authAPI.register(registrationData);
      // Redirect to dashboard or home page
      router.push('/dashboard');
    } catch (error: any) {
      setErrors({
        submit:
          error.response?.data?.detail ||
          'Registration failed. Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-1 h-6 bg-accent glow-accent" />
          <h2 className="text-xl font-mono font-bold text-accent tracking-wider">
            [AUTH] REGISTRATION_SEQUENCE
          </h2>
        </div>
        <p className="text-xs text-secondary font-mono ml-3">
          Create new account to access system
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Basic Information */}
        <Input
          label="Username"
          name="username"
          type="text"
          value={formData.username}
          onChange={handleChange}
          error={errors.username}
          icon={<User size={18} />}
          placeholder="Choose a username"
          autoComplete="username"
        />

        <Input
          label="Email"
          name="email"
          type="email"
          value={formData.email}
          onChange={handleChange}
          error={errors.email}
          icon={<Mail size={18} />}
          placeholder="Enter your email"
          autoComplete="email"
        />

        <Input
          label="Password"
          name="password"
          type="password"
          value={formData.password}
          onChange={handleChange}
          error={errors.password}
          icon={<LockIcon size={18} />}
          placeholder="Create a strong password"
          autoComplete="new-password"
        />

        <Input
          label="Confirm Password"
          name="confirmPassword"
          type="password"
          value={formData.confirmPassword}
          onChange={handleChange}
          error={errors.confirmPassword}
          icon={<LockIcon size={18} />}
          placeholder="Confirm your password"
          autoComplete="new-password"
        />

        {/* Registration Type */}
        <RadioGroup
          label="Registration Type"
          options={registrationOptions}
          value={formData.registrationType}
          onChange={handleRegistrationTypeChange}
          error={errors.registrationType}
        />

        {/* Conditional Fields */}
        {formData.registrationType === 'team_code' && (
          <div className="space-y-4">
            <Input
              label="Team Code"
              name="teamCode"
              type="text"
              value={formData.teamCode}
              onChange={handleChange}
              error={errors.teamCode}
              icon={<Hash size={18} />}
              placeholder="Enter team code"
            />
            <InfoBox type="info" icon={<Users size={18} />}>
              Enter the team code provided by your team leader to join their team.
            </InfoBox>
          </div>
        )}

        {formData.registrationType === 'create_team' && (
          <div className="space-y-4">
            <Input
              label="Team Name"
              name="teamName"
              type="text"
              value={formData.teamName}
              onChange={handleChange}
              error={errors.teamName}
              icon={<Users size={18} />}
              placeholder="Enter your team name"
            />
            <InfoBox type="success" icon={<Users size={18} />}>
              You'll become the team leader and receive a team code to share with
              members.
            </InfoBox>
          </div>
        )}

        {formData.registrationType === 'individual' && (
          <div className="space-y-4">
            <Select
              label="Zone"
              name="zone"
              value={formData.zone}
              onChange={handleChange}
              options={zones}
              error={errors.zone}
            />
            <InfoBox type="info" icon={<MapPin size={18} />}>
              Pick a zone to join. Users with the same zone form a team
              automatically.
            </InfoBox>
          </div>
        )}

        {errors.submit && (
          <div className="p-4 bg-warning/20 border-2 border-warning data-panel">
            <div className="flex items-start gap-2">
              <span className="text-warning font-mono text-sm">[ERROR]</span>
              <p className="text-warning text-sm font-mono">{errors.submit}</p>
            </div>
          </div>
        )}

        <Button
          type="submit"
          variant="primary"
          size="lg"
          isLoading={isLoading}
          className="w-full badge-military font-mono font-semibold tracking-wider"
        >
          &gt; EXECUTE_REGISTRATION
        </Button>
      </form>
    </div>
  );
}

