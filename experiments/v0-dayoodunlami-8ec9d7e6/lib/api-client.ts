// Real API client for Strategy AI FastAPI backend
// Backend URL: https://web-production-6045b.up.railway.app

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://web-production-6045b.up.railway.app'

export type Sector = "Rail" | "Maritime" | "Highways" | "General"
export type UseCaseType =
  | "strategy"
  | "general"
  | "Quick Playbook Answers"
  | "Lessons Learned"
  | "Project Review / MOT"
  | "TRL / RIRL Mapping"
  | "Project Similarity"
  | "Change Management"
  | "Product Acceptance"

export type UserType = "public" | "admin" | "analyst"

// Domain and Use Case Types
export interface Domain {
  id: string
  name: string
  description: string
  color: string
  icon: string
  is_active: boolean
  document_count: number
  created_at: string
  updated_at: string
  use_cases?: UseCase[]
}

export interface UseCase {
  id: string
  name: string
  description: string
  category: string
  domain_id: string
  is_active: boolean
  document_count: number
  created_at: string
  updated_at: string
}

export interface DomainWithUseCasesResponse {
  domains: Domain[]
  total_count: number
}

export interface ChatMessage {
  message: string
  sector?: Sector
  use_case?: UseCaseType
  user_type?: UserType
  session_id?: string
  model?: string
}

export interface ChatResponse {
  response: string
  sources: {
    document_title: string
    source: string
    relevance_score: number
    chunk_preview: string
  }[]
  confidence: number
  suggested_use_case?: string
  timestamp: string
  model_used: string
  agents_used?: string[]
}

export interface DocumentUploadRequest {
  sector: string
  use_case?: string
  title?: string
}

export interface DocumentMetadata extends DocumentUploadRequest {
  description?: string
}

export interface DocumentResponse {
  success?: boolean  // Keep for backward compatibility
  document_id?: string  // Keep for backward compatibility  
  message?: string  // Keep for backward compatibility
  // Rich response fields from Option B
  id?: string
  title?: string
  filename?: string
  sector?: string
  use_case?: string
  tags?: string
  source_type?: string
  source_url?: string
  status?: string
  chunk_count?: number
  created_at?: string
  updated_at?: string
  feedback_count?: number
  average_rating?: number | null
}

export interface SearchRequest {
  search_text: string
  sector?: string
  use_case?: string
  top_k?: number
}

export interface SearchResponse {
  results: {
    document_id: string
    title: string
    chunk_text: string
    relevance_score: number
    metadata: any
  }[]
  total_count: number
  search_time_ms: number
  query: string
  filters: any
}

export interface FeedbackRequest {
  chat_log_id?: string
  document_id?: string
  session_id?: string
  rating: number
  feedback_type?: string
  comment?: string
  helpful?: boolean
}

export interface SystemHealth {
  status: string
  timestamp: string
  environment: string
  version: string
  services: {
    database: string
    vector_store: string
    ai_service: string
    multi_agents: string
    document_processor: string
    feedback_system: string
  }
  system: {
    cpu_percent: number
    memory_used_mb: number
    threads: number
    uptime_seconds: number
    note?: string
  }
  metrics: {
    total_documents: number
    total_sectors: number
    total_use_cases: number
    total_feedback: number
  }
  ai_integration: string
  features: {
    multi_agent_system: boolean
    document_processing: boolean
    semantic_search: boolean
    user_feedback: boolean
    real_time_analytics: boolean
    advanced_chat: boolean
  }
}

export interface DocumentAnalysisResponse {
  success: boolean
  analysis?: {
    contentType: string
    complexity: "low" | "medium" | "high"
    recommendedChunking: {
      type: string
      size: number
      overlap: number
      strategy: string
    }
    estimatedChunks: number
    aiInsights: {
      wordCount: number
      tokenCount?: number
      hasStructure: boolean
      hasTechnicalContent: boolean
      hasDataElements: boolean
      recommendedStrategy: string
      pineconeOptimized?: boolean
      targetEmbeddingSize?: number
      primary_content_type?: string
      structure_quality?: string
      key_topics?: string[]
      chunking_priority?: string
    }
  }
  error?: string
}

