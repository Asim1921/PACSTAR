'use client';

import React, { useState, useEffect } from 'react';
import { 
  Cloud, 
  Plug, 
  RefreshCw, 
  Camera, 
  Monitor, 
  Globe, 
  Rocket, 
  ChevronDown, 
  ChevronUp,
  Trash2,
  HelpCircle,
  Flame
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { InfoBox } from '@/components/ui/InfoBox';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/ToastProvider';
import { openStackAPI } from '@/lib/api';
import { SnapshotDevelopment } from './SnapshotDevelopment';
import { HeatTemplates } from './HeatTemplates';

export const OpenStack: React.FC = () => {
  const { showToast } = useToast();
  
  // Section collapse states
  const [isSnapshotsOpen, setIsSnapshotsOpen] = useState(true);
  const [isInstancesOpen, setIsInstancesOpen] = useState(false);
  const [isNetworksOpen, setIsNetworksOpen] = useState(false);
  const [isSnapshotDeploymentOpen, setIsSnapshotDeploymentOpen] = useState(false);
  const [isHeatTemplatesOpen, setIsHeatTemplatesOpen] = useState(false);
  
  // Loading states
  const [isTestingConnectivity, setIsTestingConnectivity] = useState(false);
  const [isRefreshingSnapshots, setIsRefreshingSnapshots] = useState(false);
  const [isRefreshingInstances, setIsRefreshingInstances] = useState(false);
  const [isRefreshingNetworks, setIsRefreshingNetworks] = useState(false);
  const [isClearingCache, setIsClearingCache] = useState(false);
  
  // Data states
  const [snapshots, setSnapshots] = useState<any[]>([]);
  const [instances, setInstances] = useState<any[]>([]);
  const [networks, setNetworks] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [instanceStatusFilter, setInstanceStatusFilter] = useState<string>('ACTIVE');
  
  // Connectivity test result
  const [connectivityResult, setConnectivityResult] = useState<{
    success: boolean;
    message?: string;
    data?: any;
  } | null>(null);

  const handleTestConnectivity = async () => {
    setIsTestingConnectivity(true);
    setConnectivityResult(null);
    
    try {
      const result = await openStackAPI.getSummary();
      
      setSummary(result);
      setConnectivityResult({
        success: true,
        message: 'OpenStack connectivity test successful',
        data: result,
      });
      
      showToast('OpenStack connectivity test successful', 'success');
    } catch (error: any) {
      console.error('Connectivity test failed:', error);
      const errorMessage = error.response?.data?.detail || error.message || 'Failed to connect to OpenStack';
      setConnectivityResult({
        success: false,
        message: errorMessage,
      });
      showToast(`OpenStack connectivity test failed: ${errorMessage}`, 'error');
    } finally {
      setIsTestingConnectivity(false);
    }
  };

  const handleClearCache = async () => {
    setIsClearingCache(true);
    
    try {
      // TODO: Replace with actual API call when documentation is provided
      // await openStackAPI.clearCache();
      
      // Simulated response for now
      await new Promise(resolve => setTimeout(resolve, 800));
      
      showToast('Cached data cleared successfully', 'success');
      
      // Clear local state
      setSnapshots([]);
      setInstances([]);
      setNetworks([]);
      setConnectivityResult(null);
    } catch (error: any) {
      console.error('Failed to clear cache:', error);
      showToast('Failed to clear cached data', 'error');
    } finally {
      setIsClearingCache(false);
    }
  };

  const handleRefreshSnapshots = async () => {
    setIsRefreshingSnapshots(true);
    
    try {
      const result = await openStackAPI.listSnapshots();
      
      // Handle both array and object responses
      const snapshotsList = Array.isArray(result) ? result : (result.snapshots || result.data || []);
      setSnapshots(snapshotsList);
      
      showToast(`Loaded ${snapshotsList.length} snapshot(s)`, 'success');
    } catch (error: any) {
      console.error('Failed to refresh snapshots:', error);
      const errorMessage = error.response?.data?.detail || error.message || 'Failed to refresh snapshots';
      showToast(errorMessage, 'error');
    } finally {
      setIsRefreshingSnapshots(false);
    }
  };

  const handleRefreshInstances = async () => {
    setIsRefreshingInstances(true);
    
    try {
      // Use empty string for 'ALL' to get all instances regardless of status
      const statusFilter = instanceStatusFilter === 'ALL' ? '' : instanceStatusFilter;
      const result = await openStackAPI.listInstances(statusFilter);
      
      // Handle both array and object responses
      const instancesList = Array.isArray(result) ? result : (result.instances || result.data || []);
      setInstances(instancesList);
      
      showToast(`Loaded ${instancesList.length} instance(s) with status: ${instanceStatusFilter}`, 'success');
    } catch (error: any) {
      console.error('Failed to refresh instances:', error);
      const errorMessage = error.response?.data?.detail || error.message || 'Failed to refresh instances';
      showToast(errorMessage, 'error');
    } finally {
      setIsRefreshingInstances(false);
    }
  };

  const handleRefreshNetworks = async () => {
    setIsRefreshingNetworks(true);
    
    try {
      const result = await openStackAPI.listNetworks();
      
      // Handle both array and object responses
      const networksList = Array.isArray(result) ? result : (result.networks || result.data || []);
      setNetworks(networksList);
      
      showToast(`Loaded ${networksList.length} network(s)`, 'success');
    } catch (error: any) {
      console.error('Failed to refresh networks:', error);
      const errorMessage = error.response?.data?.detail || error.message || 'Failed to refresh networks';
      showToast(errorMessage, 'error');
    } finally {
      setIsRefreshingNetworks(false);
    }
  };

  // Auto-refresh instances when status filter changes (only if instances section is open)
  useEffect(() => {
    if (isInstancesOpen && instanceStatusFilter) {
      // Only refresh if we have instances loaded or section is open
      const refreshInstances = async () => {
        setIsRefreshingInstances(true);
        try {
          // Use empty string for 'ALL' to get all instances regardless of status
          const statusFilter = instanceStatusFilter === 'ALL' ? '' : instanceStatusFilter;
          const result = await openStackAPI.listInstances(statusFilter);
          const instancesList = Array.isArray(result) ? result : (result.instances || result.data || []);
          setInstances(instancesList);
        } catch (error: any) {
          console.error('Failed to refresh instances:', error);
        } finally {
          setIsRefreshingInstances(false);
        }
      };
      refreshInstances();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instanceStatusFilter, isInstancesOpen]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Cloud className="text-neon-green" size={24} />
          <h2 className="text-2xl font-mono font-bold gradient-text tracking-wider">
            OpenStack Automation
          </h2>
        </div>
        <p className="text-white/60 font-mono text-sm">
          Master-only controls for testing the new OpenStack backend APIs.
        </p>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <Button
          variant="outline"
          size="md"
          onClick={handleTestConnectivity}
          disabled={isTestingConnectivity}
          className=" font-semibold tracking-wider"
        >
          <Plug 
            size={18} 
            className={`mr-2 ${isTestingConnectivity ? 'animate-pulse' : ''}`} 
          />
          {isTestingConnectivity ? 'Testing...' : 'Test OpenStack Connectivity'}
        </Button>
        
        <Button
          variant="outline"
          size="md"
          onClick={handleClearCache}
          disabled={isClearingCache}
          className=" font-semibold tracking-wider"
        >
          <RefreshCw 
            size={18} 
            className={`mr-2 ${isClearingCache ? 'animate-spin' : ''}`} 
          />
          {isClearingCache ? 'Clearing...' : 'Clear Cached Data'}
        </Button>
      </div>

      {/* Connectivity Result */}
      {connectivityResult && (
        <InfoBox
          type={connectivityResult.success ? 'success' : 'warning'}
          message={connectivityResult.message}
        />
      )}

      {/* Summary Data */}
      {summary && connectivityResult?.success && (
        <div className="bg-cyber-900/80 backdrop-blur-xl rounded-2xl shadow-md border border-neon-green/20 terminal-border border-2 border-neon-green/20 p-4">
          <h3 className="text-lg font-mono font-bold gradient-text tracking-wider mb-4">
            OpenStack Summary
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-sm">
            {summary.instances !== undefined && (
              <div className="p-3 bg-cyber-800/50 border border-neon-green/20 terminal-border rounded-xl">
                <div className="text-white/60 mb-1">Instances</div>
                <div className="text-neon-green text-xl font-bold">{summary.instances}</div>
              </div>
            )}
            {summary.cores !== undefined && (
              <div className="p-3 bg-cyber-800/50 border border-neon-green/20 terminal-border rounded-xl">
                <div className="text-white/60 mb-1">Cores</div>
                <div className="text-neon-green text-xl font-bold">{summary.cores}</div>
              </div>
            )}
            {summary.ram_gb !== undefined && (
              <div className="p-3 bg-cyber-800/50 border border-neon-green/20 terminal-border rounded-xl">
                <div className="text-white/60 mb-1">RAM (GB)</div>
                <div className="text-neon-green text-xl font-bold">{summary.ram_gb}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Info Box */}
      <InfoBox
        type="info"
        message="Use the Test OpenStack Connectivity button above to verify credentials and load summary data."
      />

      {/* Snapshots Section */}
      <div className="bg-cyber-900/80 backdrop-blur-xl rounded-2xl shadow-md border border-neon-green/20 terminal-border border-2 border-neon-green/20">
        <button
          onClick={() => setIsSnapshotsOpen(!isSnapshotsOpen)}
          className="w-full flex items-center justify-between p-4 bg-cyber-800/50 border-b border-neon-green/20 terminal-border hover:border-neon-cyan/50 transition-all"
        >
          <div className="flex items-center gap-3">
            <Camera className="text-neon-green" size={20} />
            <h3 className="text-lg font-mono font-bold text-neon-green tracking-wider">
              Snapshots
            </h3>
          </div>
          {isSnapshotsOpen ? (
            <ChevronUp className="text-neon-green" size={20} />
          ) : (
            <ChevronDown className="text-neon-green" size={20} />
          )}
        </button>
        
        {isSnapshotsOpen && (
          <div className="p-4 space-y-4">
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefreshSnapshots}
                disabled={isRefreshingSnapshots}
                className="border-neon-green/40 hover:bg-neon-green/10 text-neon-green text-xs"
              >
                <RefreshCw 
                  size={14} 
                  className={`mr-2 ${isRefreshingSnapshots ? 'animate-spin' : ''}`} 
                />
                Refresh Snapshots
              </Button>
            </div>
            {snapshots.length === 0 ? (
              <InfoBox
                type="info"
                message="No snapshots loaded yet. Click 'Refresh Snapshots' to load data."
              />
            ) : (
              <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
                {snapshots.map((snapshot, index) => (
                  <div
                    key={snapshot.id || index}
                    className="p-4 bg-gradient-to-br from-cyber-800/60 to-cyber-800/40 border-2 border-neon-green/40 rounded-xl hover:border-neon-green/60 transition-all shadow-lg"
                  >
                    <div className="space-y-2">
                      <div className="flex items-start gap-2">
                        <span className="text-neon-green font-semibold min-w-[60px]">ID:</span>
                        <span className="text-white/90 text-sm break-all font-mono">{snapshot.id || 'N/A'}</span>
                      </div>
                      {snapshot.name && (
                        <div className="flex items-start gap-2">
                          <span className="text-neon-green font-semibold min-w-[60px]">Name:</span>
                          <span className="text-white/90 text-sm">{snapshot.name}</span>
                        </div>
                      )}
                      {snapshot.status && (
                        <div className="flex items-start gap-2">
                          <span className="text-neon-green font-semibold min-w-[60px]">Status:</span>
                          <span className={`text-sm font-semibold ${
                            snapshot.status === 'ACTIVE' ? 'text-neon-green' :
                            snapshot.status === 'QUEUED' ? 'text-neon-cyan' :
                            'text-white/90'
                          }`}>
                            {snapshot.status}
                          </span>
                        </div>
                      )}
                      {snapshot.created_at && (
                        <div className="flex items-start gap-2">
                          <span className="text-neon-green font-semibold min-w-[60px]">Created:</span>
                          <span className="text-white/70 text-sm">{new Date(snapshot.created_at).toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Instances Section */}
      <div className="bg-cyber-900/80 backdrop-blur-xl rounded-2xl shadow-md border border-neon-green/20 terminal-border border-2 border-neon-green/20">
        <button
          onClick={() => setIsInstancesOpen(!isInstancesOpen)}
          className="w-full flex items-center justify-between p-4 bg-cyber-800/50 border-b border-neon-green/20 terminal-border hover:border-neon-cyan/50 transition-all"
        >
          <div className="flex items-center gap-3">
            <Monitor className="text-neon-green" size={20} />
            <h3 className="text-lg font-mono font-bold gradient-text tracking-wider">
              Instances
            </h3>
          </div>
          {isInstancesOpen ? (
            <ChevronUp className="text-neon-green" size={20} />
          ) : (
            <ChevronDown className="text-neon-green" size={20} />
          )}
        </button>
        
        {isInstancesOpen && (
          <div className="p-4 space-y-4">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <div className="flex items-center gap-2">
                <label className="text-white font-mono text-sm font-semibold">
                  Status filter:
                </label>
                <Select
                  value={instanceStatusFilter}
                  onChange={(e) => setInstanceStatusFilter(e.target.value)}
                  options={[
                    { value: 'ACTIVE', label: 'ACTIVE' },
                    { value: 'SHUTOFF', label: 'SHUTOFF' },
                    { value: 'SUSPENDED', label: 'SUSPENDED' },
                    { value: 'PAUSED', label: 'PAUSED' },
                    { value: 'ERROR', label: 'ERROR' },
                    { value: 'ALL', label: 'ALL' },
                  ]}
                  className="border-accent/50 focus:border-accent min-w-[150px]"
                />
                <div title="Filter instances by their current status">
                  <HelpCircle 
                    className="text-neon-green/60 cursor-help" 
                    size={16}
                  />
                </div>
              </div>
              
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefreshInstances}
                disabled={isRefreshingInstances}
                className=" text-xs"
              >
                <RefreshCw 
                  size={14} 
                  className={`mr-2 ${isRefreshingInstances ? 'animate-spin' : ''}`} 
                />
                Refresh Instances
              </Button>
            </div>
            
            {instances.length === 0 ? (
              <InfoBox
                type="info"
                message={`No instances found with status: ${instanceStatusFilter}. Click 'Refresh Instances' to load data.`}
              />
            ) : (
              <div className="space-y-2">
                {instances.map((instance, index) => (
                  <div
                    key={instance.id || index}
                    className="p-3 bg-cyber-800/50 border border-neon-green/20 terminal-border rounded-xl data-panel font-mono text-sm"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-neon-green font-semibold">ID:</span>
                          <span className="text-white">{instance.id || 'N/A'}</span>
                        </div>
                        {instance.name && (
                          <div className="flex items-center gap-2">
                            <span className="text-neon-green font-semibold">Name:</span>
                            <span className="text-white">{instance.name}</span>
                          </div>
                        )}
                        {instance.status && (
                          <div className="flex items-center gap-2">
                            <span className="text-neon-green font-semibold">Status:</span>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                              instance.status === 'ACTIVE' ? 'bg-neon-green/20 text-neon-green' :
                              instance.status === 'SHUTOFF' ? 'bg-neon-orange/20 text-neon-orange' :
                              instance.status === 'ERROR' ? 'bg-red-500/20 text-red-400' :
                              'bg-cyber-800/20 text-white'
                            }`}>
                              {instance.status}
                            </span>
                          </div>
                        )}
                        {instance.flavor && (
                          <div className="flex items-center gap-2">
                            <span className="text-neon-green font-semibold">Flavor:</span>
                            <span className="text-white">{instance.flavor.name || instance.flavor.id || 'N/A'}</span>
                          </div>
                        )}
                        {instance.addresses && Object.keys(instance.addresses).length > 0 && (
                          <div className="flex items-center gap-2">
                            <span className="text-neon-green font-semibold">IP:</span>
                            <span className="text-white">
                              {Object.values(instance.addresses).flat().map((addr: any) => addr.addr).join(', ')}
                            </span>
                          </div>
                        )}
                        {instance.created && (
                          <div className="flex items-center gap-2">
                            <span className="text-neon-green font-semibold">Created:</span>
                            <span className="text-white/60 text-xs">{new Date(instance.created).toLocaleString()}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Networks Section */}
      <div className="bg-cyber-900/80 backdrop-blur-xl rounded-2xl shadow-md border border-neon-green/20 terminal-border border-2 border-neon-green/20">
        <button
          onClick={() => setIsNetworksOpen(!isNetworksOpen)}
          className="w-full flex items-center justify-between p-4 bg-cyber-800/50 border-b border-neon-green/20 terminal-border hover:border-neon-cyan/50 transition-all"
        >
          <div className="flex items-center gap-3">
            <Globe className="text-neon-green" size={20} />
            <h3 className="text-lg font-mono font-bold text-neon-green tracking-wider">
              Networks
            </h3>
          </div>
          {isNetworksOpen ? (
            <ChevronUp className="text-neon-green" size={20} />
          ) : (
            <ChevronDown className="text-neon-green" size={20} />
          )}
        </button>
        
        {isNetworksOpen && (
          <div className="p-4 space-y-4">
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefreshNetworks}
                disabled={isRefreshingNetworks}
                className="border-neon-green/40 hover:bg-neon-green/10 text-neon-green text-xs"
              >
                <RefreshCw 
                  size={14} 
                  className={`mr-2 ${isRefreshingNetworks ? 'animate-spin' : ''}`} 
                />
                Refresh Networks
              </Button>
            </div>
            {networks.length === 0 ? (
              <InfoBox
                type="info"
                message="No networks loaded yet. Click 'Refresh Networks' to load data."
              />
            ) : (
              <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2 relative">
                {/* Vertical divider line */}
                <div className="absolute left-1/2 top-0 bottom-0 w-px bg-neon-green/20 transform -translate-x-1/2 pointer-events-none" />
                
                {networks.map((network, index) => (
                  <div
                    key={network.id || index}
                    className="p-4 bg-gradient-to-br from-cyber-800/60 to-cyber-800/40 border-2 border-neon-green/40 rounded-xl hover:border-neon-green/60 transition-all shadow-lg"
                  >
                    <div className="space-y-2">
                      <div className="flex items-start gap-2">
                        <span className="text-neon-green font-semibold min-w-[100px]">ID:</span>
                        <span className="text-white/90 text-sm break-all font-mono">{network.id || 'N/A'}</span>
                      </div>
                      {network.name && (
                        <div className="flex items-start gap-2">
                          <span className="text-neon-green font-semibold min-w-[100px]">Name:</span>
                          <span className="text-white/90 text-sm">{network.name}</span>
                        </div>
                      )}
                      {network.available_ips !== undefined && (
                        <div className="flex items-start gap-2">
                          <span className="text-neon-green font-semibold min-w-[100px]">Available IPs:</span>
                          <span className="text-white/90 text-sm">{network.available_ips}</span>
                        </div>
                      )}
                      {network.used_ips !== undefined && (
                        <div className="flex items-start gap-2">
                          <span className="text-neon-green font-semibold min-w-[100px]">Used IPs:</span>
                          <span className="text-white/90 text-sm">{network.used_ips}</span>
                        </div>
                      )}
                      {network.status && (
                        <div className="flex items-start gap-2">
                          <span className="text-neon-green font-semibold min-w-[100px]">Status:</span>
                          <span className={`text-sm font-semibold ${
                            network.status === 'ACTIVE' ? 'text-neon-green' :
                            'text-white/90'
                          }`}>
                            {network.status}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Snapshot Deployment Section */}
      <div className="bg-cyber-900/80 backdrop-blur-xl rounded-2xl shadow-md border border-neon-green/20 terminal-border">
        <button
          onClick={() => setIsSnapshotDeploymentOpen(!isSnapshotDeploymentOpen)}
          className="w-full flex items-center justify-between p-4 bg-cyber-800/50 border-b border-neon-green/20 terminal-border hover:bg-cyber-800/70 transition-all"
        >
          <div className="flex items-center gap-3">
            <Rocket className="text-neon-green" size={20} />
            <h3 className="text-lg font-bold gradient-text">
              Snapshot Deployment
            </h3>
          </div>
          {isSnapshotDeploymentOpen ? (
            <ChevronUp className="text-white/60" size={20} />
          ) : (
            <ChevronDown className="text-white/60" size={20} />
          )}
        </button>
        
        {isSnapshotDeploymentOpen && (
          <div className="p-4">
            <SnapshotDevelopment />
          </div>
        )}
      </div>

      {/* Heat Templates Section */}
      <div className="bg-cyber-900/80 backdrop-blur-xl rounded-2xl shadow-md border border-neon-green/20 terminal-border">
        <button
          onClick={() => setIsHeatTemplatesOpen(!isHeatTemplatesOpen)}
          className="w-full flex items-center justify-between p-4 bg-cyber-800/50 border-b border-neon-green/20 terminal-border hover:bg-cyber-800/70 transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-neon-orange/10 rounded-lg flex items-center justify-center">
              <Flame className="text-neon-orange" size={18} />
            </div>
            <h3 className="text-lg font-bold gradient-text">
              OpenStack Heat Templates
            </h3>
          </div>
          {isHeatTemplatesOpen ? (
            <ChevronUp className="text-white/60" size={20} />
          ) : (
            <ChevronDown className="text-white/60" size={20} />
          )}
        </button>
        
        {isHeatTemplatesOpen && (
          <div className="p-4">
            <HeatTemplates />
          </div>
        )}
      </div>
    </div>
  );
};

