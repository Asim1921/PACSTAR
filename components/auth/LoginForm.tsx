'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { User, Lock as LockIcon } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { authAPI } from '@/lib/api';

export default function LoginForm() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    username: '',
    password: '',
  });
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear error when user starts typing
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
      // Redirect to dashboard or home page
      router.push('/dashboard');
    } catch (error: any) {
      setErrors({
        submit: error.response?.data?.detail || 'Login failed. Please check your credentials.',
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
            [AUTH] LOGIN_SEQUENCE
          </h2>
        </div>
        <p className="text-xs text-secondary font-mono ml-3">
          Enter credentials to access system
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <Input
          label="Username"
          name="username"
          type="text"
          value={formData.username}
          onChange={handleChange}
          error={errors.username}
          icon={<User size={18} />}
          placeholder="Enter your username"
          autoComplete="username"
        />

        <Input
          label="Password"
          name="password"
          type="password"
          value={formData.password}
          onChange={handleChange}
          error={errors.password}
          icon={<LockIcon size={18} />}
          placeholder="Enter your password"
          autoComplete="current-password"
        />

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
          &gt; EXECUTE_LOGIN
        </Button>
      </form>
    </div>
  );
}

