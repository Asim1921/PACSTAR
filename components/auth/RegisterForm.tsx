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
import { useToast } from '@/components/ui/ToastProvider';

type RegistrationType = 'team_code' | 'create_team' | 'individual';

type Zone = {
  value: string;
  label: string;
};

// Available zones - 
const AVAILABLE_ZONES: Zone[] = [
  { value: 'zone1', label: 'zone1' },
  { value: 'zone2', label: 'zone2' },
  { value: 'zone3', label: 'zone3' },
  { value: 'zone4', label: 'zone4' },
  { value: 'zone5', label: 'zone5' },
  { value: 'main', label: 'main' },
];

export default function RegisterForm() {
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
    zone: 'zone1', // Default to zone1
  });

  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [isLoading, setIsLoading] = useState(false);

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
      // Build registration data according to API specification from documentation
      // Based on API docs, all fields should be present with null/empty values when not applicable
      const registrationData: any = {
        username: formData.username,
        email: formData.email,
        password: formData.password,
        zone: formData.registrationType === 'individual' ? formData.zone : null,
        team_code: null,
        create_team: false,
        team_name: null,
      };

      // Handle different registration types according to API spec
      if (formData.registrationType === 'individual') {
        // Individual registration: zone is already set above
        // Other fields remain null/false
      } else if (formData.registrationType === 'team_code') {
        // Join team with code: requires team_code
        registrationData.team_code = formData.teamCode;
        // zone, create_team, team_name remain null/false
      } else if (formData.registrationType === 'create_team') {
        // Create new team: requires create_team=true and team_name
        registrationData.create_team = true;
        registrationData.team_name = formData.teamName;
        // zone and team_code remain null
      }

      console.log('Registration data being sent:', JSON.stringify(registrationData, null, 2));
      const response = await authAPI.register(registrationData);
      console.log('Registration successful:', response);
      
      // Store user info if available
      if (response.user) {
        localStorage.setItem('user_info', JSON.stringify(response.user));
        // Store user ID if available
        if (response.user.id) {
          localStorage.setItem('user_id', response.user.id);
        }
      } else if (response.id) {
        // If response has user ID directly
        localStorage.setItem('user_id', response.id);
        localStorage.setItem('user_info', JSON.stringify({
          id: response.id,
          username: formData.username,
          role: 'User',
          zone: formData.registrationType === 'individual' ? formData.zone : 'zone1',
        }));
      } else {
        // Store basic user info from form if user object not available
        localStorage.setItem('user_info', JSON.stringify({
          username: formData.username,
          role: 'User',
          zone: formData.registrationType === 'individual' ? formData.zone : 'zone1',
        }));
      }
      
      // Show success toast
      showToast('User registration successful', 'success');
      
      // If team was created, log team information
      if (formData.registrationType === 'create_team' && response.team) {
        console.log('Team created successfully:', response.team);
      }
      
      // Use hard redirect to ensure token is available when dashboard loads
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 500);
    } catch (error: any) {
      // Log full error for debugging
      console.error('Registration error:', error);
      console.error('Error response:', error.response?.data);
      console.error('Error status:', error.response?.status);
      
      const errorDetail = error.response?.data?.detail || '';
      const newErrors: { [key: string]: string } = {};

      // Handle FastAPI validation error format (array of errors)
      if (Array.isArray(errorDetail)) {
        errorDetail.forEach((err: any) => {
          const field = err.loc?.[err.loc.length - 1]; // Get the field name from location
          const message = (err.msg || err.message || JSON.stringify(err)).toLowerCase();
          
          // Check if it's an email conflict
          if (
            (field === 'email' || message.includes('email')) &&
            (message.includes('already') || 
             message.includes('taken') || 
             message.includes('exists') || 
             message.includes('registered') ||
             message.includes('duplicate'))
          ) {
            newErrors.email = 'This email has already been taken. Please use a different email.';
          }
          
          // Check if it's a username conflict
          if (
            (field === 'username' || message.includes('username')) &&
            (message.includes('already') || 
             message.includes('taken') || 
             message.includes('exists') || 
             message.includes('registered') ||
             message.includes('duplicate'))
          ) {
            newErrors.username = 'This username has already been taken. Please choose a different username.';
          }
          
          // Check if it's a team name conflict
          if (
            (field === 'team_name' || field === 'name' || message.includes('team')) &&
            (message.includes('already') || 
             message.includes('taken') || 
             message.includes('exists') ||
             message.includes('duplicate'))
          ) {
            newErrors.teamName = 'This team name has already been taken. Please choose a different team name.';
          }
        });
      } else {
        // Handle string error message
        const errorMessage = typeof errorDetail === 'string' 
          ? errorDetail.toLowerCase() 
          : JSON.stringify(errorDetail).toLowerCase();

        // Check for email already taken
        if (
          errorMessage.includes('email') && 
          (errorMessage.includes('already') || 
           errorMessage.includes('taken') || 
           errorMessage.includes('exists') || 
           errorMessage.includes('registered') ||
           errorMessage.includes('duplicate'))
        ) {
          newErrors.email = 'This email has already been taken. Please use a different email.';
        }

        // Check for username already taken
        if (
          errorMessage.includes('username') && 
          (errorMessage.includes('already') || 
           errorMessage.includes('taken') || 
           errorMessage.includes('exists') || 
           errorMessage.includes('registered') ||
           errorMessage.includes('duplicate'))
        ) {
          newErrors.username = 'This username has already been taken. Please choose a different username.';
        }
        
        // Check for team name already taken
        if (
          (errorMessage.includes('team') || errorMessage.includes('name')) && 
          (errorMessage.includes('already') || 
           errorMessage.includes('taken') || 
           errorMessage.includes('exists') ||
           errorMessage.includes('duplicate'))
        ) {
          newErrors.teamName = 'This team name has already been taken. Please choose a different team name.';
        }
      }

      // If we didn't find specific field errors, show general error
      if (Object.keys(newErrors).length === 0) {
        newErrors.submit = typeof errorDetail === 'string' 
          ? errorDetail 
          : Array.isArray(errorDetail)
            ? errorDetail.map((e: any) => e?.msg || e?.message || JSON.stringify(e)).join(', ')
            : 'Registration failed. Please try again.';
      }

      setErrors(newErrors);
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
              options={AVAILABLE_ZONES}
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

