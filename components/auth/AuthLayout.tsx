'use client';

import React, { useState } from 'react';
import { Shield, LogIn, UserPlus } from 'lucide-react';
import LoginForm from '@/components/auth/LoginForm';
import RegisterForm from '@/components/auth/RegisterForm';
import ParticleBackground from '@/components/auth/ParticleBackground';

export default function AuthLayout() {
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');

  return (
    <div className="min-h-screen w-full bg-cyber-darker relative overflow-hidden">
      {/* Animated Background Grid */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 security-pattern opacity-30" />
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-neon-green/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-neon-cyan/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[1000px] bg-neon-purple/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      {/* Scan Line Effect */}
      <div className="absolute inset-0 scan-line pointer-events-none opacity-30" />

      {/* Particle Background */}
      <ParticleBackground />

      <div className="relative z-10 flex items-center justify-center min-h-screen p-4 lg:p-8">
        <div className="w-full max-w-6xl">
          {/* Main Container */}
          <div className="bg-cyber-900/90 backdrop-blur-xl rounded-2xl shadow-2xl overflow-hidden border border-neon-green/20 terminal-border">
            <div className="grid lg:grid-cols-2">
              {/* Left Side - Branding & Info */}
              <div className="hidden lg:flex flex-col justify-between bg-gradient-to-br from-cyber-800 via-cyber-900 to-cyber-darker p-12 text-white relative overflow-hidden">
                {/* Decorative Pattern */}
                <div className="absolute inset-0 opacity-10">
                  <div className="absolute top-0 left-0 w-full h-full circuit-lines" />
                </div>

                <div className="relative z-10">
                  {/* Logo Section */}
                  <div className="mb-12">
                    <div className="flex items-center gap-4 mb-6">
                      <div className="w-16 h-16 bg-neon-green/20 backdrop-blur-sm rounded-xl flex items-center justify-center border-2 border-neon-green/50 glow-accent">
                        <Shield className="text-neon-green" size={32} />
                      </div>
                      <div>
                        <h1 className="text-4xl font-bold tracking-tight neon-text">PACSTAR</h1>
                        <p className="text-neon-cyan/80 text-sm font-medium tracking-wider"></p>
                      </div>
                    </div>
                    <p className="text-white/80 text-lg leading-relaxed">
                      Welcome to the ultimate cybersecurity challenge management platform. 
                      Test your skills, compete with teams, and master the art of penetration testing.
                    </p>
                  </div>

                  {/* Features */}
                  <div className="space-y-6">
                   
                   
                   
                  </div>
                </div>

                {/* Bottom Decoration */}
                <div className="relative z-10 mt-8 pt-8 border-t border-white/10">
                  <p className="text-white/40 text-xs font-mono">
                    {'>'} Developed By {'|'} 101 Cyber Div
                  </p>
                </div>
              </div>

              {/* Right Side - Auth Forms */}
              <div className="bg-cyber-800/50 backdrop-blur-xl p-8 lg:p-12">
                {/* Tab Switcher */}
                <div className="flex items-center gap-3 mb-8 p-1.5 bg-cyber-900/80 rounded-xl border border-neon-green/20">
                  <button
                    onClick={() => setActiveTab('login')}
                    className={`flex-1 flex items-center justify-center gap-2 px-6 py-3.5 rounded-lg font-semibold text-sm transition-all duration-300 relative overflow-hidden ${
                      activeTab === 'login'
                        ? 'bg-neon-green/20 text-neon-green border border-neon-green/50 shadow-lg shadow-neon-green/20'
                        : 'text-white/60 hover:text-white hover:bg-cyber-700/50'
                    }`}
                  >
                    {activeTab === 'login' && (
                      <div className="absolute inset-0 bg-neon-green/10 animate-pulse" />
                    )}
                    <LogIn size={18} className="relative z-10" />
                    <span className="relative z-10">Sign In</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('register')}
                    className={`flex-1 flex items-center justify-center gap-2 px-6 py-3.5 rounded-lg font-semibold text-sm transition-all duration-300 relative overflow-hidden ${
                      activeTab === 'register'
                        ? 'bg-neon-green/20 text-neon-green border border-neon-green/50 shadow-lg shadow-neon-green/20'
                        : 'text-white/60 hover:text-white hover:bg-cyber-700/50'
                    }`}
                  >
                    {activeTab === 'register' && (
                      <div className="absolute inset-0 bg-neon-green/10 animate-pulse" />
                    )}
                    <UserPlus size={18} className="relative z-10" />
                    <span className="relative z-10">Sign Up</span>
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
