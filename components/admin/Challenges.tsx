'use client';

import React, { useState, useRef } from 'react';
import { Plus, List, Trash2, Rocket, HelpCircle, Eye, EyeOff, Minus, Plus as PlusIcon, Lightbulb, Container, Folder, Upload, FileArchive, Lock } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { RadioGroup } from '@/components/ui/RadioGroup';
import { Select } from '@/components/ui/Select';
import { InfoBox } from '@/components/ui/InfoBox';
import { challengeAPI, fileAPI } from '@/lib/api';
import { useToast } from '@/components/ui/ToastProvider';
import { ChallengeList } from './ChallengeList';
import { ChallengeDeleteView } from './ChallengeDeleteView';

type ChallengeAction = 'create' | 'list' | 'delete';
type ChallengeCategory = 'containerized' | 'static';

export const Challenges: React.FC = () => {
  const { showToast } = useToast();
  const [activeAction, setActiveAction] = useState<ChallengeAction>('create');
  const [category, setCategory] = useState<ChallengeCategory>('containerized');
  const [showFlag, setShowFlag] = useState(false);
  const [staticChallengeFile, setStaticChallengeFile] = useState<File | null>(null);
  const [isDraggingStatic, setIsDraggingStatic] = useState(false);
  const staticFileInputRef = useRef<HTMLInputElement>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingChallengeId, setEditingChallengeId] = useState<string | null>(null);
  const [challengeListKey, setChallengeListKey] = useState(0); // Force re-render of ChallengeList
  
  // Form state
  const [formData, setFormData] = useState({
    challengeName: '',
    description: '',
    challengeType: 'web',
    flagFormat: 'CTF{}',
    challengeMode: 'dynamic', // static | dynamic | multi_flag
    architecture: 'kubernetes', // kubernetes | openstack
    dockerImageSource: 'manual',
    flag: '',
    dockerImage: 'httpd:2.4',
    ports: '80',
    maxTeams: 2,
    points: 100,
    healthCheckPath: '/',
    cpuRequest: '100m',
    memoryRequest: '128Mi',
    environmentVariables: '{"FLAG": "CTF{example}"}',
    isActive: true,
    restrictToTeams: false,
    restrictedTeams: '',
    // Static challenge specific fields
    staticChallengeCategory: 'static',
    staticChallengeType: 'reverse',
    fileDescription: '',
    flagServer: {
      url: '',
      publicKey: '',
      serverToken: '',
      caCertPath: '',
    },
    baydrakService: {
      endpoint: '',
      apiKey: '',
      project: '',
      namespace: '',
      cluster: '',
    },
    flags: [
      { name: 'flag1', mode: 'static', value: '', architecture: 'kubernetes' },
    ],
  });

  const handleInputChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleNumberChange = (field: 'maxTeams' | 'points', delta: number) => {
    setFormData((prev) => ({
      ...prev,
      [field]: Math.max(0, prev[field] + delta),
    }));
  };

  // Static challenge file handling
  const allowedStaticFileTypes = ['.exe', '.zip', '.rar', '.7z', '.pdf', '.txt', '.bin', '.elf', '.py', '.js', '.html', '.pcap', '.pcapng', '.dll', '.so', '.dylib', '.htm'];
  
  const handleStaticFileSelect = (file: File) => {
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!allowedStaticFileTypes.includes(fileExtension)) {
      alert(`File type not allowed. Allowed types: ${allowedStaticFileTypes.join(', ')}`);
      return;
    }
    
    const maxSize = 200 * 1024 * 1024; // 200MB
    if (file.size > maxSize) {
      alert('File size exceeds 200MB limit');
      return;
    }

    setStaticChallengeFile(file);
  };

  const handleStaticDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingStatic(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      handleStaticFileSelect(file);
    }
  };

  const handleStaticDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingStatic(true);
  };

  const handleStaticDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingStatic(false);
  };

  const handleStaticBrowseClick = () => {
    staticFileInputRef.current?.click();
  };

  const handleStaticFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleStaticFileSelect(file);
    }
  };

  // Multi-flag helpers
  const addFlagItem = () => {
    setFormData((prev) => ({
      ...prev,
      flags: [
        ...prev.flags,
        { name: `flag${prev.flags.length + 1}`, mode: 'static', value: '', architecture: prev.architecture },
      ],
    }));
  };

  const updateFlagItem = (index: number, field: string, value: any) => {
    setFormData((prev) => {
      const nextFlags = [...prev.flags];
      nextFlags[index] = { ...nextFlags[index], [field]: value };
      return { ...prev, flags: nextFlags };
    });
  };

  const removeFlagItem = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      flags: prev.flags.filter((_, i) => i !== index),
    }));
  };

  const loadChallengeForEdit = async (challengeId: string) => {
    try {
      const challenge = await challengeAPI.getChallengeById(challengeId);
      
      // Set category
      setCategory(challenge.challenge_category);
      
      // Populate form data
      setFormData({
        challengeName: challenge.name || '',
        description: challenge.description || '',
        challengeType: challenge.config?.challenge_type || 'web',
        flagFormat: 'CTF{}', // Default, not in API response
        challengeMode: challenge.config?.mode || (challenge.challenge_category === 'static' ? 'static' : 'dynamic'),
        architecture: challenge.config?.architecture || (challenge.challenge_category === 'openstack' ? 'openstack' : 'kubernetes'),
        dockerImageSource: 'manual',
        flag: challenge.flag || '',
        dockerImage: challenge.config?.image || 'httpd:2.4',
        ports: challenge.config?.ports?.join(', ') || '80',
        maxTeams: challenge.total_teams || 2,
        points: challenge.points || 100,
        healthCheckPath: '/', // Not in API response
        cpuRequest: challenge.config?.resources?.cpu || '100m',
        memoryRequest: challenge.config?.resources?.memory || '128Mi',
        environmentVariables: challenge.config?.environment_vars
          ? JSON.stringify(challenge.config.environment_vars, null, 2)
          : '{"FLAG": "CTF{example}"}',
        isActive: challenge.is_active ?? true,
        restrictToTeams: challenge.allowed_teams && challenge.allowed_teams.length > 0,
        restrictedTeams: challenge.allowed_teams?.join(', ') || '',
        staticChallengeCategory: 'static',
        staticChallengeType: challenge.config?.challenge_type || 'reverse',
        fileDescription: '', // Not in API response
        flagServer: challenge.config?.flag_server
          ? {
              url: challenge.config.flag_server.url || '',
              publicKey: challenge.config.flag_server.public_key || '',
              serverToken: challenge.config.flag_server.server_token || '',
              caCertPath: challenge.config.flag_server.ca_cert_path || '',
            }
          : {
              url: '',
              publicKey: '',
              serverToken: '',
              caCertPath: '',
            },
        baydrakService: challenge.config?.baydrak_service
          ? {
              endpoint: challenge.config.baydrak_service.endpoint || '',
              apiKey: challenge.config.baydrak_service.api_key || '',
              project: challenge.config.baydrak_service.project || '',
              namespace: challenge.config.baydrak_service.namespace || '',
              cluster: challenge.config.baydrak_service.cluster || '',
            }
          : {
              endpoint: '',
              apiKey: '',
              project: '',
              namespace: '',
              cluster: '',
            },
        flags: challenge.flags && Array.isArray(challenge.flags) && challenge.flags.length > 0
          ? challenge.flags
          : [{ name: 'flag1', mode: 'static', value: '', architecture: 'kubernetes' }],
      });
      
      showToast('Challenge loaded for editing', 'success');
    } catch (error: any) {
      console.error('Failed to load challenge:', error);
      const errorMessage = error.response?.data?.detail || error.response?.data?.message || error.message || 'Failed to load challenge';
      showToast(errorMessage, 'error');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      let challengeData: any;
      
      // If editing, use update endpoint
      if (editingChallengeId) {
        // For updates, we only send changed fields
        const updateData: any = {
          description: formData.description,
          points: formData.points,
          is_active: formData.isActive,
        };
        
        // Update challenge
        showToast('Updating challenge...', 'info');
        await challengeAPI.updateChallenge(editingChallengeId, updateData);
        showToast('Challenge updated successfully!', 'success');
        
        // Reset
        setEditingChallengeId(null);
        setChallengeListKey((prev) => prev + 1);
        setIsSubmitting(false);
        return;
      }

      // Log the category being used
      console.log('Submitting challenge with category:', category);
      
      const derivedCategory =
        formData.architecture === 'openstack'
          ? 'openstack'
          : formData.challengeMode === 'static'
            ? 'static'
            : 'containerized';

      if (formData.challengeMode !== 'static') {
        // Parse ports from comma-separated string to array
        const portsArray = formData.ports
          .split(',')
          .map((p) => parseInt(p.trim()))
          .filter((p) => !isNaN(p));

        // Parse environment variables from JSON string
        let envVars = {};
        try {
          envVars = JSON.parse(formData.environmentVariables || '{}');
        } catch (e) {
          showToast('Invalid JSON in environment variables', 'error');
          setIsSubmitting(false);
          return;
        }

        challengeData = {
          name: formData.challengeName,
          description: formData.description,
          challenge_category: derivedCategory,
          config: {
            challenge_type: formData.challengeType,
            image: formData.dockerImage,
            ports: portsArray,
            environment_vars: envVars,
            resources: {
              cpu: formData.cpuRequest,
              memory: formData.memoryRequest,
            },
            mode: formData.challengeMode,
            architecture: formData.architecture,
            flag_server: {
              url: formData.flagServer.url,
              public_key: formData.flagServer.publicKey,
              server_token: formData.flagServer.serverToken,
              ca_cert_path: formData.flagServer.caCertPath,
            },
            baydrak_service: {
              endpoint: formData.baydrakService.endpoint,
              api_key: formData.baydrakService.apiKey,
              project: formData.baydrakService.project,
              namespace: formData.baydrakService.namespace,
              cluster: formData.baydrakService.cluster,
            },
            flags: formData.challengeMode === 'multi_flag' ? formData.flags : [],
          },
          flag: formData.challengeMode === 'multi_flag' ? null : formData.flag,
          flags: formData.challengeMode === 'multi_flag' ? formData.flags : undefined,
          points: formData.points,
          total_teams: formData.maxTeams,
          is_active: formData.isActive,
          allowed_teams: formData.restrictToTeams && formData.restrictedTeams
            ? formData.restrictedTeams.split(',').map((t) => t.trim()).filter((t) => t)
            : null,
        };
      } else {
        // Static challenge
        if (!staticChallengeFile) {
          showToast('Please upload a challenge file', 'error');
          setIsSubmitting(false);
          return;
        }

        // Upload file first
        showToast('Uploading file...', 'info');
        let fileUploadResponse;
        try {
          fileUploadResponse = await fileAPI.uploadFile(staticChallengeFile);
        } catch (uploadError: any) {
          console.error('File upload error:', uploadError);
          const uploadErrorMessage = uploadError.response?.data?.detail || uploadError.response?.data?.message || uploadError.message || 'Failed to upload file';
          showToast(`File upload failed: ${uploadErrorMessage}`, 'error');
          setIsSubmitting(false);
          return;
        }

        challengeData = {
          name: formData.challengeName,
          description: formData.description,
          challenge_category: derivedCategory,
          config: {
            challenge_type: formData.staticChallengeType,
            file_path: fileUploadResponse.file_path,
            file_name: fileUploadResponse.filename,
            download_url: fileUploadResponse.download_url,
            mode: formData.challengeMode,
            architecture: formData.architecture,
            flag_server: {
              url: formData.flagServer.url,
              public_key: formData.flagServer.publicKey,
              server_token: formData.flagServer.serverToken,
              ca_cert_path: formData.flagServer.caCertPath,
            },
            baydrak_service: {
              endpoint: formData.baydrakService.endpoint,
              api_key: formData.baydrakService.apiKey,
              project: formData.baydrakService.project,
              namespace: formData.baydrakService.namespace,
              cluster: formData.baydrakService.cluster,
            },
          },
          flag: formData.flag,
          flags: formData.challengeMode === 'multi_flag' ? formData.flags : undefined,
          points: formData.points,
          total_teams: formData.maxTeams,
          is_active: formData.isActive,
          allowed_teams: formData.restrictToTeams && formData.restrictedTeams
            ? formData.restrictedTeams.split(',').map((t) => t.trim()).filter((t) => t)
            : null,
        };
      }

      // Validate required fields
      if (!challengeData.name || !challengeData.description) {
        showToast('Please fill in all required fields', 'error');
        setIsSubmitting(false);
        return;
      }

      if (formData.challengeMode !== 'multi_flag' && !challengeData.flag) {
        showToast('Please enter a flag', 'error');
        setIsSubmitting(false);
        return;
      }
      if (formData.challengeMode === 'multi_flag' && (!challengeData.flags || challengeData.flags.length === 0)) {
        showToast('Please add at least one flag', 'error');
        setIsSubmitting(false);
        return;
      }

      // Create challenge
      showToast('Creating challenge...', 'info');
      console.log('Creating challenge with data:', challengeData);
      const response = await challengeAPI.createChallenge(challengeData);
      console.log('Challenge created, response:', response);
      
      showToast('Challenge created successfully!', 'success');
      
      // Reset form
      setFormData({
        challengeName: '',
        description: '',
        challengeType: 'web',
        flagFormat: 'CTF{}',
        challengeMode: 'dynamic',
        architecture: 'kubernetes',
        dockerImageSource: 'manual',
        flag: '',
        dockerImage: 'httpd:2.4',
        ports: '80',
        maxTeams: 2,
        points: 100,
        healthCheckPath: '/',
        cpuRequest: '100m',
        memoryRequest: '128Mi',
        environmentVariables: '{"FLAG": "CTF{example}"}',
        isActive: true,
        restrictToTeams: false,
        restrictedTeams: '',
        staticChallengeCategory: 'static',
        staticChallengeType: 'reverse',
        fileDescription: '',
        flagServer: {
          url: '',
          publicKey: '',
          serverToken: '',
          caCertPath: '',
        },
        baydrakService: {
          endpoint: '',
          apiKey: '',
          project: '',
          namespace: '',
          cluster: '',
        },
        flags: [{ name: 'flag1', mode: 'static', value: '', architecture: 'kubernetes' }],
      });
      setStaticChallengeFile(null);
      setShowFlag(false);
      setEditingChallengeId(null);
      // Reset category to default after successful creation
      setCategory('containerized');
      
      // Always refresh challenge list to show the new challenge
      setChallengeListKey((prev) => prev + 1);
      
      // If we're on list view, the list will auto-refresh
      // If we're on create view, switch to list view to show the new challenge
      if (activeAction === 'create') {
        // Optionally switch to list view to see the created challenge
        // setActiveAction('list');
      }

      console.log('Challenge created:', response);
      console.log('Created challenge category:', response?.challenge_category || response?.category);
    } catch (error: any) {
      console.error('Failed to create challenge:', error);
      const errorMessage = error.response?.data?.detail || error.response?.data?.message || error.message || 'Failed to create challenge';
      showToast(errorMessage, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Challenge Management Header */}
      <div>
        <h3 className="text-2xl font-bold text-white mb-4 gradient-text">
          Challenge Management
        </h3>
        
        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3 mb-6 bg-cyber-900/80 backdrop-blur-xl rounded-xl shadow-lg border border-neon-green/20 p-2 terminal-border">
          <button
            onClick={() => setActiveAction('create')}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg font-semibold text-sm transition-all relative overflow-hidden ${
              activeAction === 'create'
                ? 'bg-neon-green/20 text-neon-green border border-neon-green/50 shadow-lg shadow-neon-green/20'
                : 'text-white/60 hover:text-white hover:bg-cyber-800/50'
            }`}
          >
            {activeAction === 'create' && (
              <div className="absolute inset-0 bg-neon-green/10 animate-pulse" />
            )}
            <Plus size={16} className="relative z-10" />
            <span className="relative z-10">Create</span>
          </button>
          <button
            onClick={() => setActiveAction('list')}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg font-semibold text-sm transition-all relative overflow-hidden ${
              activeAction === 'list'
                ? 'bg-neon-green/20 text-neon-green border border-neon-green/50 shadow-lg shadow-neon-green/20'
                : 'text-white/60 hover:text-white hover:bg-cyber-800/50'
            }`}
          >
            {activeAction === 'list' && (
              <div className="absolute inset-0 bg-neon-green/10 animate-pulse" />
            )}
            <List size={16} className="relative z-10" />
            <span className="relative z-10">List All</span>
          </button>
          <button
            onClick={() => setActiveAction('delete')}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg font-semibold text-sm transition-all relative overflow-hidden ${
              activeAction === 'delete'
                ? 'bg-neon-orange/20 text-neon-orange border border-neon-orange/50 shadow-lg shadow-neon-orange/20'
                : 'text-white/60 hover:text-white hover:bg-cyber-800/50'
            }`}
          >
            {activeAction === 'delete' && (
              <div className="absolute inset-0 bg-neon-orange/10 animate-pulse" />
            )}
            <Trash2 size={16} className="relative z-10" />
            <span className="relative z-10">Delete</span>
          </button>
        </div>
      </div>

      {/* Create Challenge Form */}
      {activeAction === 'create' && (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <h4 className="text-xl font-bold text-white mb-4 gradient-text">
              {editingChallengeId ? 'Edit Challenge' : 'Create New Challenge'}
            </h4>

            {/* Challenge Mode */}
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <label className="block text-sm font-semibold text-white/90">
                  Challenge Mode *
                </label>
                <HelpCircle className="text-white/60" size={16} />
              </div>
              <RadioGroup
                options={[
                  { value: 'static', label: 'Static' },
                  { value: 'dynamic', label: 'Dynamic' },
                  { value: 'multi_flag', label: 'Multi-Flag' },
                ]}
                value={formData.challengeMode}
                onChange={(value) => {
                  setFormData((prev) => ({ ...prev, challengeMode: value }));
                  // Keep category for legacy branch selection
                  setCategory(value === 'static' ? 'static' : 'containerized');
                }}
              />
            </div>

            {/* Architecture Selector */}
            <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select
                label="Architecture"
                value={formData.architecture}
                onChange={(e) => setFormData((prev) => ({ ...prev, architecture: e.target.value }))}
                options={[
                  { value: 'kubernetes', label: 'Kubernetes' },
                  { value: 'openstack', label: 'OpenStack' },
                ]}
              />
              <Select
                label="Challenge Type"
                value={formData.challengeType}
                onChange={(e) => handleInputChange('challengeType', e.target.value)}
                options={[
                  { value: 'web', label: 'web' },
                  { value: 'jwt', label: 'jwt' },
                  { value: 'crypto', label: 'crypto' },
                  { value: 'reverse', label: 'reverse' },
                  { value: 'pwn', label: 'pwn' },
                  { value: 'forensics', label: 'forensics' },
                  { value: 'misc', label: 'misc' },
                ]}
              />
            </div>

            {/* Containerized Challenge Section */}
            {formData.challengeMode !== 'static' && (
              <div className="bg-cyber-900/80 backdrop-blur-xl rounded-2xl shadow-lg border border-neon-green/20 terminal-border p-6 space-y-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-neon-green/20 backdrop-blur-sm rounded-xl flex items-center justify-center border border-neon-green/40">
                    <Container className="text-neon-green" size={20} />
                  </div>
                  <h5 className="text-lg font-bold text-white">
                    {formData.challengeMode === 'dynamic' ? 'Dynamic Challenge' : 'Multi-Flag Challenge'}
                  </h5>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Left Column */}
                  <div className="space-y-4">
                    <Input
                      label="Challenge Name *"
                      value={formData.challengeName}
                      onChange={(e) => handleInputChange('challengeName', e.target.value)}
                      placeholder="Enter challenge name"
                    />

                    <div>
                      <label className="block text-sm font-semibold text-white/90 mb-2">
                        &gt; DESCRIPTION *
                      </label>
                      <textarea
                        value={formData.description}
                        onChange={(e) => handleInputChange('description', e.target.value)}
                        placeholder="Enter challenge description"
                        rows={4}
                        className="w-full px-4 py-3 bg-cyber-800/50 border-2 border-neon-green/20 rounded-xl text-white placeholder:text-white/40 focus:outline-none focus:border-neon-green focus:ring-2 focus:ring-neon-green/20 transition-all resize-y"
                      />
                    </div>

                    <Input
                      label="Flag Format"
                      value={formData.flagFormat}
                      onChange={(e) => handleInputChange('flagFormat', e.target.value)}
                      placeholder="CTF{}"
                    />

                    <Select
                      label="Docker Image Source"
                      value={formData.dockerImageSource}
                      onChange={(e) => handleInputChange('dockerImageSource', e.target.value)}
                      options={[
                        { value: 'manual', label: '(type manually)' },
                        
                      ]}
                    />

                    {formData.challengeMode === 'dynamic' && (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <label className="block text-xs font-mono font-semibold text-neon-green tracking-wider">
                            &gt; FLAG (SECRET)
                          </label>
                          <HelpCircle className="text-white/60" size={16} />
                        </div>
                        <div className="relative">
                          <input
                            type={showFlag ? 'text' : 'password'}
                            value={formData.flag}
                            onChange={(e) => handleInputChange('flag', e.target.value)}
                            placeholder="Enter flag"
                            className="w-full px-4 py-3 pr-10 bg-cyber-800/50 border-2 border-neon-green/20 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:border-neon-green focus:ring-4 focus:ring-neon-green/20 transition-all"
                          />
                          <button
                            type="button"
                            onClick={() => setShowFlag(!showFlag)}
                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-white/40 hover:text-neon-green transition-colors"
                          >
                            {showFlag ? <EyeOff size={18} /> : <Eye size={18} />}
                          </button>
                        </div>
                      </div>
                    )}

                    {formData.challengeMode === 'multi_flag' && (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 mb-1">
                          <label className="block text-xs font-mono font-semibold text-neon-green tracking-wider">
                            &gt; FLAGS
                          </label>
                          <HelpCircle className="text-white/60" size={16} />
                        </div>
                        {formData.flags.map((flag, idx) => (
                          <div key={idx} className="border border-neon-green/30 rounded-xl p-4 space-y-3 bg-cyber-800/30">
                            <div className="flex items-center justify-between gap-3">
                              <Input
                                label="Flag Name"
                                value={flag.name}
                                onChange={(e) => updateFlagItem(idx, 'name', e.target.value)}
                                placeholder="flag1"
                              />
                              <Select
                                label="Mode"
                                value={flag.mode}
                                onChange={(e) => updateFlagItem(idx, 'mode', e.target.value)}
                                options={[
                                  { value: 'static', label: 'Static' },
                                  { value: 'dynamic', label: 'Dynamic' },
                                ]}
                              />
                              <Select
                                label="Architecture"
                                value={flag.architecture || formData.architecture}
                                onChange={(e) => updateFlagItem(idx, 'architecture', e.target.value)}
                                options={[
                                  { value: 'kubernetes', label: 'Kubernetes' },
                                  { value: 'openstack', label: 'OpenStack' },
                                ]}
                              />
                            </div>
                            <Input
                              label={flag.mode === 'static' ? 'Flag Value' : 'Flag Value (encrypted at delivery)'}
                              value={flag.value}
                              onChange={(e) => updateFlagItem(idx, 'value', e.target.value)}
                              placeholder={flag.mode === 'static' ? 'CTF{...}' : 'Optional dynamic seed'}
                            />
                            <div className="flex justify-end">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => removeFlagItem(idx)}
                                className="border-neon-orange/40 text-neon-orange hover:bg-neon-orange/10"
                              >
                                Remove
                              </Button>
                            </div>
                          </div>
                        ))}
                        <Button type="button" variant="outline" size="sm" onClick={addFlagItem}>
                          Add Flag
                        </Button>
                      </div>
                    )}

                    <Input
                      label="Docker Image *"
                      value={formData.dockerImage}
                      onChange={(e) => handleInputChange('dockerImage', e.target.value)}
                      placeholder="httpd:2.4"
                    />

                    <Input
                      label="Ports (comma separated) *"
                      value={formData.ports}
                      onChange={(e) => handleInputChange('ports', e.target.value)}
                      placeholder="80"
                    />

                    <div>
                      <label className="block text-sm font-semibold text-white/90 mb-2">
                        &gt; MAX TEAMS *
                      </label>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => handleNumberChange('maxTeams', -1)}
                          className="w-10 h-10 flex items-center justify-center bg-cyber-800/50 border-2 border-neon-green/20 rounded-lg hover:border-neon-green transition-all text-white/90 hover:text-neon-green"
                        >
                          <Minus size={16} />
                        </button>
                        <input
                          type="number"
                          value={formData.maxTeams}
                          onChange={(e) => handleInputChange('maxTeams', parseInt(e.target.value) || 0)}
                          min="0"
                          className="w-20 px-3 py-2 bg-cyber-800/50 border-2 border-neon-green/20 font-mono text-sm text-white text-center focus:outline-none focus:border-neon-green focus:bg-cyber-800/70 transition-all"
                        />
                        <button
                          type="button"
                          onClick={() => handleNumberChange('maxTeams', 1)}
                          className="w-10 h-10 flex items-center justify-center bg-cyber-800/50 border-2 border-neon-green/20 rounded-lg hover:border-neon-green transition-all text-white/90 hover:text-neon-green"
                        >
                          <PlusIcon size={16} />
                        </button>
                      </div>
                    </div>

                    <InfoBox
                      type="info"
                      message="Deployment Model: Teams start their own instances independently (saves resources). Master can use 'Deploy All' to deploy for all teams at once."
                    />
                  </div>

                  {/* Right Column */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-white/90 mb-2">
                        &gt; POINTS
                      </label>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => handleNumberChange('points', -10)}
                          className="w-10 h-10 flex items-center justify-center bg-cyber-800/50 border-2 border-neon-green/20 rounded-lg hover:border-neon-green transition-all text-white/90 hover:text-neon-green"
                        >
                          <Minus size={16} />
                        </button>
                        <input
                          type="number"
                          value={formData.points}
                          onChange={(e) => handleInputChange('points', parseInt(e.target.value) || 0)}
                          min="0"
                          className="w-24 px-3 py-2 bg-cyber-800/50 border-2 border-neon-green/20 font-mono text-sm text-white text-center focus:outline-none focus:border-neon-green focus:bg-cyber-800/70 transition-all"
                        />
                        <button
                          type="button"
                          onClick={() => handleNumberChange('points', 10)}
                          className="w-10 h-10 flex items-center justify-center bg-cyber-800/50 border-2 border-neon-green/20 rounded-lg hover:border-neon-green transition-all text-white/90 hover:text-neon-green"
                        >
                          <PlusIcon size={16} />
                        </button>
                      </div>
                    </div>

                    <Input
                      label="Health Check Path"
                      value={formData.healthCheckPath}
                      onChange={(e) => handleInputChange('healthCheckPath', e.target.value)}
                      placeholder="/"
                    />

                    <Input
                      label="CPU Request"
                      value={formData.cpuRequest}
                      onChange={(e) => handleInputChange('cpuRequest', e.target.value)}
                      placeholder="100m"
                    />

                    <Input
                      label="Memory Request"
                      value={formData.memoryRequest}
                      onChange={(e) => handleInputChange('memoryRequest', e.target.value)}
                      placeholder="128Mi"
                    />

                    <div>
                      <label className="block text-sm font-semibold text-white/90 mb-2">
                        Environment Variables (JSON Format)
                      </label>
                      <textarea
                        value={formData.environmentVariables}
                        onChange={(e) => handleInputChange('environmentVariables', e.target.value)}
                        placeholder='{"FLAG": "CTF{example}"}'
                        rows={4}
                        className="w-full px-4 py-3 bg-cyber-800/50 border-2 border-neon-green/20 rounded-xl text-white placeholder:text-white/40 focus:outline-none focus:border-neon-green focus:ring-2 focus:ring-neon-green/20 transition-all resize-y font-mono text-sm"
                      />
                    </div>

                    {(formData.challengeMode === 'dynamic' || formData.challengeMode === 'multi_flag') && (
                      <div className="space-y-4">
                        <div className="border border-neon-green/20 rounded-xl p-4">
                          <h6 className="text-white font-semibold mb-2">Flag Server (HTTPS)</h6>
                          <Input
                            label="Flag Server URL"
                            value={formData.flagServer.url}
                            onChange={(e) => setFormData((prev) => ({ ...prev, flagServer: { ...prev.flagServer, url: e.target.value } }))}
                            placeholder="https://flag-server.local/api/v1/flag-server"
                          />
                          <Input
                            label="Server Token"
                          value={formData.flagServer.serverToken}
                          onChange={(e) => setFormData((prev) => ({ ...prev, flagServer: { ...prev.flagServer, serverToken: e.target.value } }))}
                            placeholder="Shared token for flag server"
                          />
                          <Input
                            label="Server Public Key (PEM)"
                          value={formData.flagServer.publicKey}
                          onChange={(e) => setFormData((prev) => ({ ...prev, flagServer: { ...prev.flagServer, publicKey: e.target.value } }))}
                            placeholder="-----BEGIN PUBLIC KEY-----"
                          />
                        </div>

                        <div className="border border-neon-cyan/20 rounded-xl p-4">
                          <h6 className="text-white font-semibold mb-2">Baydrak Service</h6>
                          <Input
                            label="Endpoint"
                            value={formData.baydrakService.endpoint}
                            onChange={(e) => setFormData((prev) => ({ ...prev, baydrakService: { ...prev.baydrakService, endpoint: e.target.value } }))}
                            placeholder="https://baydrak.service"
                          />
                          <Input
                            label="API Key"
                            value={formData.baydrakService.apiKey}
                            onChange={(e) => setFormData((prev) => ({ ...prev, baydrakService: { ...prev.baydrakService, apiKey: e.target.value } }))}
                            placeholder="API key"
                          />
                          <Input
                            label="Project"
                            value={formData.baydrakService.project}
                            onChange={(e) => setFormData((prev) => ({ ...prev, baydrakService: { ...prev.baydrakService, project: e.target.value } }))}
                            placeholder="Project / tenant"
                          />
                          <Input
                            label="Namespace / Cluster"
                            value={formData.baydrakService.namespace}
                            onChange={(e) => setFormData((prev) => ({ ...prev, baydrakService: { ...prev.baydrakService, namespace: e.target.value } }))}
                            placeholder="Namespace"
                          />
                          <Input
                            label="Cluster"
                            value={formData.baydrakService.cluster}
                            onChange={(e) => setFormData((prev) => ({ ...prev, baydrakService: { ...prev.baydrakService, cluster: e.target.value } }))}
                            placeholder="Cluster/region"
                          />
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="isActive"
                        checked={formData.isActive}
                        onChange={(e) => handleInputChange('isActive', e.target.checked)}
                        className="w-4 h-4 text-neon-green focus:ring-neon-green focus:ring-2 accent-neon-green"
                      />
                      <label htmlFor="isActive" className="text-sm text-white/90 cursor-pointer">
                        Active (visible to teams)
                      </label>
                    </div>
                  </div>
                </div>

                {/* Team Restrictions Section */}
                <div className="mt-6 pt-6 border-t border-neon-green/20">
                  <InfoBox
                    type="info"
                    message="Leave empty to allow ALL teams to see this challenge. Select specific teams to restrict access."
                  />
                  
                  <div className="mt-4 space-y-4">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="restrictToTeams"
                        checked={formData.restrictToTeams}
                        onChange={(e) => handleInputChange('restrictToTeams', e.target.checked)}
                        className="w-4 h-4 text-neon-green focus:ring-neon-green focus:ring-2 accent-neon-green"
                      />
                      <label htmlFor="restrictToTeams" className="text-sm text-white/90 cursor-pointer">
                        Restrict to specific teams
                      </label>
                    </div>

                    {formData.restrictToTeams && (
                      <Input
                        label=""
                        value={formData.restrictedTeams}
                        onChange={(e) => handleInputChange('restrictedTeams', e.target.value)}
                        placeholder="Enter team codes (comma separated)"
                      />
                    )}
                  </div>
                </div>

                {/* Submit Button */}
                <div className="mt-6 flex justify-center">
                  <Button
                    type="submit"
                    variant="outline"
                    size="md"
                    disabled={isSubmitting}
                    className="badge-military font-mono font-semibold tracking-wider"
                  >
                    <Rocket size={18} className={`mr-2 ${isSubmitting ? 'animate-spin' : ''}`} />
                    {isSubmitting ? 'Creating...' : 'Create Challenge'}
                  </Button>
                </div>
              </div>
            )}

            {/* Static Challenge Section */}
            {formData.challengeMode === 'static' && (
              <div className="bg-cyber-900/80 backdrop-blur-xl rounded-2xl shadow-lg border border-neon-cyan/20 terminal-border p-6 space-y-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-neon-cyan/20 backdrop-blur-sm rounded-xl flex items-center justify-center border border-neon-cyan/40">
                    <Folder className="text-neon-cyan" size={20} />
                  </div>
                  <h5 className="text-lg font-bold text-white">
                    Static Challenge
                  </h5>
                </div>

                {/* Info Box */}
                <InfoBox
                  type="info"
                  message="Creating STATIC Challenge - Teams will download a file"
                />

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Left Column */}
                  <div className="space-y-4">
                    <Input
                      label="Challenge Name *"
                      value={formData.challengeName}
                      onChange={(e) => handleInputChange('challengeName', e.target.value)}
                      placeholder="Enter challenge name"
                    />

                    <div>
                      <label className="block text-sm font-semibold text-white/90 mb-2">
                        &gt; DESCRIPTION *
                      </label>
                      <textarea
                        value={formData.description}
                        onChange={(e) => handleInputChange('description', e.target.value)}
                        placeholder="Enter challenge description"
                        rows={4}
                        className="w-full px-4 py-3 bg-cyber-800/50 border-2 border-neon-green/20 rounded-xl text-white placeholder:text-white/40 focus:outline-none focus:border-neon-green focus:ring-2 focus:ring-neon-green/20 transition-all resize-y"
                      />
                    </div>

                    <Input
                      label="Challenge Category"
                      value={formData.staticChallengeCategory}
                      onChange={(e) => handleInputChange('staticChallengeCategory', e.target.value)}
                      placeholder="static"
                    />

                    <Select
                      label="Challenge Type"
                      value={formData.staticChallengeType}
                      onChange={(e) => handleInputChange('staticChallengeType', e.target.value)}
                      options={[
                        { value: 'web', label: 'web' },
                        { value: 'jwt', label: 'jwt' },
                        { value: 'crypto', label: 'crypto' },
                        { value: 'reverse', label: 'reverse' },
                        { value: 'pwn', label: 'pwn' },
                        { value: 'forensics', label: 'forensics' },
                        { value: 'misc', label: 'misc' },
                      ]}
                    />

                    {/* Upload Challenge File */}
                    <div>
                      <label className="block text-sm font-semibold text-white/90 mb-3">
                        Upload Challenge File *
                      </label>
                      
                      <div className="flex flex-col lg:flex-row gap-4">
                        <div
                          onDrop={handleStaticDrop}
                          onDragOver={handleStaticDragOver}
                          onDragLeave={handleStaticDragLeave}
                          onClick={handleStaticBrowseClick}
                          className={`
                            flex-1 min-h-[150px] border-2 border-dashed rounded-xl
                            flex flex-col items-center justify-center gap-3 p-6
                            cursor-pointer transition-all
                            ${
                              isDraggingStatic
                                ? 'border-neon-cyan bg-neon-cyan/10'
                                : 'border-neon-cyan/30 hover:border-neon-cyan/50 bg-cyber-800/30'
                            }
                          `}
                        >
                          <input
                            ref={staticFileInputRef}
                            type="file"
                            accept={allowedStaticFileTypes.join(',')}
                            onChange={handleStaticFileInputChange}
                            className="hidden"
                          />
                          
                          {staticChallengeFile ? (
                            <>
                              <FileArchive className="text-neon-cyan" size={40} />
                              <div className="text-center">
                                <p className="text-sm text-neon-cyan font-semibold mb-1">
                                  {staticChallengeFile.name}
                                </p>
                                <p className="text-xs text-white/60">
                                  {(staticChallengeFile.size / (1024 * 1024)).toFixed(2)} MB
                                </p>
                                <p className="text-xs text-white/40 mt-2">
                                  Click to change file
                                </p>
                              </div>
                            </>
                          ) : (
                            <>
                              <Upload className="text-white/40" size={40} />
                              <div className="text-center">
                                <p className="text-sm text-white/80 mb-1">
                                  Drag and drop file here
                                </p>
                                <p className="text-xs text-white/60">
                                  Limit 200MB per file
                                </p>
                                <p className="text-xs text-white/40 mt-1">
                                  EXE, ZIP, RAR, 7Z, PDF, TXT, BIN, ELF, PY, JS, HTML, PCAP, PCAPNG, DLL, SO, DYLIB, HTM
                                </p>
                              </div>
                            </>
                          )}
                        </div>

                        <div className="flex items-center lg:items-start lg:pt-8">
                          <Button
                            type="button"
                            variant="outline"
                            size="md"
                            onClick={handleStaticBrowseClick}
                            className="whitespace-nowrap"
                          >
                            Browse files
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-white/90 mb-2">
                        &gt; MAX TEAMS *
                      </label>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => handleNumberChange('maxTeams', -1)}
                          className="w-10 h-10 flex items-center justify-center bg-cyber-800/50 border-2 border-neon-green/20 rounded-lg hover:border-neon-green transition-all text-white/90 hover:text-neon-green"
                        >
                          <Minus size={16} />
                        </button>
                        <input
                          type="number"
                          value={formData.maxTeams}
                          onChange={(e) => handleInputChange('maxTeams', parseInt(e.target.value) || 0)}
                          min="0"
                          className="w-20 px-3 py-2 bg-cyber-800/50 border-2 border-neon-green/20 font-mono text-sm text-white text-center focus:outline-none focus:border-neon-green focus:bg-cyber-800/70 transition-all"
                        />
                        <button
                          type="button"
                          onClick={() => handleNumberChange('maxTeams', 1)}
                          className="w-10 h-10 flex items-center justify-center bg-cyber-800/50 border-2 border-neon-green/20 rounded-lg hover:border-neon-green transition-all text-white/90 hover:text-neon-green"
                        >
                          <PlusIcon size={16} />
                        </button>
                      </div>
                    </div>

                    <InfoBox
                      type="info"
                      message="Static Challenge: Teams will get a download link when they start this challenge."
                    />
                  </div>

                  {/* Right Column */}
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <label className="block text-sm font-semibold text-white/90">
                          Flag Format
                        </label>
                        <HelpCircle className="text-white/40" size={16} />
                      </div>
                      <input
                        type="text"
                        value={formData.flagFormat}
                        onChange={(e) => handleInputChange('flagFormat', e.target.value)}
                        placeholder="CTF{}"
                        className="w-full px-4 py-3 bg-cyber-800/50 border-2 border-neon-green/20 rounded-xl text-white placeholder:text-white/40 focus:outline-none focus:border-neon-green focus:ring-2 focus:ring-neon-green/20 transition-all"
                      />
                    </div>

                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <label className="block text-sm font-semibold text-white/90">
                          Flag (Secret) *
                        </label>
                        <HelpCircle className="text-white/40" size={16} />
                      </div>
                      <div className="relative">
                        <input
                          type={showFlag ? 'text' : 'password'}
                          value={formData.flag}
                          onChange={(e) => handleInputChange('flag', e.target.value)}
                          placeholder="Enter flag"
                          className="w-full px-4 py-3 pr-10 bg-cyber-800/50 border-2 border-neon-green/20 rounded-xl text-white placeholder:text-white/40 focus:outline-none focus:border-neon-green focus:ring-2 focus:ring-neon-green/20 transition-all"
                        />
                        <button
                          type="button"
                          onClick={() => setShowFlag(!showFlag)}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-white/40 hover:text-white/60 transition-colors"
                        >
                          {showFlag ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-white/90 mb-2">
                        Points
                      </label>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => handleNumberChange('points', -10)}
                          className="w-10 h-10 flex items-center justify-center bg-cyber-800/50 border-2 border-neon-green/20 rounded-lg hover:border-neon-green transition-all text-white/90 hover:text-neon-green"
                        >
                          <Minus size={16} />
                        </button>
                        <input
                          type="number"
                          value={formData.points}
                          onChange={(e) => handleInputChange('points', parseInt(e.target.value) || 0)}
                          min="0"
                          className="w-24 px-3 py-2 bg-cyber-800/50 border-2 border-neon-green/20 font-mono text-sm text-white text-center focus:outline-none focus:border-neon-green focus:bg-cyber-800/70 transition-all"
                        />
                        <button
                          type="button"
                          onClick={() => handleNumberChange('points', 10)}
                          className="w-10 h-10 flex items-center justify-center bg-cyber-800/50 border-2 border-neon-green/20 rounded-lg hover:border-neon-green transition-all text-white/90 hover:text-neon-green"
                        >
                          <PlusIcon size={16} />
                        </button>
                      </div>
                    </div>

                    <Input
                      label="File Description"
                      value={formData.fileDescription}
                      onChange={(e) => handleInputChange('fileDescription', e.target.value)}
                      placeholder="e.g., 'Windows executable with hidden flag'"
                    />

                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="staticIsActive"
                        checked={formData.isActive}
                        onChange={(e) => handleInputChange('isActive', e.target.checked)}
                        className="w-4 h-4 text-neon-green focus:ring-neon-green focus:ring-2 accent-neon-green"
                      />
                      <label htmlFor="staticIsActive" className="text-sm text-white/90 cursor-pointer">
                        Active (visible to teams)
                      </label>
                    </div>

                    <InfoBox
                      type="info"
                      message="Teams will download the file and work on it locally."
                    />
                  </div>
                </div>

                {/* Team Restrictions Section */}
                <div className="mt-6 pt-6 border-t border-neon-green/20">
                  <div className="flex items-center gap-2 mb-4">
                    <Lock className="text-white/60" size={18} />
                    <h6 className="text-base font-bold text-white">
                      Team Restrictions (Optional)
                    </h6>
                  </div>

                  <InfoBox
                    type="info"
                    message="Leave empty to allow ALL teams to see this challenge. Select specific teams to restrict access."
                  />
                  
                  <div className="mt-4 space-y-4">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="staticRestrictToTeams"
                        checked={formData.restrictToTeams}
                        onChange={(e) => handleInputChange('restrictToTeams', e.target.checked)}
                        className="w-4 h-4 text-neon-green focus:ring-neon-green focus:ring-2 accent-neon-green"
                      />
                      <label htmlFor="staticRestrictToTeams" className="text-sm text-white/90 cursor-pointer">
                        Restrict to specific teams
                      </label>
                    </div>

                    {formData.restrictToTeams && (
                      <Input
                        label=""
                        value={formData.restrictedTeams}
                        onChange={(e) => handleInputChange('restrictedTeams', e.target.value)}
                        placeholder="Enter team codes (comma separated)"
                      />
                    )}
                  </div>
                </div>

                {/* Submit Button */}
                <div className="mt-6 flex justify-center">
                  <Button
                    type="submit"
                    variant="outline"
                    size="md"
                    disabled={isSubmitting}
                    className="badge-military font-mono font-semibold tracking-wider"
                  >
                    <Rocket size={18} className={`mr-2 ${isSubmitting ? 'animate-spin' : ''}`} />
                    {isSubmitting ? 'Creating...' : 'Create Challenge'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </form>
      )}

      {/* List All Challenges */}
      {activeAction === 'list' && (
        <ChallengeList
          key={challengeListKey}
          onEdit={(challengeId) => {
            setEditingChallengeId(challengeId);
            setActiveAction('create');
            // Load challenge data for editing
            loadChallengeForEdit(challengeId);
          }}
        />
      )}

      {/* Delete Challenges */}
      {activeAction === 'delete' && <ChallengeDeleteView />}
    </div>
  );
};

