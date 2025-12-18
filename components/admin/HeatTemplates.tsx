'use client';

import React, { useState, useRef } from 'react';
import { 
  Flame, 
  Upload, 
  FileText, 
  Link as LinkIcon,
  HelpCircle,
  Plus,
  Minus,
  Cloud,
  Code,
  FileCode
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { RadioGroup } from '@/components/ui/RadioGroup';
import { InfoBox } from '@/components/ui/InfoBox';
import { useToast } from '@/components/ui/ToastProvider';
import { openStackAPI } from '@/lib/api';

export const HeatTemplates: React.FC = () => {
  const { showToast } = useToast();
  
  // Form state
  const [stackName, setStackName] = useState('pacstar-ctf-stack');
  const [templateSource, setTemplateSource] = useState<'upload' | 'paste' | 'url'>('paste');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [yamlContent, setYamlContent] = useState('');
  const [templateUrl, setTemplateUrl] = useState('');
  const [parameters, setParameters] = useState('{}');
  const [timeoutMinutes, setTimeoutMinutes] = useState(60);
  const [rollbackOnFailure, setRollbackOnFailure] = useState(true);
  const [isDeploying, setIsDeploying] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const allowedFileTypes = ['.yaml', '.yml', '.json', '.template', '.hot'];
  
  const handleFileSelect = (file: File) => {
    const fileName = file.name.toLowerCase();
    const fileExtension = '.' + fileName.split('.').pop()?.toLowerCase();
    
    if (!allowedFileTypes.includes(fileExtension)) {
      showToast(`File type not allowed. Allowed types: ${allowedFileTypes.join(', ')}`, 'error');
      return;
    }
    
    const maxSize = 200 * 1024 * 1024; // 200MB
    if (file.size > maxSize) {
      showToast('File size exceeds 200MB limit', 'error');
      return;
    }

    setSelectedFile(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleTimeoutChange = (delta: number) => {
    setTimeoutMinutes((prev) => Math.max(1, Math.min(720, prev + delta)));
  };

  // Helper function to read file content as text
  const readFileAsText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result;
        if (typeof content === 'string') {
          resolve(content);
        } else {
          reject(new Error('Failed to read file as text'));
        }
      };
      reader.onerror = () => reject(new Error('Error reading file'));
      reader.readAsText(file);
    });
  };

  const handleDeploy = async () => {
    const trimmedStackName = stackName.trim();
    if (!trimmedStackName) {
      showToast('Please enter a stack name', 'error');
      return;
    }
    // Backend requires stack_name to be at least 3 characters
    if (trimmedStackName.length < 3) {
      showToast('Stack name must be at least 3 characters long', 'error');
      return;
    }

    if (templateSource === 'upload' && !selectedFile) {
      showToast('Please upload a HOT file', 'error');
      return;
    }

    if (templateSource === 'paste' && !yamlContent.trim()) {
      showToast('Please paste the HOT YAML content', 'error');
      return;
    }

    if (templateSource === 'url' && !templateUrl.trim()) {
      showToast('Please enter a template URL', 'error');
      return;
    }

    // Validate JSON parameters (backend accepts optional parameters as Dict[str, Any])
    let parsedParameters: Record<string, any> | undefined = undefined;
    const trimmedParameters = parameters.trim();
    if (trimmedParameters && trimmedParameters !== '{}') {
    try {
        parsedParameters = JSON.parse(trimmedParameters);
        // Ensure it's an object (not array or null)
        if (typeof parsedParameters !== 'object' || parsedParameters === null || Array.isArray(parsedParameters)) {
          showToast('Parameters must be a valid JSON object', 'error');
          return;
        }
    } catch (e) {
      showToast('Invalid JSON in parameters field', 'error');
      return;
      }
    }

    setIsDeploying(true);
    try {
      // Build the API payload
      let templateBody: string | undefined;
      let templateUrlValue: string | undefined;

      if (templateSource === 'upload' && selectedFile) {
        // Read file content for upload
        templateBody = await readFileAsText(selectedFile);
      } else if (templateSource === 'paste') {
        templateBody = yamlContent.trim();
      } else if (templateSource === 'url') {
        templateUrlValue = templateUrl.trim();
      }

      // Validate that we have at least one template source (backend requirement)
      if (!templateBody && !templateUrlValue) {
        showToast('Please provide either a template file, paste YAML content, or a template URL', 'error');
        setIsDeploying(false);
        return;
      }

      // Call the Heat deployment API
      const response = await openStackAPI.deployHeatTemplate({
        stack_name: trimmedStackName,
        template_body: templateBody,
        template_url: templateUrlValue,
        parameters: parsedParameters,
        timeout_minutes: timeoutMinutes,
        rollback_on_failure: rollbackOnFailure,
      });

      // Show success with stack details (backend returns: stack_id, stack_name, status, status_reason, outputs)
      let successMessage = '';
      if (response.stack_id && response.stack_name) {
        successMessage = `Heat stack "${response.stack_name}" created successfully!`;
        successMessage += `\nStack ID: ${response.stack_id}`;
        if (response.status) {
          successMessage += `\nStatus: ${response.status}`;
        }
        if (response.status_reason) {
          successMessage += `\nReason: ${response.status_reason}`;
        }
        // Include outputs if available
        if (response.outputs && Array.isArray(response.outputs) && response.outputs.length > 0) {
          const outputLines = response.outputs.map((out: any) => {
            const key = out.output_key || out.key || 'output';
            const value = out.output_value || out.value || '';
            return `  ${key}: ${value}`;
          }).join('\n');
          successMessage += `\n\nOutputs:\n${outputLines}`;
        }
      } else {
        successMessage = 'Heat template deployment initiated successfully';
      }
      showToast(successMessage, 'success');
      
      // Reset form after successful deployment
      setStackName('pacstar-ctf-stack');
      setSelectedFile(null);
      setYamlContent('');
      setTemplateUrl('');
      setParameters('{}');
      setTimeoutMinutes(60);
      setRollbackOnFailure(true);
    } catch (error: any) {
      // Backend returns errors with detail field for ValueError, RuntimeError, and HTTPException
      let errorMessage = 'Failed to deploy heat template';
      if (error.response?.data?.detail) {
        errorMessage = error.response.data.detail;
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message) {
        errorMessage = error.message;
      }
      showToast(errorMessage, 'error');
    } finally {
      setIsDeploying(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Stack Name Section */}
      <div className="bg-gradient-to-r from-cyber-900 to-cyber-800 rounded-2xl p-6 border border-neon-green/20 terminal-border shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-neon-orange/10 rounded-xl flex items-center justify-center">
            <FileCode className="text-neon-orange" size={20} />
          </div>
          <div>
            <h3 className="text-lg font-bold gradient-text">Stack Configuration</h3>
            <p className="text-sm text-white/60">Define your Heat stack name</p>
          </div>
        </div>
        <Input
          type="text"
          value={stackName}
          onChange={(e) => setStackName(e.target.value)}
          placeholder="Enter stack name"
          label="Stack Name"
          className="w-full"
        />
        <p className="text-xs text-white/50 mt-2 flex items-center gap-1">
          <span className="text-neon-orange">*</span>
          Required field
        </p>
      </div>

      {/* Template Source Section */}
      <div className="bg-cyber-900/80 backdrop-blur-xl rounded-2xl p-6 border border-neon-green/20 terminal-border shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-neon-green/10 rounded-xl flex items-center justify-center">
            <Code className="text-neon-green" size={20} />
          </div>
          <div>
            <h3 className="text-lg font-bold gradient-text">Template Source</h3>
            <p className="text-sm text-white/60">Choose how to provide your Heat template</p>
          </div>
        </div>
        <RadioGroup
          options={[
            { 
              value: 'upload', 
              label: 'Upload HOT file',
              description: 'Upload a Heat Orchestration Template file from your computer'
            },
            { 
              value: 'paste', 
              label: 'Paste HOT YAML',
              description: 'Paste the YAML content directly into the editor'
            },
            { 
              value: 'url', 
              label: 'Template URL',
              description: 'Provide a URL to fetch the template from a remote location'
            },
          ]}
          value={templateSource}
          onChange={(value) => setTemplateSource(value as 'upload' | 'paste' | 'url')}
        />
      </div>

      {/* Template Input Section */}
      <div className="bg-cyber-900/80 backdrop-blur-xl rounded-2xl p-6 border border-neon-green/20 terminal-border shadow-sm">
        {templateSource === 'upload' && (
          <>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-neon-green/10 rounded-xl flex items-center justify-center">
                <Upload className="text-neon-green" size={20} />
              </div>
              <div>
                <h3 className="text-lg font-bold gradient-text">Upload HOT/YAML Template</h3>
                <p className="text-sm text-white/60">Select your Heat template file</p>
              </div>
            </div>
            <div className="flex flex-col lg:flex-row gap-4">
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={handleBrowseClick}
                className={`
                  flex-1 min-h-[180px] border-2 border-dashed rounded-xl
                  flex flex-col items-center justify-center gap-4 p-8
                  cursor-pointer transition-all
                  ${
                    isDragging
                      ? 'border-neon-cyan bg-neon-cyan/10 shadow-md'
                      : 'border-neon-cyan/30 hover:border-neon-cyan/50 bg-cyber-800/50/50 hover:bg-cyber-800/50'
                  }
                `}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={allowedFileTypes.join(',')}
                  onChange={handleFileInputChange}
                  className="hidden"
                />
                
                {selectedFile ? (
                  <>
                    <div className="w-16 h-16 bg-neon-green/10 rounded-xl flex items-center justify-center">
                      <FileText className="text-neon-green" size={32} />
                    </div>
                    <div className="text-center">
                      <p className="text-base text-green-700 font-semibold mb-2">
                        {selectedFile.name}
                      </p>
                      <p className="text-sm text-white/60 mb-1">
                        {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                      </p>
                      <p className="text-xs text-white/50">
                        Click to change file
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="w-16 h-16 bg-brown-100 rounded-xl flex items-center justify-center">
                      <Cloud className="text-white/40" size={32} />
                    </div>
                    <div className="text-center">
                      <p className="text-base text-white/80 font-semibold mb-2">
                        Drag and drop file here
                      </p>
                      <p className="text-sm text-white/60 mb-1">
                        or click to browse
                      </p>
                      <p className="text-xs text-white/50">
                        Limit 200MB • YAML, YML, JSON, TEMPLATE, HOT
                      </p>
                    </div>
                  </>
                )}
              </div>

              <div className="flex items-center lg:items-start lg:pt-4">
                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  onClick={handleBrowseClick}
                  className="whitespace-nowrap"
                >
                  <Upload size={16} className="mr-2" />
                  Browse Files
                </Button>
              </div>
            </div>
          </>
        )}

        {templateSource === 'paste' && (
          <>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-neon-green/10 rounded-xl flex items-center justify-center">
                <Code className="text-neon-green" size={20} />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold gradient-text">Template Body</h3>
                <p className="text-sm text-white/60">Paste your Heat Orchestration Template YAML content</p>
              </div>
              <span className="text-neon-orange font-semibold text-sm">*</span>
            </div>
            <div className="relative">
              <textarea
                value={yamlContent}
                onChange={(e) => setYamlContent(e.target.value)}
                placeholder="# Paste full HOT template here&#10;&#10;heat_template_version: '2013-05-23'&#10;description: Your template description&#10;..."
                rows={16}
                className="w-full px-4 py-3 bg-cyber-800/50 border-2 border-neon-green/20 terminal-border rounded-xl text-white placeholder:text-white/40 focus:outline-none focus:border-neon-cyan focus:ring-2 focus:ring-neon-cyan/20 transition-all resize-y font-mono text-sm leading-relaxed"
              />
              <div className="absolute bottom-3 right-3 flex items-center gap-2 text-xs text-white/40">
                <Code size={12} />
                <span>YAML</span>
              </div>
            </div>
          </>
        )}

        {templateSource === 'url' && (
          <>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-neon-green/10 rounded-xl flex items-center justify-center">
                <LinkIcon className="text-neon-green" size={20} />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold gradient-text">Template URL</h3>
                <p className="text-sm text-white/60">Provide a URL to fetch the template</p>
              </div>
              <span className="text-neon-orange font-semibold text-sm">*</span>
            </div>
            <div className="flex items-center gap-3">
              <LinkIcon className="text-white/40 flex-shrink-0" size={20} />
              <Input
                type="url"
                value={templateUrl}
                onChange={(e) => setTemplateUrl(e.target.value)}
                placeholder="https://example.com/heat-template.yaml"
                className="flex-1"
              />
            </div>
          </>
        )}
      </div>

      {/* Advanced Configuration */}
      <div className="bg-cyber-900/80 backdrop-blur-xl rounded-2xl p-6 border border-neon-green/20 terminal-border shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-brown-100 rounded-xl flex items-center justify-center">
            <HelpCircle className="text-white/60" size={20} />
          </div>
          <div>
            <h3 className="text-lg font-bold gradient-text">Advanced Configuration</h3>
            <p className="text-sm text-white/60">Optional settings for deployment</p>
          </div>
        </div>

        <div className="space-y-6">
          {/* Parameters */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <label className="text-sm font-semibold text-white/80">
                Parameters (JSON)
              </label>
              <HelpCircle className="text-white/40" size={16} />
              <span className="text-xs text-white/50">Optional</span>
            </div>
            <div className="relative">
              <textarea
                value={parameters}
                onChange={(e) => setParameters(e.target.value)}
                placeholder='{"param1": "value1", "param2": "value2"}'
                rows={6}
                className="w-full px-4 py-3 bg-cyber-800/50 border-2 border-neon-green/20 terminal-border rounded-xl text-white placeholder:text-white/40 focus:outline-none focus:border-neon-cyan focus:ring-2 focus:ring-neon-cyan/20 transition-all resize-y font-mono text-sm"
              />
              <div className="absolute bottom-3 right-3 flex items-center gap-2 text-xs text-white/40">
                <Code size={12} />
                <span>JSON</span>
              </div>
            </div>
          </div>

          {/* Timeout */}
          <div>
            <label className="block text-sm font-semibold text-white/80 mb-3">
              Timeout (minutes)
            </label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => handleTimeoutChange(-1)}
                className="w-12 h-12 flex items-center justify-center bg-cyber-800/50 border-2 border-neon-green/20 terminal-border rounded-xl hover:border-neon-cyan hover:bg-neon-cyan/10 transition-all text-white/80 hover:text-neon-green shadow-sm"
              >
                <Minus size={18} />
              </button>
              <div className="flex-1 max-w-[120px]">
                <Input
                  type="number"
                  value={timeoutMinutes}
                  onChange={(e) => {
                    const value = parseInt(e.target.value) || 60;
                    setTimeoutMinutes(Math.max(1, Math.min(720, value)));
                  }}
                  min={1}
                  max={720}
                  className="text-center text-lg font-semibold"
                />
              </div>
              <button
                type="button"
                onClick={() => handleTimeoutChange(1)}
                className="w-12 h-12 flex items-center justify-center bg-cyber-800/50 border-2 border-neon-green/20 terminal-border rounded-xl hover:border-neon-cyan hover:bg-neon-cyan/10 transition-all text-white/80 hover:text-neon-green shadow-sm"
              >
                <Plus size={18} />
              </button>
              <span className="text-sm text-white/60 ml-2">minutes</span>
            </div>
            <p className="text-xs text-white/50 mt-2">Range: 1 minute to 12 hours (720 minutes)</p>
          </div>

          {/* Rollback */}
          <div className="flex items-start gap-3 p-4 bg-cyber-800/50 rounded-xl border border-neon-green/20 terminal-border">
            <input
              type="checkbox"
              id="rollbackOnFailure"
              checked={rollbackOnFailure}
              onChange={(e) => setRollbackOnFailure(e.target.checked)}
              className="w-5 h-5 mt-0.5 text-green-500 focus:ring-neon-cyan focus:ring-2 accent-green-500"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <label htmlFor="rollbackOnFailure" className="text-sm font-semibold text-white/80 cursor-pointer">
                  Rollback on failure
                </label>
                <HelpCircle className="text-white/40" size={14} />
              </div>
              <p className="text-xs text-white/60">
                Automatically rollback the stack if deployment fails
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Deploy Button */}
      <div className="flex justify-end pt-2">
        <Button
          variant="primary"
          size="lg"
          onClick={handleDeploy}
          disabled={isDeploying}
          isLoading={isDeploying}
          className="px-10 py-4 text-lg bg-gradient-to-r from-neon-green to-neon-cyan hover:from-neon-cyan hover:to-neon-green shadow-lg hover:shadow-xl"
        >
          <Flame size={20} className="mr-2" />
          {isDeploying ? 'Deploying Stack...' : 'Deploy Heat Template'}
        </Button>
      </div>
    </div>
  );
};
