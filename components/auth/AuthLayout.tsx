'use client';

import React, { useState } from 'react';
import { Shield, LogIn, UserPlus, Sparkles } from 'lucide-react';
import LoginForm from '@/components/auth/LoginForm';
import RegisterForm from '@/components/auth/RegisterForm';

export default function AuthLayout() {
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-white via-brown-50 to-orange-50 relative overflow-hidden">
      {/* Decorative Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-green-200/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-orange-200/20 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-brown-100/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 flex items-center justify-center min-h-screen p-4 lg:p-8">
        <div className="w-full max-w-5xl">
          {/* Main Container */}
          <div className="bg-white rounded-3xl shadow-2xl overflow-hidden border border-brown-200/50">
            <div className="grid lg:grid-cols-2">
              {/* Left Side - Branding & Info */}
              <div className="hidden lg:flex flex-col justify-between bg-gradient-to-br from-brown-600 via-brown-500 to-brown-700 p-12 text-white relative overflow-hidden">
                {/* Decorative Pattern */}
                <div className="absolute inset-0 opacity-10">
                  <div className="absolute top-0 left-0 w-full h-full" style={{
                    backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`,
                    backgroundSize: '40px 40px'
                  }} />
                </div>
                
                <div className="relative z-10">
                  {/* Logo Section */}
                  <div className="mb-12">
                    <div className="flex items-center gap-4 mb-6">
                      <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center border-2 border-white/30">
                        <Shield className="text-white" size={32} />
                      </div>
                      <div>
                        <h1 className="text-3xl font-bold tracking-tight">PACSTAR</h1>
                        <p className="text-white/80 text-sm font-medium">Challenge Platform</p>
                      </div>
                    </div>
                    <p className="text-white/90 text-lg leading-relaxed">
                      Welcome to the ultimate cybersecurity challenge management platform. 
                      Test your skills, compete with teams, and master the art of hacking.
                    </p>
                  </div>

                  {/* Features */}
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-green-500/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0 border border-green-400/30">
                        <Sparkles className="text-green-300" size={20} />
                      </div>
                      <div>
                        <h3 className="font-semibold mb-1">Interactive Challenges</h3>
                        <p className="text-white/70 text-sm">Engage with real-world scenarios and hands-on exercises</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-orange-500/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0 border border-orange-400/30">
                        <UserPlus className="text-orange-300" size={20} />
                      </div>
                      <div>
                        <h3 className="font-semibold mb-1">Team Collaboration</h3>
                        <p className="text-white/70 text-sm">Work together with your team to solve complex challenges</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-green-500/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0 border border-green-400/30">
                        <Shield className="text-green-300" size={20} />
                      </div>
                      <div>
                        <h3 className="font-semibold mb-1">Secure Platform</h3>
                        <p className="text-white/70 text-sm">Enterprise-grade security for all your activities</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bottom Decoration */}
                <div className="relative z-10 mt-8 pt-8 border-t border-white/20">
                  <p className="text-white/60 text-xs">
                    © 2024 PACSTAR. All rights reserved.
                  </p>
                </div>
              </div>

              {/* Right Side - Auth Forms */}
              <div className="bg-white p-8 lg:p-12">
                {/* Tab Switcher */}
                <div className="flex items-center gap-2 mb-8 p-1 bg-brown-50 rounded-xl border border-brown-100">
                  <button
                    onClick={() => setActiveTab('login')}
                    className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-semibold text-sm transition-all duration-300 ${
                      activeTab === 'login'
                        ? 'bg-white text-brown-700 shadow-md border border-brown-200'
                        : 'text-brown-600 hover:text-brown-700'
                    }`}
                  >
                    <LogIn size={18} />
                    Sign In
                  </button>
                  <button
                    onClick={() => setActiveTab('register')}
                    className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-semibold text-sm transition-all duration-300 ${
                      activeTab === 'register'
                        ? 'bg-white text-brown-700 shadow-md border border-brown-200'
                        : 'text-brown-600 hover:text-brown-700'
                    }`}
                  >
                    <UserPlus size={18} />
                    Sign Up
                  </button>
                </div>

                {/* Form Content */}
                <div className="animate-fade-in">
                  {activeTab === 'login' ? (
                    <LoginForm onSwitchToRegister={() => setActiveTab('register')} />
                  ) : (
                    <RegisterForm onSwitchToLogin={() => setActiveTab('login')} />
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
