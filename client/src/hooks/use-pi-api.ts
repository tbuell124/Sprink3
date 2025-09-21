/**
 * React hooks for Pi integration with React Query
 * Provides direct browser-to-Pi communication with proper error handling
 */

import { useMutation, useQuery, useQueryClient, QueryKey } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { 
  createPiApiClient, 
  getPiConfigFromStorage, 
  savePiConfigToStorage,
  PiConnectionConfig, 
  PiSystemStatus, 
  PiZoneControlResponse, 
  PiConnectionError,
  getNetworkTroubleshootingTips
} from "@/lib/pi-api";
import { useState, useCallback, useMemo } from "react";

/**
 * Hook to manage Pi connection configuration
 */
export function usePiConfig() {
  const [config, setConfigState] = useState<PiConnectionConfig>(() => getPiConfigFromStorage());

  const updateConfig = useCallback((updates: Partial<PiConnectionConfig>) => {
    const newConfig = { ...config, ...updates };
    setConfigState(newConfig);
    savePiConfigToStorage(updates);
  }, [config]);

  const piClient = useMemo(() => createPiApiClient(config), [config]);

  return {
    config,
    updateConfig,
    piClient,
  };
}

/**
 * Hook to test Pi connection
 */
export function usePiConnectionTest() {
  const { toast } = useToast();
  const { piClient } = usePiConfig();

  return useMutation({
    mutationFn: async () => {
      return await piClient.testConnection();
    },
    onSuccess: (result) => {
      if (result.success) {
        toast({
          title: "Connection Successful",
          description: `Connected to Pi (Version: ${result.version})`,
        });
      } else {
        toast({
          title: "Connection Failed",
          description: result.error || "Unknown error",
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      let message = "Connection test failed";
      let tips: string[] = [];

      if (error instanceof PiConnectionError) {
        message = error.message;
        tips = getNetworkTroubleshootingTips(error);
      }

      toast({
        title: "Connection Test Failed", 
        description: message,
        variant: "destructive",
      });

      // Log troubleshooting tips to console for debugging
      if (tips.length > 0) {
        console.group("Pi Connection Troubleshooting Tips:");
        tips.forEach(tip => console.log(`• ${tip}`));
        console.groupEnd();
      }
    },
  });
}

/**
 * Hook to get Pi system status
 */
export function usePiStatus(options?: { 
  enabled?: boolean; 
  refetchInterval?: number;
  fallbackToOffline?: boolean;
}) {
  const { piClient, config } = usePiConfig();
  const { enabled = true, refetchInterval = 5000, fallbackToOffline = true } = options || {};

  return useQuery({
    queryKey: ['pi-status', config.ipAddress, config.port] as QueryKey,
    queryFn: async (): Promise<PiSystemStatus | null> => {
      try {
        return await piClient.getStatus();
      } catch (error) {
        if (fallbackToOffline && error instanceof PiConnectionError) {
          // Return null to indicate offline status instead of throwing
          return null;
        }
        throw error;
      }
    },
    enabled,
    refetchInterval: enabled ? refetchInterval : false,
    retry: (failureCount, error) => {
      // Don't retry on auth errors or if explicitly disabled
      if (error instanceof PiConnectionError && error.type === 'auth') {
        return false;
      }
      return failureCount < 2; // Retry up to 2 times
    },
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}

/**
 * Hook to start a zone on the Pi
 */
export function usePiStartZone() {
  const { toast } = useToast();
  const { piClient } = usePiConfig();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ zone, duration }: { zone: number; duration: number }): Promise<PiZoneControlResponse> => {
      return await piClient.startZone(zone, duration);
    },
    onSuccess: (result, variables) => {
      toast({
        title: "Zone Started",
        description: `Zone ${variables.zone} started for ${variables.duration} minutes`,
      });
      // Invalidate status to get updated zone state
      queryClient.invalidateQueries({ queryKey: ['pi-status'] });
    },
    onError: (error: any, variables) => {
      let message = `Failed to start zone ${variables.zone}`;
      
      if (error instanceof PiConnectionError) {
        switch (error.type) {
          case 'auth':
            message = "Authentication failed. Check your API token.";
            break;
          case 'network':
            message = "Cannot reach Pi. Check network connection.";
            break;
          default:
            message = error.message;
        }
      }

      toast({
        title: "Zone Start Failed",
        description: message,
        variant: "destructive",
      });
    },
  });
}

/**
 * Hook to stop a zone on the Pi
 */
export function usePiStopZone() {
  const { toast } = useToast();
  const { piClient } = usePiConfig();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (zone: number): Promise<PiZoneControlResponse> => {
      return await piClient.stopZone(zone);
    },
    onSuccess: (result, zone) => {
      toast({
        title: "Zone Stopped",
        description: `Zone ${zone} stopped successfully`,
      });
      // Invalidate status to get updated zone state
      queryClient.invalidateQueries({ queryKey: ['pi-status'] });
    },
    onError: (error: any, zone) => {
      let message = `Failed to stop zone ${zone}`;
      
      if (error instanceof PiConnectionError) {
        switch (error.type) {
          case 'auth':
            message = "Authentication failed. Check your API token.";
            break;
          case 'network':
            message = "Cannot reach Pi. Check network connection.";
            break;
          default:
            message = error.message;
        }
      }

      toast({
        title: "Zone Stop Failed",
        description: message,
        variant: "destructive",
      });
    },
  });
}

