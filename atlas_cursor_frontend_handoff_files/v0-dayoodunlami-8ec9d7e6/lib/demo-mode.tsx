// Demo Mode Configuration
'use client'
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'

export interface DemoModeConfig {
  enabled: boolean
  showBanner: boolean
  sampleDataEnabled: boolean
}

// Sample data for demo mode
export const DEMO_DATA = {
  documents: [
    {
      id: "demo-1",
      filename: "Railway_Infrastructure_Strategy_2024.pdf",
      title: "Railway Infrastructure Strategy 2024",
      sector: "Transportation",
      use_case: "Infrastructure Planning",
      status: "ready",
      created_at: "2024-01-15T10:30:00Z",
      metadata: {
        summary: "Comprehensive strategy for UK railway infrastructure development",
        source: "Department for Transport",
        date: "2024-01-15",
        confidence: 0.92
      }
    },
    {
      id: "demo-2", 
      filename: "Smart_Cities_Implementation_Guide.pdf",
      title: "Smart Cities Implementation Guide",
      sector: "Urban Development",
      use_case: "Smart City Planning",
      status: "ready",
      created_at: "2024-01-10T14:20:00Z",
      metadata: {
        summary: "Best practices for implementing smart city technologies",
        source: "Tech City UK",
        date: "2024-01-10",
        confidence: 0.88
      }
    },
    {
      id: "demo-3",
      filename: "Sustainability_Framework_2024.pdf", 
      title: "Sustainability Framework 2024",
      sector: "Environment",
      use_case: "Environmental Planning",
      status: "processing",
      created_at: "2024-01-12T09:15:00Z",
      metadata: {
        summary: "Framework for sustainable development practices",
        source: "Environment Agency",
        date: "2024-01-12",
        confidence: 0.85
      }
    }
  ],

  analytics: {
    totalQueries: 2847,
    totalDocuments: 247,
    activeUsers: 89,
    averageRating: 4.2,
    responseTime: 1.2,
    systemUptime: 99.8
  },

  recentActivity: [
    {
      id: "activity-1",
      type: "document_upload",
      message: "New document uploaded: Railway Infrastructure Strategy 2024",
      timestamp: "2024-01-15T10:30:00Z",
      user: "john.smith@example.com"
    },
    {
      id: "activity-2", 
      type: "query",
      message: "AI query: 'What are the latest sustainability requirements?'",
      timestamp: "2024-01-15T10:25:00Z",
      user: "sarah.jones@example.com"
    },
    {
      id: "activity-3",
      type: "document_processed",
      message: "Document processing completed: Smart Cities Guide",
      timestamp: "2024-01-15T10:20:00Z",
      user: "system"
    }
  ],

  sectorMetrics: {
    Transportation: { documents: 45, queries: 423 },
    "Urban Development": { documents: 32, queries: 298 },
    Environment: { documents: 28, queries: 267 },
    Technology: { documents: 41, queries: 389 },
    Healthcare: { documents: 19, queries: 156 }
  },

  // Chat demo data for other pages
  chatMessages: [
    {
      id: "demo-chat-1",
      content: "What are the key sustainability requirements for railway infrastructure?",
      isUser: true,
      timestamp: new Date("2024-01-15T10:30:00Z")
    },
    {
      id: "demo-chat-2", 
      content: "Based on the Railway Infrastructure Strategy 2024, key sustainability requirements include:\n\n1. **Carbon Neutrality**: Achieve net-zero emissions by 2050\n2. **Energy Efficiency**: 30% reduction in energy consumption\n3. **Biodiversity Protection**: Minimize environmental impact on ecosystems\n4. **Circular Economy**: 80% material reuse and recycling targets\n\nWould you like me to elaborate on any of these areas?",
      isUser: false,
      timestamp: new Date("2024-01-15T10:30:30Z")
    }
  ],

  queries: [
    {
      id: "demo-query-1",
      query: "What are the latest sustainability requirements?",
      response: "Key sustainability requirements include carbon neutrality by 2050, 30% energy reduction, biodiversity protection, and 80% material reuse targets.",
      timestamp: "2024-01-15T10:30:00Z",
      confidence: 0.92,
      sources: ["Railway Infrastructure Strategy 2024", "Sustainability Framework 2024"]
    },
    {
      id: "demo-query-2",
      query: "How do smart cities implement transportation solutions?", 
      response: "Smart cities integrate IoT sensors, real-time data analytics, electric vehicle infrastructure, and multimodal transport hubs for efficient urban mobility.",
      timestamp: "2024-01-15T09:45:00Z",
      confidence: 0.88,
      sources: ["Smart Cities Implementation Guide"]
    }
  ]
}

