'use client';

import React, { useState, useEffect } from 'react';
import { Shield, Lock, Terminal, Activity, Zap } from 'lucide-react';
import LoginForm from '@/components/auth/LoginForm';
import RegisterForm from '@/components/auth/RegisterForm';

export default function AuthLayout() {
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  const [terminalText, setTerminalText] = useState('');
  const terminalMessages = [
    'PACSTAR_AUTH_SYSTEM v2.1.4',
    'Initializing security protocols...',
    'Establishing secure connection...',
    'System ready. Awaiting authentication.',
  ];

  useEffect(() => {
    let currentIndex = 0;
    const interval = setInterval(() => {
      if (currentIndex < terminalMessages.length) {
        setTerminalText(terminalMessages.slice(0, currentIndex + 1).join('\n> '));
        currentIndex++;
      } else {
        clearInterval(interval);
      }
    }, 800);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen w-full bg-background security-pattern flex flex-col lg:flex-row relative overflow-hidden scan-line">
      {/* Animated Grid Background */}
      <div className="absolute inset-0 hex-pattern opacity-30 pointer-events-none" />
      
      {/* Left Sidebar - Authentication Panel */}
      <div className="w-full lg:w-2/5 xl:w-1/3 relative z-10">
        {/* Military-style header bar */}
        <div className="bg-primary/40 border-b-2 border-accent p-4 data-panel">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-10 h-10 bg-accent/20 border-2 border-accent flex items-center justify-center">
                  <Shield className="text-accent" size={20} />
                </div>
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-accent pulse-ring" />
              </div>
              <div>
                <h1 className="text-lg font-mono font-bold text-accent tracking-wider">
                  AUTH_SYSTEM
                </h1>
                <p className="text-xs text-secondary font-mono">ACCESS CONTROL</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-accent rounded-full glow-accent" />
              <span className="text-xs text-accent font-mono">ONLINE</span>
            </div>
          </div>
        </div>

        {/* Tabs with military badge style */}
        <div className="bg-secondary/30 border-b border-accent/30 p-2 flex gap-2">
          <button
            onClick={() => setActiveTab('login')}
            className={`
              badge-military font-mono text-sm font-semibold px-6 py-2 transition-all duration-300
              ${
                activeTab === 'login'
                  ? 'bg-accent/20 text-accent border-accent glow-accent'
                  : 'bg-transparent text-secondary border-secondary/50 hover:border-accent/50 hover:text-text'
              }
            `}
          >
            &gt; LOGIN
          </button>
          <button
            onClick={() => setActiveTab('register')}
            className={`
              badge-military font-mono text-sm font-semibold px-6 py-2 transition-all duration-300
              ${
                activeTab === 'register'
                  ? 'bg-accent/20 text-accent border-accent glow-accent'
                  : 'bg-transparent text-secondary border-secondary/50 hover:border-accent/50 hover:text-text'
              }
            `}
          >
            &gt; REGISTER
          </button>
        </div>

        {/* Form Content Container */}
        <div className="p-6 lg:p-10 flex-1 min-h-[calc(100vh-200px)]">
          <div className="terminal-border bg-secondary/20 p-6">
            {activeTab === 'login' ? <LoginForm /> : <RegisterForm />}
          </div>
        </div>
      </div>

      {/* Right Content Area - Terminal/Data Panel Style */}
      <div className="hidden lg:flex flex-1 flex-col relative z-10">
        {/* Top Status Bar */}
        <div className="bg-primary/40 border-b-2 border-accent p-4 data-panel">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Terminal className="text-accent" size={20} />
                <span className="text-accent font-mono text-sm font-semibold">SYSTEM_STATUS</span>
              </div>
              <div className="h-4 w-px bg-accent/30" />
              <div className="flex items-center gap-2">
                <Activity className="text-accent" size={16} />
                <span className="text-text text-xs font-mono">ACTIVE</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <Zap className="text-warning" size={14} />
                <span className="text-warning text-xs font-mono">SECURE</span>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 p-8 relative overflow-hidden">
          {/* Background Circuit Pattern */}
          <div className="absolute inset-0 circuit-lines opacity-20" />
          
          {/* Terminal Window */}
          <div className="terminal-border bg-secondary/10 p-6 mb-8 h-40">
            <div className="flex items-center gap-2 mb-4">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 bg-warning rounded-full" />
                <div className="w-3 h-3 bg-accent rounded-full glow-accent" />
                <div className="w-3 h-3 bg-secondary rounded-full" />
              </div>
              <span className="text-xs text-secondary font-mono ml-2">terminal.exe</span>
            </div>
            <div className="font-mono text-xs text-accent leading-relaxed">
              <pre className="whitespace-pre-wrap">
                {terminalText}
                <span className="terminal-cursor">_</span>
              </pre>
            </div>
          </div>

          {/* Logo Section */}
          <div className="mb-8">
            <div className="flex items-center gap-4 mb-4">
              <div className="relative">
                <div className="w-16 h-16 bg-accent/20 border-2 border-accent flex items-center justify-center terminal-border">
                  <Lock className="text-accent" size={28} />
                </div>
                <div className="absolute -top-2 -right-2 w-4 h-4 bg-accent pulse-ring" />
              </div>
              <div>
                <h1 className="text-4xl font-mono font-bold text-accent tracking-wider mb-1">
                  PACSTAR
                </h1>
                <p className="text-xl font-mono text-secondary">
                  CHALLENGE_MANAGEMENT
                </p>
              </div>
            </div>
          </div>

          {/* Info Banner - Military Style */}
          <div className="mb-8 data-panel p-4 terminal-border">
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-warning mt-1.5 glow-accent" />
              <div className="flex-1">
                <p className="text-sm font-mono text-accent mb-1">[INFO] SYSTEM_NOTIFICATION</p>
                <p className="text-text text-sm">
                  Authentication required. Please login or register in the control panel.
                </p>
              </div>
            </div>
          </div>

          {/* Features List - Terminal Style */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-1 h-6 bg-accent glow-accent" />
              <h2 className="text-lg font-mono font-semibold text-accent">
                [FEATURES] AVAILABLE_MODULES
              </h2>
            </div>
            
            <div className="space-y-3 font-mono text-sm">
              <div className="flex items-start gap-3 data-panel p-3 terminal-border">
                <span className="text-accent">[+]</span>
                <span className="text-text">User Registration & Login</span>
              </div>
              <div className="flex items-start gap-3 data-panel p-3 terminal-border">
                <span className="text-accent">[+]</span>
                <span className="text-text">View Available Challenges</span>
              </div>
              <div className="flex items-start gap-3 data-panel p-3 terminal-border">
                <span className="text-accent">[+]</span>
                <span className="text-text">Start Challenge Instances</span>
              </div>
              
              <div className="ml-6 mt-4 space-y-2">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-1 h-4 bg-warning" />
                  <p className="text-warning font-semibold text-xs">
                    [ADMIN] PRIVILEGED_ACCESS
                  </p>
                </div>
                <div className="space-y-2 ml-4">
                  <div className="flex items-start gap-2">
                    <span className="text-secondary">└─</span>
                    <span className="text-secondary text-xs">View all users</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-secondary">└─</span>
                    <span className="text-secondary text-xs">Create challenges</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-secondary">└─</span>
                    <span className="text-secondary text-xs">Delete challenges</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-secondary">└─</span>
                    <span className="text-secondary text-xs">Monitor challenge deployments</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