// Helper function for API calls
async function apiCall<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`
  
  const defaultHeaders = {
    'Content-Type': 'application/json',
    ...options.headers,
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers: defaultHeaders,
    })

    if (!response.ok) {
      throw new Error(`API call failed: ${response.status} ${response.statusText}`)
    }

    return await response.json()
  } catch (error) {
    console.error(`API call to ${endpoint} failed:`, error)
    throw error
  }
}

// JWT Token Generation for Backend Authentication
function generateJWT(): string {
  const header = {
    alg: "HS256",
    typ: "JWT"
  };
  
  const payload = {
    sub: "frontend_user",
    exp: Math.floor(Date.now() / 1000) + (60 * 60) // 1 hour expiration
  };
  
  // Simple JWT generation (for production, use a proper JWT library)
  const secretKey = "your-secret-key-change-in-production";
  
  function base64UrlEncode(str: string): string {
    return btoa(str)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }
  
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  
  // For simplicity, we'll use a static token (in production, implement proper HMAC-SHA256)
  // This matches the token we generated with PowerShell
  return "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE3NDk1NjQ3NjksInN1YiI6InRlc3RfdXNlciJ9.b9fNCujLYFSZNzn8VEJ923OOFRmiSCd5dfJFK6OoXbY";
}

// Real API client connected to your backend
const apiClient = {
  // Health and status
  health: {
    check: async (): Promise<SystemHealth> => {
      return apiCall<SystemHealth>('/health')
    },

    aiStatus: async () => {
      return apiCall('/ai/status')
    }
  },

  // Chat with multi-agent orchestration
  chat: {
    sendMessage: async (message: ChatMessage): Promise<ChatResponse> => {
      return apiCall<ChatResponse>('/chat', {
        method: 'POST',
        body: JSON.stringify(message),
      })
    },

    sendAdvancedMessage: async (message: ChatMessage): Promise<ChatResponse> => {
      return apiCall<ChatResponse>('/chat/advanced', {
        method: 'POST',
        body: JSON.stringify(message),
      })
    },
  },

  // Document management
  documents: {
    analyze: async (file: File, sector: string, use_case: string): Promise<DocumentAnalysisResponse> => {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('sector', sector)
      formData.append('use_case', use_case)

      const jwt_token = generateJWT();

      // For file uploads, use direct fetch to avoid Content-Type header issues
      const url = `${API_BASE_URL}/documents/analyze`
      const response = await fetch(url, {
        method: 'POST',
        body: formData,
        headers: {
          'Authorization': `Bearer ${jwt_token}`,
        },
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`Analysis failed: ${response.status} ${response.statusText}`, errorText)
        throw new Error(`Analysis failed: ${response.status} ${response.statusText}`)
      }

      return await response.json()
    },

    upload: async (file: File, metadata: DocumentUploadRequest): Promise<DocumentResponse> => {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('sector', metadata.sector)
      if (metadata.use_case) formData.append('use_case', metadata.use_case)
      if (metadata.title) formData.append('title', metadata.title)

      const jwt_token = generateJWT();

      // For file uploads, don't set Content-Type - let browser handle multipart/form-data
      const url = `${API_BASE_URL}/documents/upload-v2`
      const response = await fetch(url, {
        method: 'POST',
        body: formData,
        headers: {
          'Authorization': `Bearer ${jwt_token}`,
          // Don't set Content-Type for FormData - browser sets multipart/form-data automatically
        },
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`Upload failed: ${response.status} ${response.statusText}`, errorText)
        throw new Error(`Upload failed: ${response.status} ${response.statusText}`)
      }

      return await response.json()
    },

    list: async (params: {
      sector?: string
      use_case?: string
      source_type?: string
      search?: string
      min_rating?: number
      limit?: number
      offset?: number
    } = {}) => {
      const queryParams = new URLSearchParams()
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) queryParams.append(key, value.toString())
      })
      
      const query = queryParams.toString()
      return apiCall(`/documents${query ? '?' + query : ''}`)
    },

    get: async (documentId: string) => {
      return apiCall(`/documents/${documentId}`)
    },

    delete: async (documentId: string): Promise<void> => {
      await apiCall(`/documents/${documentId}`, {
        method: 'DELETE'
      })
    },

    update: async (documentId: string, updates: Partial<Document>) => {
      return apiCall(`/documents/${documentId}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
        headers: { 'Content-Type': 'application/json' }
      })
    },
  },

  // Semantic search
  search: {
    semantic: async (request: SearchRequest): Promise<SearchResponse> => {
      return apiCall<SearchResponse>('/search', {
        method: 'POST',
        body: JSON.stringify(request),
      })
    },
  },

  // User feedback
  feedback: {
    submit: async (feedback: FeedbackRequest) => {
      return apiCall('/feedback', {
        method: 'POST',
        body: JSON.stringify(feedback),
      })
    },

    getAnalytics: async (days: number = 30) => {
      return apiCall(`/feedback/analytics?days=${days}`)
    },
  },

  // Multi-agent system
  agents: {
    getStatus: async () => {
      return apiCall('/agents/status')
    },

    analyze: async (requestData: any) => {
      return apiCall('/agents/analyze', {
        method: 'POST',
        body: JSON.stringify(requestData),
      })
    },
  },

  // Domain and use case management
  // TODO: TERMINOLOGY INCONSISTENCY - "domains" in API but "sectors" in database
  // Need to standardize language across frontend/backend/database
  domains: {
    listWithUseCases: async () => {
      return apiCall('/domains/with-use-cases')
    },

    list: async () => {
      return apiCall('/domains')
    },

    get: async (domainId: string) => {
      return apiCall(`/domains/${domainId}`)
    },

    create: async (domain: {
      name: string
      description: string
      color: string
      icon: string
    }) => {
      return apiCall('/domains', {
        method: 'POST',
        body: JSON.stringify(domain),
      })
    },

    update: async (domainId: string, updates: Partial<{
      name: string
      description: string
      color: string
      icon: string
      is_active: boolean
    }>) => {
      return apiCall(`/domains/${domainId}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      })
    },

    delete: async (domainId: string) => {
      return apiCall(`/domains/${domainId}`, {
        method: 'DELETE',
      })
    },

    copy: async (domainId: string, newName?: string) => {
      return apiCall(`/domains/${domainId}/copy`, {
        method: 'POST',
        body: JSON.stringify({ name: newName }),
      })
    },
  },

  useCases: {
    list: async (domainId?: string) => {
      const url = domainId ? `/use-cases?domain_id=${domainId}` : '/use-cases'
      return apiCall(url)
    },

    get: async (useCaseId: string) => {
      return apiCall(`/use-cases/${useCaseId}`)
    },

    create: async (useCase: {
      name: string
      description: string
      category: string
      domain_id: string
    }) => {
      return apiCall('/use-cases', {
        method: 'POST',
        body: JSON.stringify(useCase),
      })
    },

    update: async (useCaseId: string, updates: Partial<{
      name: string
      description: string
      category: string
      domain_id: string
      is_active: boolean
    }>) => {
      return apiCall(`/use-cases/${useCaseId}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      })
    },

    delete: async (useCaseId: string) => {
      return apiCall(`/use-cases/${useCaseId}`, {
        method: 'DELETE',
      })
    },

    copy: async (useCaseId: string, targetDomainId?: string, newName?: string) => {
      return apiCall(`/use-cases/${useCaseId}/copy`, {
        method: 'POST',
        body: JSON.stringify({ 
          domain_id: targetDomainId,
          name: newName 
        }),
      })
    },

    move: async (useCaseId: string, targetDomainId: string) => {
      return apiCall(`/use-cases/${useCaseId}/move`, {
        method: 'PUT',
        body: JSON.stringify({ domain_id: targetDomainId }),
      })
    },
  },

  // Authentication (if needed)
  auth: {
    login: async (username: string, password: string) => {
      return apiCall('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      })
    },

    getUser: async () => {
      return apiCall('/auth/me')
    },
  },
}

export default apiClient
