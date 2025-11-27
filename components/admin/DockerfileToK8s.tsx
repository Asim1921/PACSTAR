'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Wrench, Upload, HelpCircle, FileArchive, RefreshCw, Trash2, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { InfoBox } from '@/components/ui/InfoBox';
import { builderAPI } from '@/lib/api';
import { useToast } from '@/components/ui/ToastProvider';

interface DockerImage {
  name: string;
  id: string;
  created: string;
  size: string;
}

export const DockerfileToK8s: React.FC = () => {
  const { showToast } = useToast();
  const [formData, setFormData] = useState({
    imageNameTag: '',
    dockerfilePath: 'Dockerfile',
    contextSubdir: '',
    pushToRegistry: true,
    registryHostPort: '10.10.101.69:5000',
  });

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Images list state
  const [images, setImages] = useState<DockerImage[]>([]);
  const [isLoadingImages, setIsLoadingImages] = useState(false);
  const [isBuilding, setIsBuilding] = useState(false);
  const [imagesError, setImagesError] = useState<string | null>(null);
  
  // Build logs state
  const [buildLogs, setBuildLogs] = useState<string[]>([]);
  const [buildResult, setBuildResult] = useState<{
    success: boolean;
    image?: string;
    pushed_image?: string;
    logs?: string[];
  } | null>(null);

  const handleInputChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleFileSelect = (file: File) => {
    // Validate file type (accept ZIP, RAR, and TAR files)
    const fileName = file.name.toLowerCase();
    
    // Check file extension (ZIP, RAR, TAR and variants)
    // Order matters: check longer extensions first (e.g., .tar.gz before .gz)
    const validExtensions = [
      '.tar.gz', '.tar.bz2', '.tar.xz', '.tgz', '.tbz2', '.txz', // Multi-part extensions first
      '.zip', 
      '.rar', '.rar5', '.r00', '.r01', '.r02', '.r03', '.r04', '.r05',
      '.tar' // Single .tar last
    ];
    const hasValidExtension = validExtensions.some(ext => fileName.endsWith(ext));
    
    // Get the file extension for error messages
    const fileExtension = fileName.includes('.') 
      ? fileName.substring(fileName.lastIndexOf('.')) 
      : '';
    
    // Check MIME type as fallback (some files might not have extensions)
    const validMimeTypes = [
      'application/zip',
      'application/x-zip-compressed',
      'application/x-rar-compressed',
      'application/vnd.rar',
      'application/x-rar',
      'application/x-tar',
      'application/tar',
      'application/x-gzip',
      'application/gzip',
      'application/x-compressed-tar',
      'application/x-bzip2',
      'application/x-xz',
      'application/octet-stream', // Some archive files might have this
      '' // Empty MIME type is also acceptable (browser might not detect it)
    ];
    const hasValidMimeType = !file.type || validMimeTypes.includes(file.type.toLowerCase());
    
    // Invalid extensions that we should definitely reject
    const invalidExtensions = ['.exe', '.bat', '.cmd', '.sh', '.ps1', '.dll', '.sys', '.msi'];
    const hasInvalidExtension = invalidExtensions.some(ext => fileName.endsWith(ext));
    
    // If file has an invalid extension, reject it
    if (hasInvalidExtension) {
      showToast(`Invalid file type: ${fileExtension}. Please select a ZIP, RAR, or TAR archive file.`, 'error');
      return;
    }
    
    // Accept if:
    // 1. Has valid extension, OR
    // 2. Has valid/empty MIME type (let backend validate), OR  
    // 3. No extension (let backend validate the actual file content - some archives don't have extensions)
    // We're permissive here because the backend will validate the actual archive format
    const isValidFile = hasValidExtension || hasValidMimeType || !fileExtension;
    
    if (!isValidFile) {
      // Provide more detailed error message
      const errorMsg = fileExtension 
        ? `Invalid file type. Found: ${fileExtension}. Please select a ZIP, RAR, or TAR archive file.`
        : `File "${file.name}" format could not be determined. Please ensure it's a ZIP, RAR, or TAR archive.`;
      showToast(errorMsg, 'error');
      console.warn('File validation failed:', {
        fileName: file.name,
        fileExtension,
        mimeType: file.type || '(empty)',
        fileSize: file.size
      });
      return;
    }
    
    // Validate file size (200MB limit)
    const maxSize = 200 * 1024 * 1024; // 200MB in bytes
    if (file.size > maxSize) {
      showToast('File size exceeds 200MB limit', 'error');
      return;
    }

    // Additional check: file should not be empty
    if (file.size === 0) {
      showToast('Selected file is empty. Please select a valid archive file.', 'error');
      return;
    }

    console.log('File accepted:', {
      fileName: file.name,
      fileExtension: fileExtension || '(none)',
      mimeType: file.type || '(empty)',
      fileSize: file.size,
      hasValidExtension,
      hasValidMimeType
    });

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

  // Fetch images list
  const fetchImages = useCallback(async () => {
    setIsLoadingImages(true);
    setImagesError(null);
    try {
      const data = await builderAPI.listImages();
      setImages(Array.isArray(data) ? data : []);
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to fetch images';
      setImagesError(errorMessage);
      showToast(errorMessage, 'error');
    } finally {
      setIsLoadingImages(false);
    }
  }, [showToast]);

  // Fetch images on component mount
  useEffect(() => {
    fetchImages();
  }, [fetchImages]);

  // Handle delete image
  const handleDeleteImage = async (imageName: string) => {
    if (!confirm(`Are you sure you want to delete image "${imageName}"?`)) {
      return;
    }

    try {
      await builderAPI.deleteImage(imageName);
      showToast(`Image "${imageName}" deleted successfully`, 'success');
      // Refresh images list
      await fetchImages();
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to delete image';
      showToast(errorMessage, 'error');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedFile) {
      showToast('Please select a ZIP file to upload', 'error');
      return;
    }

    if (!formData.imageNameTag) {
      showToast('Please enter an image name:tag', 'error');
      return;
    }

    setIsBuilding(true);
    setBuildLogs([]);
    setBuildResult(null);
    
    try {
      const result = await builderAPI.buildImage(
        selectedFile,
        formData.imageNameTag,
        {
          dockerfilePath: formData.dockerfilePath,
          contextSubdir: formData.contextSubdir,
          pushToRegistry: formData.pushToRegistry,
          registry: formData.pushToRegistry ? formData.registryHostPort : undefined,
        }
      );

      // Store build result and logs
      setBuildResult(result);
      if (result.logs && Array.isArray(result.logs)) {
        setBuildLogs(result.logs);
      }

      showToast('Image built successfully!', 'success');
      
      // Reset form
      setSelectedFile(null);
      setFormData((prev) => ({
        ...prev,
        imageNameTag: '',
      }));
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      // Refresh images list
      await fetchImages();
    } catch (error: any) {
      console.error('Build image error:', error);
      
      // Extract error message from response
      let errorMessage = 'Failed to build image';
      if (error.response?.data) {
        if (error.response.data.detail) {
          errorMessage = error.response.data.detail;
        } else if (error.response.data.message) {
          errorMessage = error.response.data.message;
        } else if (typeof error.response.data === 'string') {
          errorMessage = error.response.data;
        } else if (error.response.data.error) {
          errorMessage = error.response.data.error;
        }
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      // Check if it's a generic error and provide more context
      if (errorMessage === 'Request could not be completed.' || errorMessage.includes('Request could not be completed')) {
        const fileName = selectedFile?.name || 'file';
        const fileExt = fileName.toLowerCase().includes('.tar') ? 'TAR' : 
                       fileName.toLowerCase().includes('.rar') ? 'RAR' : 'ZIP';
        
        errorMessage = `Backend rejected the ${fileExt} file. The backend may not support ${fileExt} files, or there may be an issue with the file format. Please check the backend logs for more details.`;
      }
      
      showToast(errorMessage, 'error');
      setBuildResult({ success: false });
      
      // If error response has logs, show them
      if (error.response?.data?.logs) {
        if (Array.isArray(error.response.data.logs)) {
          setBuildLogs(error.response.data.logs);
        } else if (typeof error.response.data.logs === 'string') {
          setBuildLogs([error.response.data.logs]);
        }
      } else if (error.response?.data?.detail) {
        // Show error detail as a log entry
        setBuildLogs([`Error: ${error.response.data.detail}`]);
      } else {
        // Show the error message as a log entry
        setBuildLogs([`Error: ${errorMessage}`]);
      }
    } finally {
      setIsBuilding(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Wrench className="text-green-600" size={20} />
          <h3 className="text-lg font-mono font-bold text-green-600 tracking-wider">
            Dockerfile to K8s
          </h3>
        </div>
        <p className="text-sm font-mono text-brown-900/80">
          Upload a ZIP, RAR, or TAR archive that contains your Dockerfile(s) and optional compose/content. We'll build a local Docker image you can use in Containerized challenges.
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white rounded-2xl shadow-md border border-brown-200 p-6 bg-white rounded-2xl shadow-md border border-brown-200 space-y-6">
          {/* Upload ZIP Section */}
          <div>
            <label className="block text-xs font-mono font-semibold text-green-600 mb-3 tracking-wider">
              &gt; UPLOAD ARCHIVE *
            </label>
            
            <div className="flex flex-col lg:flex-row gap-4">
              {/* Drag and Drop Area */}
              <div
                onDrop={isBuilding ? undefined : handleDrop}
                onDragOver={isBuilding ? undefined : handleDragOver}
                onDragLeave={isBuilding ? undefined : handleDragLeave}
                onClick={isBuilding ? undefined : handleBrowseClick}
                className={`
                  flex-1 min-h-[200px] border-2 border-dashed rounded
                  flex flex-col items-center justify-center gap-3 p-8
                  transition-all
                  ${
                    isBuilding
                      ? 'opacity-50 cursor-not-allowed border-accent/20'
                      : isDragging
                      ? 'border-accent bg-accent/10 cursor-pointer'
                      : 'border-brown-300 hover:border-green-400 bg-brown-50 cursor-pointer'
                  }
                `}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".zip,.rar,.tar,.tar.gz,.tgz,.tar.bz2,.tbz2,.tar.xz,.txz"
                  onChange={handleFileInputChange}
                  disabled={isBuilding}
                  className="hidden"
                />
                
                {selectedFile ? (
                  <>
                    <FileArchive className="text-green-600" size={48} />
                    <div className="text-center">
                      <p className="text-sm font-mono text-green-600 font-semibold mb-1">
                        {selectedFile.name}
                      </p>
                      <p className="text-xs font-mono text-brown-900/60">
                        {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                      </p>
                      <p className="text-xs font-mono text-brown-900/60 mt-2">
                        Click to change file
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <Upload className="text-green-600/60" size={48} />
                    <div className="text-center">
                      <p className="text-sm font-mono text-brown-900 mb-1">
                        Drag and drop file here
                      </p>
                      <p className="text-xs font-mono text-brown-900/60">
                        Limit 200MB per file • ZIP, RAR, or TAR
                      </p>
                    </div>
                  </>
                )}
              </div>

              {/* Browse Button */}
              <div className="flex items-center lg:items-start lg:pt-8">
                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  onClick={handleBrowseClick}
                  disabled={isBuilding}
                  className=" font-semibold tracking-wider whitespace-nowrap"
                >
                  Browse files
                </Button>
              </div>
            </div>
          </div>

          {/* Image name:tag */}
          <Input
            label="Image name:tag *"
            value={formData.imageNameTag}
            onChange={(e) => handleInputChange('imageNameTag', e.target.value)}
            placeholder="registry/repo:tag or repo:tag"
            disabled={isBuilding}
          />

          {/* Dockerfile path and Context subdir */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Input
              label="Dockerfile path in archive"
              value={formData.dockerfilePath}
              onChange={(e) => handleInputChange('dockerfilePath', e.target.value)}
              placeholder="Dockerfile"
              disabled={isBuilding}
            />

            <div>
              <div className="flex items-center gap-2 mb-2">
                <label className="block text-xs font-mono font-semibold text-green-600 tracking-wider">
                  &gt; CONTEXT SUBDIR IN ARCHIVE
                </label>
                <HelpCircle className="text-green-600/60" size={16} />
              </div>
              <input
                type="text"
                value={formData.contextSubdir}
                onChange={(e) => handleInputChange('contextSubdir', e.target.value)}
                placeholder="Leave empty for root"
                disabled={isBuilding}
                className="w-full px-4 py-3 bg-brown-50 border-2 border-brown-200 rounded-xl font-mono text-sm text-brown-900 placeholder:text-secondary/50 focus:outline-none focus:border-accent focus:bg-secondary/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
          </div>

          {/* Push to local registry checkbox */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="pushToRegistry"
              checked={formData.pushToRegistry}
              onChange={(e) => handleInputChange('pushToRegistry', e.target.checked)}
              disabled={isBuilding}
              className="w-4 h-4 text-green-600 focus:ring-accent focus:ring-2 accent-accent disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <label htmlFor="pushToRegistry" className="text-sm font-mono text-brown-900 cursor-pointer">
              Push to local registry after build
            </label>
          </div>

          {/* Registry host:port (shown when pushToRegistry is checked) */}
          {formData.pushToRegistry && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <label className="block text-xs font-mono font-semibold text-green-600 tracking-wider">
                  &gt; REGISTRY HOST:PORT
                </label>
                <HelpCircle className="text-green-600/60" size={16} />
              </div>
              <input
                type="text"
                value={formData.registryHostPort}
                onChange={(e) => handleInputChange('registryHostPort', e.target.value)}
                placeholder="10.10.101.69:5000"
                disabled={isBuilding}
                className="w-full px-4 py-3 bg-brown-50 border-2 border-brown-200 rounded-xl font-mono text-sm text-brown-900 placeholder:text-secondary/50 focus:outline-none focus:border-accent focus:bg-secondary/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
          )}

          {/* Submit Button */}
          <div className="flex justify-center pt-4">
            <Button
              type="submit"
              variant="outline"
              size="md"
              className=" font-semibold tracking-wider"
              isLoading={isBuilding}
              disabled={isBuilding}
            >
              <Wrench size={18} className="mr-2" />
              Build Image
            </Button>
          </div>
        </div>
      </form>

      {/* Build Logs Section */}
      {(buildResult || buildLogs.length > 0 || isBuilding) && (
        <div className="mt-8">
          <div className="flex items-center gap-2 mb-4">
            <Wrench className="text-green-600" size={20} />
            <h3 className="text-lg font-mono font-bold text-green-600 tracking-wider">
              Build Logs
            </h3>
          </div>

          <div className="bg-white rounded-2xl shadow-md border border-brown-200 p-6 bg-white rounded-2xl shadow-md border border-brown-200">
            {isBuilding ? (
              <div className="flex items-center gap-3 py-4">
                <RefreshCw className="animate-spin text-green-600" size={20} />
                <span className="text-sm font-mono text-brown-900">
                  Building image... This may take several minutes.
                </span>
              </div>
            ) : buildResult?.success === false ? (
              <InfoBox type="warning" message="Build failed. Check logs below for details." />
            ) : buildResult?.success === true ? (
              <div className="mb-4">
                <InfoBox type="success" message="Build completed successfully!" />
                {buildResult.image && (
                  <div className="mt-3 p-3 bg-accent/10 border-2 border-accent/30 rounded">
                    <p className="text-xs font-mono text-green-600 mb-1">
                      <span className="font-semibold">Built Image:</span> {buildResult.image}
                    </p>
                    {buildResult.pushed_image && (
                      <p className="text-xs font-mono text-green-600">
                        <span className="font-semibold">Pushed Image:</span> {buildResult.pushed_image}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ) : null}

            {buildLogs.length > 0 && (
              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-mono font-semibold text-green-600 tracking-wider">
                    &gt; BUILD OUTPUT
                  </label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setBuildLogs([]);
                      setBuildResult(null);
                    }}
                    className="text-xs font-mono"
                  >
                    Clear
                  </Button>
                </div>
                <div className="bg-background/50 border-2 border-secondary p-4 rounded max-h-96 overflow-y-auto">
                  <pre className="text-xs font-mono text-brown-900/80 whitespace-pre-wrap break-words">
                    {buildLogs.join('\n')}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Docker Images List Section */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <ImageIcon className="text-green-600" size={20} />
            <h3 className="text-lg font-mono font-bold text-green-600 tracking-wider">
              Local Docker Images
            </h3>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={fetchImages}
            disabled={isLoadingImages}
            className=" font-semibold tracking-wider"
          >
            <RefreshCw size={16} className={`mr-2 ${isLoadingImages ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        <div className="bg-white rounded-2xl shadow-md border border-brown-200 p-6 bg-white rounded-2xl shadow-md border border-brown-200">
          {isLoadingImages ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="animate-spin text-green-600" size={24} />
              <span className="ml-3 text-sm font-mono text-brown-900">Loading images...</span>
            </div>
          ) : imagesError ? (
            <InfoBox type="warning" message={imagesError} />
          ) : images.length === 0 ? (
            <div className="text-center py-8">
              <ImageIcon className="mx-auto text-green-600/40 mb-3" size={48} />
              <p className="text-sm font-mono text-brown-900/60">
                No Docker images found. Build an image to get started.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {images.map((image, index) => (
                <div
                  key={image.id || index}
                  className="flex items-center justify-between p-4 bg-brown-50 border-2 border-brown-200 rounded-xl hover:border-accent/50 transition-all"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <ImageIcon className="text-green-600 flex-shrink-0" size={18} />
                      <p className="text-sm font-mono font-semibold text-green-600 truncate">
                        {image.name}
                      </p>
                    </div>
                    <div className="flex items-center gap-4 text-xs font-mono text-brown-900/60 ml-6">
                      <span>ID: {image.id?.substring(0, 12) || 'N/A'}{image.id && image.id.length > 12 ? '...' : ''}</span>
                      <span>Size: {image.size}</span>
                      <span>Created: {image.created}</span>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteImage(image.name)}
                    className="ml-4 text-red-400 hover:text-red-300 hover:bg-red-400/10 border-red-400/30"
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

