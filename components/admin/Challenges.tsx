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
      
      if (category === 'containerized') {
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
          challenge_category: category, // Use the category state variable
          config: {
            challenge_type: formData.challengeType,
            image: formData.dockerImage,
            ports: portsArray,
            environment_vars: envVars,
            resources: {
              cpu: formData.cpuRequest,
              memory: formData.memoryRequest,
            },
          },
          flag: formData.flag,
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
          challenge_category: category, // Use the category state variable
          config: {
            challenge_type: formData.staticChallengeType,
            file_path: fileUploadResponse.file_path,
            file_name: fileUploadResponse.filename,
            download_url: fileUploadResponse.download_url,
          },
          flag: formData.flag,
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

      if (!challengeData.flag) {
        showToast('Please enter a flag', 'error');
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
        <h3 className="text-2xl font-bold text-brown-900 mb-4">
          Challenge Management
        </h3>
        
        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3 mb-6 bg-white rounded-xl shadow-md border border-brown-200 p-2">
          <button
            onClick={() => setActiveAction('create')}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg font-semibold text-sm transition-all ${
              activeAction === 'create'
                ? 'bg-green-500 text-white shadow-md'
                : 'text-brown-700 hover:bg-brown-50'
            }`}
          >
            <Plus size={16} />
            Create
          </button>
          <button
            onClick={() => setActiveAction('list')}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg font-semibold text-sm transition-all ${
              activeAction === 'list'
                ? 'bg-green-500 text-white shadow-md'
                : 'text-brown-700 hover:bg-brown-50'
            }`}
          >
            <List size={16} />
            List All
          </button>
          <button
            onClick={() => setActiveAction('delete')}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg font-semibold text-sm transition-all ${
              activeAction === 'delete'
                ? 'bg-green-500 text-white shadow-md'
                : 'text-brown-700 hover:bg-brown-50'
            }`}
          >
            <Trash2 size={16} />
            Delete
          </button>
        </div>
      </div>

      {/* Create Challenge Form */}
      {activeAction === 'create' && (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <h4 className="text-xl font-bold text-brown-900 mb-4">
              {editingChallengeId ? 'Edit Challenge' : 'Create New Challenge'}
            </h4>

            {/* Challenge Category */}
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <label className="block text-sm font-semibold text-brown-700">
                  Challenge Category *
                </label>
                <HelpCircle className="text-brown-400" size={16} />
              </div>
              <RadioGroup
                options={[
                  { value: 'containerized', label: 'Containerized' },
                  { value: 'static', label: 'Static' },
                ]}
                value={category}
                onChange={(value) => {
                  console.log('Category changed to:', value);
                  setCategory(value as ChallengeCategory);
                }}
              />
            </div>

            {/* Containerized Challenge Section */}
            {category === 'containerized' && (
              <div className="bg-white rounded-2xl shadow-md border border-brown-200 p-6 space-y-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                    <Container className="text-green-600" size={20} />
                  </div>
                  <h5 className="text-lg font-bold text-brown-900">
                    Containerized Challenge
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
                      <label className="block text-sm font-semibold text-brown-700 mb-2">
                        &gt; DESCRIPTION *
                      </label>
                      <textarea
                        value={formData.description}
                        onChange={(e) => handleInputChange('description', e.target.value)}
                        placeholder="Enter challenge description"
                        rows={4}
                        className="w-full px-4 py-3 bg-brown-50 border-2 border-brown-200 rounded-xl text-brown-900 placeholder:text-brown-400 focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20 transition-all resize-y"
                      />
                    </div>

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

                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <label className="block text-xs font-mono font-semibold text-accent tracking-wider">
                          &gt; FLAG (SECRET)
                        </label>
                        <HelpCircle className="text-brown-400" size={16} />
                      </div>
                      <div className="relative">
                        <input
                          type={showFlag ? 'text' : 'password'}
                          value={formData.flag}
                          onChange={(e) => handleInputChange('flag', e.target.value)}
                          placeholder="Enter flag"
                          className="w-full px-4 py-3 pr-10 bg-brown-50 border-2 border-brown-200 rounded-xl text-brown-900 placeholder:text-brown-400 focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20 transition-all"
                        />
                        <button
                          type="button"
                          onClick={() => setShowFlag(!showFlag)}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-secondary hover:text-accent transition-colors"
                        >
                          {showFlag ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </div>

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
                      <label className="block text-sm font-semibold text-brown-700 mb-2">
                        &gt; MAX TEAMS *
                      </label>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => handleNumberChange('maxTeams', -1)}
                          className="w-10 h-10 flex items-center justify-center bg-brown-50 border-2 border-brown-200 rounded-lg hover:border-green-500 transition-all text-brown-700 hover:text-green-600"
                        >
                          <Minus size={16} />
                        </button>
                        <input
                          type="number"
                          value={formData.maxTeams}
                          onChange={(e) => handleInputChange('maxTeams', parseInt(e.target.value) || 0)}
                          min="0"
                          className="w-20 px-3 py-2 bg-secondary/20 border-2 border-secondary font-mono text-sm text-text text-center focus:outline-none focus:border-accent focus:bg-secondary/30 transition-all"
                        />
                        <button
                          type="button"
                          onClick={() => handleNumberChange('maxTeams', 1)}
                          className="w-10 h-10 flex items-center justify-center bg-brown-50 border-2 border-brown-200 rounded-lg hover:border-green-500 transition-all text-brown-700 hover:text-green-600"
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
                      <label className="block text-sm font-semibold text-brown-700 mb-2">
                        &gt; POINTS
                      </label>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => handleNumberChange('points', -10)}
                          className="w-10 h-10 flex items-center justify-center bg-brown-50 border-2 border-brown-200 rounded-lg hover:border-green-500 transition-all text-brown-700 hover:text-green-600"
                        >
                          <Minus size={16} />
                        </button>
                        <input
                          type="number"
                          value={formData.points}
                          onChange={(e) => handleInputChange('points', parseInt(e.target.value) || 0)}
                          min="0"
                          className="w-24 px-3 py-2 bg-secondary/20 border-2 border-secondary font-mono text-sm text-text text-center focus:outline-none focus:border-accent focus:bg-secondary/30 transition-all"
                        />
                        <button
                          type="button"
                          onClick={() => handleNumberChange('points', 10)}
                          className="w-10 h-10 flex items-center justify-center bg-brown-50 border-2 border-brown-200 rounded-lg hover:border-green-500 transition-all text-brown-700 hover:text-green-600"
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
                      <label className="block text-sm font-semibold text-brown-700 mb-2">
                        Environment Variables (JSON Format)
                      </label>
                      <textarea
                        value={formData.environmentVariables}
                        onChange={(e) => handleInputChange('environmentVariables', e.target.value)}
                        placeholder='{"FLAG": "CTF{example}"}'
                        rows={4}
                        className="w-full px-4 py-3 bg-brown-50 border-2 border-brown-200 rounded-xl text-brown-900 placeholder:text-brown-400 focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20 transition-all resize-y font-mono text-sm"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="isActive"
                        checked={formData.isActive}
                        onChange={(e) => handleInputChange('isActive', e.target.checked)}
                        className="w-4 h-4 text-green-500 focus:ring-green-500 focus:ring-2 accent-green-500"
                      />
                      <label htmlFor="isActive" className="text-sm text-brown-700 cursor-pointer">
                        Active (visible to teams)
                      </label>
                    </div>
                  </div>
                </div>

                {/* Team Restrictions Section */}
                <div className="mt-6 pt-6 border-t border-brown-200">
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
                        className="w-4 h-4 text-green-500 focus:ring-green-500 focus:ring-2 accent-green-500"
                      />
                      <label htmlFor="restrictToTeams" className="text-sm text-brown-700 cursor-pointer">
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
            {category === 'static' && (
              <div className="bg-white rounded-2xl shadow-md border border-brown-200 p-6 space-y-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
                    <Folder className="text-orange-600" size={20} />
                  </div>
                  <h5 className="text-lg font-bold text-brown-900">
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
                      <label className="block text-sm font-semibold text-brown-700 mb-2">
                        &gt; DESCRIPTION *
                      </label>
                      <textarea
                        value={formData.description}
                        onChange={(e) => handleInputChange('description', e.target.value)}
                        placeholder="Enter challenge description"
                        rows={4}
                        className="w-full px-4 py-3 bg-brown-50 border-2 border-brown-200 rounded-xl text-brown-900 placeholder:text-brown-400 focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20 transition-all resize-y"
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
                      <label className="block text-sm font-semibold text-brown-700 mb-3">
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
                                ? 'border-green-500 bg-green-50'
                                : 'border-brown-300 hover:border-green-400 bg-brown-50'
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
                              <FileArchive className="text-green-600" size={40} />
                              <div className="text-center">
                                <p className="text-sm text-green-700 font-semibold mb-1">
                                  {staticChallengeFile.name}
                                </p>
                                <p className="text-xs text-brown-600">
                                  {(staticChallengeFile.size / (1024 * 1024)).toFixed(2)} MB
                                </p>
                                <p className="text-xs text-brown-500 mt-2">
                                  Click to change file
                                </p>
                              </div>
                            </>
                          ) : (
                            <>
                              <Upload className="text-brown-400" size={40} />
                              <div className="text-center">
                                <p className="text-sm text-brown-700 mb-1">
                                  Drag and drop file here
                                </p>
                                <p className="text-xs text-brown-600">
                                  Limit 200MB per file
                                </p>
                                <p className="text-xs text-brown-500 mt-1">
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
                      <label className="block text-sm font-semibold text-brown-700 mb-2">
                        &gt; MAX TEAMS *
                      </label>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => handleNumberChange('maxTeams', -1)}
                          className="w-10 h-10 flex items-center justify-center bg-brown-50 border-2 border-brown-200 rounded-lg hover:border-green-500 transition-all text-brown-700 hover:text-green-600"
                        >
                          <Minus size={16} />
                        </button>
                        <input
                          type="number"
                          value={formData.maxTeams}
                          onChange={(e) => handleInputChange('maxTeams', parseInt(e.target.value) || 0)}
                          min="0"
                          className="w-20 px-3 py-2 bg-secondary/20 border-2 border-secondary font-mono text-sm text-text text-center focus:outline-none focus:border-accent focus:bg-secondary/30 transition-all"
                        />
                        <button
                          type="button"
                          onClick={() => handleNumberChange('maxTeams', 1)}
                          className="w-10 h-10 flex items-center justify-center bg-brown-50 border-2 border-brown-200 rounded-lg hover:border-green-500 transition-all text-brown-700 hover:text-green-600"
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
                        <label className="block text-sm font-semibold text-brown-700">
                          Flag Format
                        </label>
                        <HelpCircle className="text-brown-400" size={16} />
                      </div>
                      <input
                        type="text"
                        value={formData.flagFormat}
                        onChange={(e) => handleInputChange('flagFormat', e.target.value)}
                        placeholder="CTF{}"
                        className="w-full px-4 py-3 bg-brown-50 border-2 border-brown-200 rounded-xl text-brown-900 placeholder:text-brown-400 focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20 transition-all"
                      />
                    </div>

                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <label className="block text-sm font-semibold text-brown-700">
                          Flag (Secret) *
                        </label>
                        <HelpCircle className="text-brown-400" size={16} />
                      </div>
                      <div className="relative">
                        <input
                          type={showFlag ? 'text' : 'password'}
                          value={formData.flag}
                          onChange={(e) => handleInputChange('flag', e.target.value)}
                          placeholder="Enter flag"
                          className="w-full px-4 py-3 pr-10 bg-brown-50 border-2 border-brown-200 rounded-xl text-brown-900 placeholder:text-brown-400 focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20 transition-all"
                        />
                        <button
                          type="button"
                          onClick={() => setShowFlag(!showFlag)}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-brown-400 hover:text-brown-600 transition-colors"
                        >
                          {showFlag ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-brown-700 mb-2">
                        Points
                      </label>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => handleNumberChange('points', -10)}
                          className="w-10 h-10 flex items-center justify-center bg-brown-50 border-2 border-brown-200 rounded-lg hover:border-green-500 transition-all text-brown-700 hover:text-green-600"
                        >
                          <Minus size={16} />
                        </button>
                        <input
                          type="number"
                          value={formData.points}
                          onChange={(e) => handleInputChange('points', parseInt(e.target.value) || 0)}
                          min="0"
                          className="w-24 px-3 py-2 bg-brown-50 border-2 border-brown-200 rounded-lg text-brown-900 text-center focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20 transition-all"
                        />
                        <button
                          type="button"
                          onClick={() => handleNumberChange('points', 10)}
                          className="w-10 h-10 flex items-center justify-center bg-brown-50 border-2 border-brown-200 rounded-lg hover:border-green-500 transition-all text-brown-700 hover:text-green-600"
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
                        className="w-4 h-4 text-green-500 focus:ring-green-500 focus:ring-2 accent-green-500"
                      />
                      <label htmlFor="staticIsActive" className="text-sm text-brown-700 cursor-pointer">
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
                <div className="mt-6 pt-6 border-t border-brown-200">
                  <div className="flex items-center gap-2 mb-4">
                    <Lock className="text-brown-600" size={18} />
                    <h6 className="text-base font-bold text-brown-900">
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
                        className="w-4 h-4 text-green-500 focus:ring-green-500 focus:ring-2 accent-green-500"
                      />
                      <label htmlFor="staticRestrictToTeams" className="text-sm text-brown-700 cursor-pointer">
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

