'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { authAPI } from '@/lib/api';

export default function Dashboard() {
  const router = useRouter();

  useEffect(() => {
    // Check if user is authenticated
    const token = localStorage.getItem('auth_token');
    if (!token) {
      router.push('/');
    }
  }, [router]);

  const handleLogout = () => {
    authAPI.logout();
    router.push('/');
  };

  return (
    <div className="min-h-screen bg-background security-pattern">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-accent/20 rounded-lg">
              <Shield className="text-accent" size={24} />
            </div>
            <h1 className="text-3xl font-bold text-text">Dashboard</h1>
          </div>
          <Button variant="outline" onClick={handleLogout}>
            <LogOut size={18} className="mr-2" />
            Logout
          </Button>
        </div>

        <div className="max-w-4xl mx-auto">
          <div className="bg-secondary/20 backdrop-blur-sm border border-secondary/30 rounded-lg p-8">
            <h2 className="text-2xl font-semibold text-text mb-4">
              Welcome to PACSTAR Challenge Management
            </h2>
            <p className="text-text/80">
              Authentication successful! You have been redirected to the dashboard.
            </p>
            <p className="text-text/60 mt-4">
              This is a placeholder dashboard. Build out your application features here.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

