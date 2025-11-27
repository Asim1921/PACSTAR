'use client';

import React, { useState, useEffect } from 'react';
import { 
  Camera, 
  Users, 
  Network, 
  Shield, 
  Rocket, 
  RefreshCw,
  Settings,
  CheckCircle,
  XCircle,
  AlertCircle,
  Info,
  Play,
  Square,
  Trash2
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { InfoBox } from '@/components/ui/InfoBox';
import { useToast } from '@/components/ui/ToastProvider';
import { openStackAPI } from '@/lib/api';

export const SnapshotDevelopment: React.FC = () => {
  const { showToast } = useToast();
  
  // Loading states
  const [isLoadingSnapshots, setIsLoadingSnapshots] = useState(false);
  const [isLoadingTeams, setIsLoadingTeams] = useState(false);
  const [isLoadingNetworks, setIsLoadingNetworks] = useState(false);
  const [isPlanning, setIsPlanning] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);
  
  // Data states
  const [snapshots, setSnapshots] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [networks, setNetworks] = useState<any[]>([]);
  const [flavors, setFlavors] = useState<any[]>([]);
  const [securityGroups, setSecurityGroups] = useState<any[]>([]);
  const [deploymentPlan, setDeploymentPlan] = useState<any>(null);
  
  // Form states
  const [selectedSnapshot, setSelectedSnapshot] = useState<string>('');
  const [selectedFlavor, setSelectedFlavor] = useState<string>('');
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const [instancesPerTeam, setInstancesPerTeam] = useState<number>(1);
  const [networkStrategy, setNetworkStrategy] = useState<string>('shared');
  const [selectedNetwork, setSelectedNetwork] = useState<string>('');
  const [selectedSecurityGroups, setSelectedSecurityGroups] = useState<string[]>([]);
  
  // Fetch snapshots
  const fetchSnapshots = async () => {
    setIsLoadingSnapshots(true);
    try {
      const data = await openStackAPI.listSnapshots();
      setSnapshots(Array.isArray(data) ? data : (data.snapshots || []));
    } catch (error: any) {
      console.error('Failed to fetch snapshots:', error);
      showToast('Failed to fetch snapshots', 'error');
    } finally {
      setIsLoadingSnapshots(false);
    }
  };
  
  // Fetch teams
  const fetchTeams = async () => {
    setIsLoadingTeams(true);
    try {
      const data = await openStackAPI.listTeams();
      setTeams(Array.isArray(data) ? data : (data.teams || []));
    } catch (error: any) {
      console.error('Failed to fetch teams:', error);
      showToast('Failed to fetch teams', 'error');
    } finally {
      setIsLoadingTeams(false);
    }
  };
  
  // Fetch networks
  const fetchNetworks = async () => {
    setIsLoadingNetworks(true);
    try {
      const data = await openStackAPI.listNetworks();
      setNetworks(Array.isArray(data) ? data : (data.networks || []));
    } catch (error: any) {
      console.error('Failed to fetch networks:', error);
      showToast('Failed to fetch networks', 'error');
    } finally {
      setIsLoadingNetworks(false);
    }
  };
  
  // Plan deployment
  const handlePlanDeployment = async () => {
    if (!selectedTeams.length) {
      showToast('Please select at least one team', 'error');
      return;
    }
    
    setIsPlanning(true);
    try {
      const plan = await openStackAPI.planDeployment(selectedTeams, instancesPerTeam);
      setDeploymentPlan(plan);
      showToast('Deployment plan generated successfully', 'success');
    } catch (error: any) {
      console.error('Failed to plan deployment:', error);
      const errorMessage = error.response?.data?.detail || error.message || 'Failed to plan deployment';
      showToast(errorMessage, 'error');
    } finally {
      setIsPlanning(false);
    }
  };
  
  // Deploy snapshot
  const handleDeploySnapshot = async () => {
    if (!selectedSnapshot || !selectedFlavor || !selectedTeams.length) {
      showToast('Please fill in all required fields', 'error');
      return;
    }
    
    setIsDeploying(true);
    try {
      const payload = {
        snapshot_id: selectedSnapshot,
        flavor_id: selectedFlavor,
        team_ids: selectedTeams,
        instances_per_team: instancesPerTeam,
        network_strategy: networkStrategy,
        network_id: selectedNetwork || '',
        security_group_names: selectedSecurityGroups,
      };
      
      const result = await openStackAPI.deploySnapshot(payload);
      showToast('Snapshot deployed successfully', 'success');
      
      // Reset form
      setSelectedSnapshot('');
      setSelectedFlavor('');
      setSelectedTeams([]);
      setInstancesPerTeam(1);
      setNetworkStrategy('shared');
      setSelectedNetwork('');
      setSelectedSecurityGroups([]);
      setDeploymentPlan(null);
    } catch (error: any) {
      console.error('Failed to deploy snapshot:', error);
      const errorMessage = error.response?.data?.detail || error.message || 'Failed to deploy snapshot';
      showToast(errorMessage, 'error');
    } finally {
      setIsDeploying(false);
    }
  };
  
  // Toggle team selection
  const toggleTeam = (teamId: string) => {
    setSelectedTeams(prev => 
      prev.includes(teamId) 
        ? prev.filter(id => id !== teamId)
        : [...prev, teamId]
    );
  };
  
  // Toggle security group selection
  const toggleSecurityGroup = (sgName: string) => {
    setSelectedSecurityGroups(prev => 
      prev.includes(sgName) 
        ? prev.filter(name => name !== sgName)
        : [...prev, sgName]
    );
  };
  
  useEffect(() => {
    fetchSnapshots();
    fetchTeams();
    fetchNetworks();
  }, []);
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Camera className="text-green-600" size={24} />
          <h2 className="text-2xl font-bold text-brown-900">
            SNAPSHOT DEVELOPMENT
          </h2>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchSnapshots}
            disabled={isLoadingSnapshots}
            className=" text-xs"
          >
            <RefreshCw size={14} className={`mr-2 ${isLoadingSnapshots ? 'animate-spin' : ''}`} />
            Refresh Snapshots
          </Button>
        </div>
      </div>
      
      {/* Info Box */}
      <InfoBox
        type="info"
        message="Deploy OpenStack snapshots to multiple teams with customizable network and security configurations."
      />
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Configuration */}
        <div className="space-y-6">
          {/* Snapshot Selection */}
          <div className="bg-white rounded-2xl shadow-md border border-brown-200 p-4 lg:p-6">
            <div className="flex items-center gap-2 mb-4">
              <Camera className="text-green-600" size={18} />
              <h3 className="text-lg font-bold text-brown-900">Snapshot Selection</h3>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-brown-600 text-sm mb-2">
                  Select Snapshot *
                </label>
                <Select
                  value={selectedSnapshot}
                  onChange={(e) => setSelectedSnapshot(e.target.value)}
                  className="w-full"
                  options={[
                    { value: '', label: '-- Select Snapshot --' },
                    ...snapshots.map((snapshot) => ({
                      value: snapshot.id,
                      label: `${snapshot.name || snapshot.id} (${snapshot.size || 'N/A'})`
                    }))
                  ]}
                />
              </div>
              
              {selectedSnapshot && (
                <div className="p-3 bg-accent/10 border border-accent/30 rounded">
                  <div className="text-xs font-mono text-brown-900/80 space-y-1">
                    {snapshots.find(s => s.id === selectedSnapshot) && (
                      <>
                        <div>Status: <span className="text-green-600">{snapshots.find(s => s.id === selectedSnapshot)?.status || 'N/A'}</span></div>
                        <div>Created: <span className="text-green-600">{snapshots.find(s => s.id === selectedSnapshot)?.created_at || 'N/A'}</span></div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* Flavor Selection */}
          <div className="bg-white rounded-2xl shadow-md border border-brown-200 p-4 lg:p-6">
            <div className="flex items-center gap-2 mb-4">
              <Settings className="text-green-600" size={18} />
              <h3 className="text-lg font-bold text-brown-900">Flavor Configuration</h3>
            </div>
            
            <div>
              <label className="block text-brown-600 text-sm mb-2">
                Select Flavor *
              </label>
              <Input
                type="text"
                value={selectedFlavor}
                onChange={(e) => setSelectedFlavor(e.target.value)}
                placeholder="e.g., m1.small, m1.medium"
                className="font-mono text-sm"
              />
              <p className="text-xs text-brown-900/60 font-mono mt-1">
                Enter the flavor ID (e.g., m1.small, m1.medium, m1.large)
              </p>
            </div>
          </div>
          
          {/* Team Selection */}
          <div className="bg-white rounded-2xl shadow-md border border-brown-200 p-4 lg:p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Users className="text-green-600" size={18} />
                <h3 className="text-lg font-bold text-brown-900">Team Selection</h3>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchTeams}
                disabled={isLoadingTeams}
                className=" text-xs"
              >
                <RefreshCw size={12} className={`mr-1 ${isLoadingTeams ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
            
            <div className="space-y-3">
              <div>
                <label className="block text-brown-600 text-sm mb-2">
                  Instances Per Team
                </label>
                <Input
                  type="number"
                  value={instancesPerTeam}
                  onChange={(e) => setInstancesPerTeam(parseInt(e.target.value) || 1)}
                  min={1}
                  max={10}
                  className="font-mono text-sm"
                />
              </div>
              
              <div>
                <label className="block text-brown-600 text-sm mb-2">
                  Select Teams * ({selectedTeams.length} selected)
                </label>
                <div className="max-h-48 overflow-y-auto space-y-2 p-2 bg-brown-50 border border-brown-200 rounded-xl">
                  {teams.length === 0 ? (
                    <p className="text-brown-900/60 font-mono text-xs text-center py-4">
                      No teams available
                    </p>
                  ) : (
                    teams.map((team) => (
                      <label
                        key={team.id || team.team_id}
                        className="flex items-center gap-2 p-2 hover:bg-green-50 rounded-lg cursor-pointer transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={selectedTeams.includes(team.id || team.team_id)}
                          onChange={() => toggleTeam(team.id || team.team_id)}
                          className="accent-green-500"
                        />
                        <span className="text-brown-700 text-sm">
                          {team.name || team.team_name || team.id || team.team_id}
                        </span>
                      </label>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Right Column - Network & Security */}
        <div className="space-y-6">
          {/* Network Configuration */}
          <div className="bg-white rounded-2xl shadow-md border border-brown-200 p-4 lg:p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Network className="text-green-600" size={18} />
                <h3 className="text-lg font-bold text-brown-900">Network Configuration</h3>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchNetworks}
                disabled={isLoadingNetworks}
                className=" text-xs"
              >
                <RefreshCw size={12} className={`mr-1 ${isLoadingNetworks ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-brown-600 text-sm mb-2">
                  Network Strategy
                </label>
                <Select
                  value={networkStrategy}
                  onChange={(e) => setNetworkStrategy(e.target.value)}
                  className="w-full"
                  options={[
                    { value: 'shared', label: 'Shared Network' },
                    { value: 'isolated', label: 'Isolated Network' },
                    { value: 'custom', label: 'Custom Network' }
                  ]}
                />
              </div>
              
              {networkStrategy === 'custom' && (
                <div>
                  <label className="block text-brown-600 text-sm mb-2">
                    Select Network
                  </label>
                  <Select
                    value={selectedNetwork}
                    onChange={(e) => setSelectedNetwork(e.target.value)}
                    className="w-full"
                    options={[
                      { value: '', label: '-- Select Network --' },
                      ...networks.map((network) => ({
                        value: network.id,
                        label: network.name || network.id
                      }))
                    ]}
                  />
                </div>
              )}
            </div>
          </div>
          
          {/* Security Groups */}
          <div className="bg-white rounded-2xl shadow-md border border-brown-200 p-4 lg:p-6">
            <div className="flex items-center gap-2 mb-4">
              <Shield className="text-green-600" size={18} />
              <h3 className="text-lg font-bold text-brown-900">Security Groups</h3>
            </div>
            
            <div className="space-y-3">
              <div>
                <label className="block text-brown-600 text-sm mb-2">
                  Security Group Names ({selectedSecurityGroups.length} selected)
                </label>
                <Input
                  type="text"
                  placeholder="e.g., default, web-server, database"
                  className="font-mono text-sm mb-2"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      const value = (e.target as HTMLInputElement).value.trim();
                      if (value && !selectedSecurityGroups.includes(value)) {
                        setSelectedSecurityGroups([...selectedSecurityGroups, value]);
                        (e.target as HTMLInputElement).value = '';
                      }
                    }
                  }}
                />
                <p className="text-xs text-brown-900/60 font-mono">
                  Press Enter to add security group
                </p>
              </div>
              
              {selectedSecurityGroups.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {selectedSecurityGroups.map((sg) => (
                    <span
                      key={sg}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 border border-green-200 text-green-700 text-xs rounded-lg"
                    >
                      {sg}
                      <button
                        onClick={() => toggleSecurityGroup(sg)}
                        className="hover:text-orange-600"
                      >
                        <XCircle size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
          
          {/* Deployment Plan Preview */}
          {deploymentPlan && (
            <div className="bg-white rounded-2xl shadow-md border border-brown-200 p-4 lg:p-6">
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle className="text-green-600" size={18} />
                <h3 className="text-lg font-bold text-brown-900">Deployment Plan</h3>
              </div>
              
              <div className="space-y-2 text-sm font-mono">
                <div className="p-3 bg-accent/10 border border-accent/30 rounded">
                  <div className="text-brown-900/80 space-y-1">
                    <div>Total Instances: <span className="text-green-600 font-semibold">{deploymentPlan.total_instances || 'N/A'}</span></div>
                    <div>Teams: <span className="text-green-600 font-semibold">{deploymentPlan.teams_count || selectedTeams.length}</span></div>
                    <div>Instances per Team: <span className="text-green-600 font-semibold">{instancesPerTeam}</span></div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Action Buttons */}
      <div className="flex gap-4 justify-end">
        <Button
          variant="outline"
          size="md"
          onClick={handlePlanDeployment}
          disabled={isPlanning || !selectedTeams.length}
          className=" font-semibold"
        >
          <Settings size={18} className={`mr-2 ${isPlanning ? 'animate-spin' : ''}`} />
          {isPlanning ? 'Planning...' : 'Plan Deployment'}
        </Button>
        
        <Button
          variant="outline"
          size="md"
          onClick={handleDeploySnapshot}
          disabled={isDeploying || !selectedSnapshot || !selectedFlavor || !selectedTeams.length}
          className=" font-semibold"
        >
          <Rocket size={18} className={`mr-2 ${isDeploying ? 'animate-pulse' : ''}`} />
          {isDeploying ? 'Deploying...' : 'Deploy Snapshot'}
        </Button>
      </div>
    </div>
  );
};