// Context for sharing demo mode state
interface DemoModeContextType {
  config: DemoModeConfig
  toggleDemoMode: () => void
  toggleBanner: () => void
  enableSampleData: () => void
  disableSampleData: () => void
  isDemo: boolean
  showBanner: boolean
  useSampleData: boolean
  isHydrated: boolean
}

const DemoModeContext = createContext<DemoModeContextType | undefined>(undefined)

// Helper to check if we're in browser environment
const isBrowser = typeof window !== 'undefined'

// Provider component
export function DemoModeProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<DemoModeConfig>({
    enabled: false, // Default to disabled so real API data shows
    showBanner: true,
    sampleDataEnabled: false
  })
  
  const [mounted, setMounted] = useState(false)

  // Load from localStorage on mount (client-side only)
  useEffect(() => {
    if (isBrowser) {
      try {
        const saved = localStorage.getItem('demo-mode-config')
        if (saved) {
          const parsedConfig = JSON.parse(saved)
          console.log('Loaded demo config from localStorage:', parsedConfig)
          setConfig(parsedConfig)
        }
      } catch (error) {
        console.warn('Failed to load demo mode config from localStorage:', error)
      }
      setMounted(true)
    }
  }, [])

  // Save to localStorage when config changes (after mount)
  useEffect(() => {
    if (mounted && isBrowser) {
      try {
        localStorage.setItem('demo-mode-config', JSON.stringify(config))
        console.log('Demo mode config saved to localStorage:', config)
      } catch (error) {
        console.warn('Failed to save demo mode config to localStorage:', error)
      }
    }
  }, [config, mounted])

  const toggleDemoMode = () => {
    console.log('🔄 Toggling demo mode from', config.enabled, 'to', !config.enabled)
    setConfig(prev => {
      const newConfig = { ...prev, enabled: !prev.enabled }
      console.log('✅ New demo config:', newConfig)
      return newConfig
    })
  }

  const toggleBanner = () => {
    setConfig(prev => ({ ...prev, showBanner: !prev.showBanner }))
  }

  const enableSampleData = () => {
    setConfig(prev => ({ ...prev, sampleDataEnabled: true }))
  }

  const disableSampleData = () => {
    setConfig(prev => ({ ...prev, sampleDataEnabled: false }))
  }

  // Computed values for easier consumption
  const isDemo = config.enabled
  const useSampleData = config.enabled && config.sampleDataEnabled

  const contextValue: DemoModeContextType = {
    config,
    toggleDemoMode,
    toggleBanner,
    enableSampleData,
    disableSampleData,
    isDemo,
    showBanner: config.showBanner,
    useSampleData,
    isHydrated: mounted
  }

  return (
    <DemoModeContext.Provider value={contextValue}>
      {children}
    </DemoModeContext.Provider>
  )
}

// Hook for consuming demo mode context
export function useDemoMode() {
  const context = useContext(DemoModeContext)
  if (context === undefined) {
    throw new Error('useDemoMode must be used within a DemoModeProvider')
  }
  
  console.log('🔍 useDemoMode called:', { 
    isDemo: context.isDemo, 
    useSampleData: context.useSampleData, 
    mounted: context.isHydrated 
  })
  
  return context
}

// Helper to merge real data with demo data
export function withDemoData<T>(realData: T[], demoData: T[], useDemoMode: boolean): T[] {
  if (useDemoMode) {
    return realData.length === 0 ? demoData : [...realData, ...demoData]
  }
  return realData
} 