/**
 * Hook to manage Pi connection with health monitoring
 */
export function usePiConnection() {
  const { config, updateConfig, piClient } = usePiConfig();
  const { toast } = useToast();

  // Health check query that runs less frequently
  const healthQuery = useQuery({
    queryKey: ['pi-health', config.ipAddress, config.port] as QueryKey,
    queryFn: async () => {
      try {
        await piClient.getHealth();
        return { connected: true, lastCheck: new Date() };
      } catch (error) {
        return { connected: false, lastCheck: new Date(), error };
      }
    },
    refetchInterval: 30000, // Check every 30 seconds
    retry: false, // Don't retry health checks
  });

  const updatePiConfig = useMutation({
    mutationFn: async (newConfig: Partial<PiConnectionConfig>) => {
      updateConfig(newConfig);
      return newConfig;
    },
    onSuccess: () => {
      toast({
        title: "Configuration Updated",
        description: "Pi configuration has been saved",
      });
      // Invalidate health and status queries to test new config
      healthQuery.refetch();
    },
  });

  return {
    config,
    updateConfig: updatePiConfig.mutate,
    isUpdating: updatePiConfig.isPending,
    connection: {
      isConnected: healthQuery.data?.connected || false,
      lastCheck: healthQuery.data?.lastCheck,
      isChecking: healthQuery.isFetching,
      error: healthQuery.data?.error,
    },
    client: piClient,
  };
}

/**
 * Hook to get Pi zones with transformation from pin-based to zone-based data
 */
export function usePiZones(options?: { enabled?: boolean; refetchInterval?: number }) {
  const piStatusQuery = usePiStatus(options);

  // Transform Pi pin data to zone format that matches the backend API
  const zones = useMemo(() => {
    if (!piStatusQuery.data?.pins) return [];

    return piStatusQuery.data.pins.map((pin, index) => ({
      id: `pi-zone-${index + 1}`,
      zoneNumber: index + 1,
      gpioPin: pin.pin,
      name: pin.name || `Zone ${index + 1}`,
      isEnabled: pin.is_enabled,
      isRunning: pin.is_active,
      isActive: pin.is_active,
      minutesLeft: 0, // We'd need to calculate this from status data
      currentRunSource: pin.is_active ? 'manual' : null,
      defaultDuration: 30, // Default value since Pi doesn't provide this
    }));
  }, [piStatusQuery.data]);

  return {
    ...piStatusQuery,
    data: zones,
    piRawData: piStatusQuery.data,
  };
}

/**
 * Hook to save Pi connection configuration
 */
export function useSavePiConfig() {
  const { toast } = useToast();
  const { updateConfig } = usePiConfig();

  return useMutation({
    mutationFn: async (config: Partial<PiConnectionConfig>) => {
      updateConfig(config);
      return config;
    },
    onSuccess: () => {
      toast({
        title: "Configuration Saved",
        description: "Pi connection settings have been saved",
      });
    },
    onError: () => {
      toast({
        title: "Save Failed",
        description: "Failed to save Pi configuration",
        variant: "destructive",
      });
    },
  });
}

/**
 * Hook to provide connection status and diagnostics
 */
export function usePiDiagnostics() {
  const { config, piClient } = usePiConfig();
  const { data: status, error: statusError } = usePiStatus({ enabled: true, fallbackToOffline: true });

  const diagnostics = useMemo(() => {
    const info = piClient.getConnectionInfo();
    
    return {
      connectionUrl: info.url,
      hasApiToken: info.hasToken,
      isConfigured: !!config.ipAddress,
      isOnline: !!status,
      lastUpdate: status?.last_updated,
      version: status?.version,
      rainDelay: status?.rain?.is_active || false,
      activeZones: status?.pins?.filter(p => p.is_active).length || 0,
      error: statusError instanceof PiConnectionError ? statusError : null,
    };
  }, [config, piClient, status, statusError]);

  return diagnostics;
}