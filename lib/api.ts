import axios from 'axios';

// Use Next.js API proxy to bypass CORS issues
// The proxy runs on the same origin, so CORS doesn't apply
const USE_PROXY = true; // Set to false to call backend directly (requires CORS fix on backend)
const API_BASE_URL = USE_PROXY 
  ? '/api/proxy'  // Next.js API route proxy
  : 'http://localhost:8000/api/v1';  // Direct backend URL

// Helper function to decode JWT token and extract user ID
const decodeJWT = (token: string): any => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (error) {
    console.error('Error decoding JWT:', error);
    return null;
  }
};

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

// Request interceptor
apiClient.interceptors.request.use(
  (config) => {
    // Add auth token if available (check both auth_token and access_token)
    const token = localStorage.getItem('auth_token') || localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    } else {
      console.warn('No authentication token found in localStorage');
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
apiClient.interceptors.response.use(
  (response) => {
    // 204 No Content is a valid success response (especially for DELETE)
    if (response.status === 204) {
      return { ...response, data: { success: true } };
    }
    return response;
  },
  (error) => {
    // 204 No Content should be treated as success, not error
    if (error.response?.status === 204) {
      return Promise.resolve({ ...error.response, data: { success: true } });
    }
    
    // Handle CORS errors specifically
    if (error.code === 'ERR_NETWORK' || error.message?.includes('CORS') || error.message?.includes('Access-Control')) {
      console.error('CORS Error: The backend server needs to be configured to allow requests from http://localhost:3000');
      console.error('Please add CORS middleware to your FastAPI backend:');
      console.error(`
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://192.168.15.70:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
      `);
    }
    
    if (error.response?.status === 401) {
      // Handle unauthorized
      localStorage.removeItem('auth_token');
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

// Helper to get the correct API path
const getApiPath = (path: string) => {
  if (USE_PROXY) {
    // For proxy, we need to include the full backend path
    return `/auth${path.replace('/auth', '')}`;
  }
  return path;
};

// Auth API endpoints
export const authAPI = {
  login: async (username: string, password: string) => {
    const path = USE_PROXY ? '/auth/login' : '/auth/login';
    const response = await apiClient.post(path, {
      username,
      password,
    });
    // Handle different possible token field names
    const token = response.data.token || response.data.access_token || response.data.accessToken;
    if (token) {
      localStorage.setItem('auth_token', token);
      console.log('Token saved to localStorage');
    } else {
      console.warn('No token found in login response:', response.data);
    }
    return response.data;
  },

  register: async (data: {
    username: string;
    email: string;
    password: string;
    zone?: string;
    team_code?: string;
    create_team?: boolean;
    team_name?: string;
  }) => {
    const path = USE_PROXY ? '/auth/register' : '/auth/register';
    const response = await apiClient.post(path, data);
    if (response.data.token) {
      localStorage.setItem('auth_token', response.data.token);
    }
    return response.data;
  },

  logout: () => {
    localStorage.removeItem('auth_token');
  },

  getZones: async () => {
    const response = await apiClient.get('/zones');
    return response.data;
  },
};

// User API endpoints
export const userAPI = {
  // Get current user by ID (users can only get themselves)
  getCurrentUser: async (userId?: string) => {
    // If userId is provided, use it; otherwise try to get from localStorage
    let id = userId || localStorage.getItem('user_id');
    
    // If still no ID, try to extract from JWT token
    if (!id) {
      const token = localStorage.getItem('auth_token');
      if (token) {
        try {
          const decoded = decodeJWT(token);
          if (decoded && decoded.sub) {
            id = decoded.sub;
          } else if (decoded && decoded.user_id) {
            id = decoded.user_id;
          } else if (decoded && decoded.id) {
            id = decoded.id;
          }
          if (id) {
            localStorage.setItem('user_id', id);
          }
        } catch (error) {
          console.error('Error extracting user ID from token:', error);
        }
      }
    }
    
    if (!id) {
      throw new Error('User ID not found');
    }
    const path = USE_PROXY ? `/users/${id}` : `/users/${id}`;
    const response = await apiClient.get(path);
    return response.data;
  },

  // List all users (Master/Admin only)
  listUsers: async () => {
    const path = USE_PROXY ? '/users/' : '/users/';
    const response = await apiClient.get(path);
    return response.data;
  },

  // Get user by ID
  getUserById: async (userId: string) => {
    const path = USE_PROXY ? `/users/${userId}` : `/users/${userId}`;
    const response = await apiClient.get(path);
    return response.data;
  },

  // Update user
  updateUser: async (userId: string, data: {
    zone?: string;
    is_active?: boolean;
  }) => {
    const path = USE_PROXY ? `/users/${userId}` : `/users/${userId}`;
    const response = await apiClient.put(path, data);
    return response.data;
  },
};

// Team API endpoints
export const teamAPI = {
  getMyTeam: async () => {
    const path = USE_PROXY ? '/teams/my-team' : '/teams/my-team';
    const response = await apiClient.get(path);
    return response.data;
  },

  createTeam: async (data: {
    name: string;
    description?: string;
    max_members?: number;
    is_active?: boolean;
  }) => {
    const path = USE_PROXY ? '/teams/' : '/teams/';
    const response = await apiClient.post(path, data);
    return response.data;
  },

  joinTeam: async (teamCode: string) => {
    const path = USE_PROXY ? '/teams/join' : '/teams/join';
    const response = await apiClient.post(path, {
      team_code: teamCode,
    });
    return response.data;
  },

  getTeamById: async (teamId: string) => {
    const path = USE_PROXY ? `/teams/${teamId}` : `/teams/${teamId}`;
    const response = await apiClient.get(path);
    return response.data;
  },

  listTeams: async (skip = 0, limit = 100) => {
    const path = USE_PROXY ? '/teams/' : '/teams/';
    const response = await apiClient.get(path, {
      params: { skip, limit },
    });
    return response.data;
  },
};

// Challenge API endpoints
export const challengeAPI = {
  createChallenge: async (data: any) => {
    const path = USE_PROXY ? '/challenges/' : '/challenges/';
    const response = await apiClient.post(path, data);
    return response.data;
  },

  listChallenges: async (skip = 0, limit = 100) => {
    const path = USE_PROXY ? '/challenges/' : '/challenges/';
    const response = await apiClient.get(path, {
      params: { skip, limit },
    });
    return response.data;
  },

  getChallengeById: async (challengeId: string) => {
    const path = USE_PROXY ? `/challenges/${challengeId}` : `/challenges/${challengeId}`;
    const response = await apiClient.get(path);
    return response.data;
  },

  updateChallenge: async (challengeId: string, data: any) => {
    const path = USE_PROXY ? `/challenges/${challengeId}` : `/challenges/${challengeId}`;
    const response = await apiClient.put(path, data);
    return response.data;
  },

  deleteChallenge: async (challengeId: string) => {
    const path = USE_PROXY ? `/challenges/${challengeId}` : `/challenges/${challengeId}`;
    try {
      const response = await apiClient.delete(path);
      // 204 No Content is a valid success response for DELETE
      // The response interceptor already handles 204, so we should get success here
      return { success: true, ...response.data };
    } catch (error: any) {
      // If status is 204, it's actually success (handled by interceptor, but just in case)
      if (error.response?.status === 204) {
        return { success: true };
      }
      throw error;
    }
  },

  startChallenge: async (challengeId: string) => {
    const path = USE_PROXY ? `/challenges/${challengeId}/start` : `/challenges/${challengeId}/start`;
    try {
      // Log the request for debugging
      const token = localStorage.getItem('auth_token') || localStorage.getItem('access_token');
      if (!token) {
        throw new Error('Authentication token not found. Please log in again.');
      }
      
      console.log('Starting challenge:', { challengeId, path, hasToken: !!token });
      
      const response = await apiClient.post(path, {});
      return response.data;
    } catch (error: any) {
      // Enhanced error handling for start challenge
      console.error('Start challenge error details:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message,
        url: error.config?.url,
      });
      
      if (error.response) {
        let errorMessage = `Server error: ${error.response.status}`;
        if (error.response.data) {
          if (error.response.data.detail) {
            errorMessage = error.response.data.detail;
          } else if (error.response.data.message) {
            errorMessage = error.response.data.message;
          } else if (error.response.data.error) {
            errorMessage = error.response.data.error;
          } else if (typeof error.response.data === 'string') {
            errorMessage = error.response.data;
          } else {
            // Try to stringify the entire error data
            try {
              const errorStr = JSON.stringify(error.response.data);
              if (errorStr && errorStr !== '{}') {
                errorMessage = errorStr;
              }
            } catch (e) {
              // If stringification fails, use default message
            }
          }
        }
        
        // Preserve the original error structure
        const enhancedError: any = new Error(errorMessage);
        enhancedError.response = error.response;
        enhancedError.status = error.response.status;
        throw enhancedError;
      }
      
      // Handle network errors
      if (error.code === 'ERR_NETWORK' || error.message?.includes('Network Error')) {
        throw new Error('Network error: Could not connect to the server. Please check your connection.');
      }
      
      // Re-throw with a more descriptive message if no response
      if (!error.response && error.message) {
        throw new Error(`Request failed: ${error.message}`);
      }
      
      throw error;
    }
  },

  resetChallenge: async (challengeId: string) => {
    const path = USE_PROXY ? `/challenges/${challengeId}/reset` : `/challenges/${challengeId}/reset`;
    const response = await apiClient.post(path, {});
    return response.data;
  },

  deployChallenge: async (challengeId: string, teamId: string | null = null, forceRedeploy = false) => {
    const path = USE_PROXY ? `/challenges/${challengeId}/deploy` : `/challenges/${challengeId}/deploy`;
    const response = await apiClient.post(path, {
      force_redeploy: forceRedeploy,
      team_id: teamId,
    });
    return response.data;
  },

  stopChallenge: async (challengeId: string, removeInstances = false) => {
    const path = USE_PROXY ? `/challenges/${challengeId}/stop` : `/challenges/${challengeId}/stop`;
    const response = await apiClient.post(path, {
      remove_instances: removeInstances,
    });
    return response.data;
  },

  submitFlag: async (challengeId: string, flag: string) => {
    const path = USE_PROXY ? `/challenges/${challengeId}/submit-flag` : `/challenges/${challengeId}/submit-flag`;
    const response = await apiClient.post(path, { flag });
    return response.data;
  },

  getScoreboard: async () => {
    const path = USE_PROXY ? '/challenges/scores' : '/challenges/scores';
    const response = await apiClient.get(path);
    return response.data;
  },

  getChallengeStats: async (challengeId: string) => {
    const path = USE_PROXY ? `/challenges/${challengeId}/stats` : `/challenges/${challengeId}/stats`;
    const response = await apiClient.get(path);
    return response.data;
  },

  getTeamAccessInfo: async (challengeId: string, teamId: string) => {
    const path = USE_PROXY ? `/challenges/${challengeId}/team/${teamId}/access` : `/challenges/${challengeId}/team/${teamId}/access`;
    const response = await apiClient.get(path);
    return response.data;
  },
};

// File API endpoints
export const fileAPI = {
  uploadFile: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    
    const token = localStorage.getItem('auth_token');
    const backendUrl = 'http://10.10.101.69:8000/api/v1';
    const path = '/files/upload';
    
    try {
      // For file uploads, we need to call the backend directly or handle it through proxy
      // Since FormData needs special handling, we'll use axios directly
      const response = await axios.post(
        USE_PROXY ? `${API_BASE_URL}${path}` : `${backendUrl}${path}`,
        formData,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'multipart/form-data',
          },
          timeout: 60000, // 60 seconds timeout for file uploads
        }
      );
      return response.data;
    } catch (error: any) {
      // Provide better error messages
      if (error.response) {
        // Server responded with error
        const errorMessage = error.response.data?.detail || error.response.data?.message || `Server error: ${error.response.status}`;
        throw new Error(errorMessage);
      } else if (error.request) {
        // Request made but no response
        throw new Error('No response from server. Please check your connection.');
      } else {
        // Error setting up request
        throw new Error(error.message || 'Failed to upload file');
      }
    }
  },

  downloadFile: async (fileId: string) => {
    const path = USE_PROXY ? `/files/download/${fileId}` : `/files/download/${fileId}`;
    const response = await apiClient.get(path, {
      responseType: 'blob',
    });
    return response.data;
  },

  serveFile: async (fileId: string) => {
    const path = USE_PROXY ? `/files/serve/${fileId}` : `/files/serve/${fileId}`;
    const response = await apiClient.get(path, {
      responseType: 'blob',
    });
    return response.data;
  },

  listFiles: async () => {
    const path = USE_PROXY ? '/files/list' : '/files/list';
    const response = await apiClient.get(path);
    return response.data;
  },
};

// Builder API endpoints (Docker Image Management)
export const builderAPI = {
  // Build image from ZIP
  buildImage: async (
    file: File,
    imageName: string,
    options: {
      dockerfilePath?: string;
      contextSubdir?: string;
      pushToRegistry?: boolean;
      registry?: string;
    } = {}
  ) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('image_name', imageName);
    formData.append('dockerfile_path', options.dockerfilePath || 'Dockerfile');
    
    // Only append context_subdir if it's not empty
    if (options.contextSubdir && options.contextSubdir.trim()) {
      formData.append('context_subdir', options.contextSubdir.trim());
    } else {
      formData.append('context_subdir', '');
    }
    
    // Convert boolean to lowercase string (some backends are case-sensitive)
    const pushToRegistry = options.pushToRegistry || false;
    formData.append('push_to_registry', pushToRegistry ? 'true' : 'false');
    
    // Only append registry if push_to_registry is true
    if (pushToRegistry && options.registry) {
      formData.append('registry', options.registry);
    }

    const token = localStorage.getItem('auth_token');
    const backendUrl = 'http://10.10.101.69:8000/api/v1';
    const path = '/builder/build-image';

    try {
      // For FormData, don't set Content-Type - axios will set it with boundary automatically
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await axios.post(
        USE_PROXY ? `${API_BASE_URL}${path}` : `${backendUrl}${path}`,
        formData,
        {
          headers,
          timeout: 300000, // 5 minutes for image builds
        }
      );
      return response.data;
    } catch (error: any) {
      if (error.response) {
        // Try to extract detailed error message
        let errorMessage = `Server error: ${error.response.status}`;
        
        if (error.response.data) {
          if (error.response.data.detail) {
            errorMessage = error.response.data.detail;
          } else if (error.response.data.message) {
            errorMessage = error.response.data.message;
          } else if (typeof error.response.data === 'string') {
            errorMessage = error.response.data;
          } else if (error.response.data.error) {
            errorMessage = error.response.data.error;
          } else {
            // Try to stringify the entire error data for debugging
            try {
              const errorStr = JSON.stringify(error.response.data);
              if (errorStr && errorStr !== '{}') {
                errorMessage = errorStr;
              }
            } catch (e) {
              // If stringification fails, use default message
            }
          }
        }
        
        throw new Error(errorMessage);
      } else if (error.request) {
        throw new Error('No response from server. Please check your connection.');
      } else {
        throw new Error(error.message || 'Failed to build image');
      }
    }
  },

  // List local Docker images
  listImages: async () => {
    const path = USE_PROXY ? '/builder/images' : '/builder/images';
    const response = await apiClient.get(path);
    return response.data;
  },

  // Delete Docker image
  deleteImage: async (imageName: string) => {
    const encodedName = encodeURIComponent(imageName);
    const path = USE_PROXY ? `/builder/images/${encodedName}` : `/builder/images/${encodedName}`;
    try {
      const response = await apiClient.delete(path);
      return { success: true, ...response.data };
    } catch (error: any) {
      if (error.response?.status === 204) {
        return { success: true };
      }
      throw error;
    }
  },

  // Kill all challenges
  killAllChallenges: async () => {
    const path = USE_PROXY ? '/builder/kill-all' : '/builder/kill-all';
    const response = await apiClient.post(path, {});
    return response.data;
  },
};

