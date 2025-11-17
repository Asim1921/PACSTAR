import axios from 'axios';

// Use Next.js API proxy to bypass CORS issues
// The proxy runs on the same origin, so CORS doesn't apply
const USE_PROXY = true; // Set to false to call backend directly (requires CORS fix on backend)
const API_BASE_URL = USE_PROXY 
  ? '/api/proxy'  // Next.js API route proxy
  : 'http://192.168.250.178:8000/api/v1';  // Direct backend URL

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
    // Add auth token if available
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
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

export default apiClient;