// OpenStack API endpoints
export const openStackAPI = {
  // Test connectivity and get summary
  getSummary: async () => {
    const path = USE_PROXY ? '/openstack/summary' : '/openstack/summary';
    const response = await apiClient.get(path);
    return response.data;
  },

  // List snapshots
  listSnapshots: async () => {
    const path = USE_PROXY ? '/openstack/snapshots' : '/openstack/snapshots';
    const response = await apiClient.get(path);
    return response.data;
  },

  // List instances with status filter
  listInstances: async (statusFilter: string = 'ACTIVE') => {
    // If statusFilter is empty, don't include the query parameter (to get all instances)
    const queryParam = statusFilter ? `?status_filter=${statusFilter}` : '';
    const path = USE_PROXY 
      ? `/openstack/instances${queryParam}` 
      : `/openstack/instances${queryParam}`;
    const response = await apiClient.get(path);
    return response.data;
  },

  // List networks
  listNetworks: async () => {
    const path = USE_PROXY ? '/openstack/networks' : '/openstack/networks';
    const response = await apiClient.get(path);
    return response.data;
  },

  // List teams (helper endpoint)
  listTeams: async () => {
    const path = USE_PROXY ? '/openstack/teams' : '/openstack/teams';
    const response = await apiClient.get(path);
    return response.data;
  },

  // Plan deployment
  planDeployment: async (teamIds: string[], instancesPerTeam: number) => {
    const path = USE_PROXY 
      ? '/openstack/deployments/plan' 
      : '/openstack/deployments/plan';
    const response = await apiClient.post(path, {
      team_ids: teamIds,
      instances_per_team: instancesPerTeam,
    });
    return response.data;
  },

  // Deploy snapshot
  deploySnapshot: async (payload: {
    snapshot_id: string;
    flavor_id: string;
    team_ids: string[];
    instances_per_team: number;
    network_strategy: string;
    network_id: string;
    security_group_names: string[];
    metadata?: Record<string, any>;
  }) => {
    const path = USE_PROXY 
      ? '/openstack/deployments' 
      : '/openstack/deployments';
    const response = await apiClient.post(path, payload);
    return response.data;
  },

  // Deploy Heat template
  deployHeatTemplate: async (payload: {
    stack_name: string;
    template_body?: string;
    template_url?: string;
    parameters?: Record<string, any>;
    timeout_minutes?: number;
    rollback_on_failure?: boolean;
  }) => {
    const path = USE_PROXY 
      ? '/openstack/heat/deploy' 
      : '/openstack/heat/deploy';
    const response = await apiClient.post(path, payload);
    return response.data;
  },
};

export default apiClient;

