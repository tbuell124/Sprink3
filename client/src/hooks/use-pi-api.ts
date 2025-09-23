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
  PiPinControlResponse, 
  PiConnectionError,
  getNetworkTroubleshootingTips,
  PiPinsResponse
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
          description: `Connected to Pi (Backend: ${result.backend})`,
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
    retry: false, // Disable retries to reduce console noise
    staleTime: 10000, // Consider data stale after 10 seconds
    gcTime: 60000, // Keep data in cache for 1 minute
  });
}

/**
 * Hook to get Pi pins status
 */
export function usePiPins(options?: { enabled?: boolean; refetchInterval?: number }) {
  const { piClient, config } = usePiConfig();
  const { enabled = true, refetchInterval = 5000 } = options || {};

  return useQuery({
    queryKey: ['pi-pins', config.ipAddress, config.port] as QueryKey,
    queryFn: async (): Promise<PiPinsResponse | null> => {
      try {
        return await piClient.getPins();
      } catch (error) {
        if (error instanceof PiConnectionError) {
          // Return null to indicate offline status instead of throwing
          return null;
        }
        throw error;
      }
    },
    enabled,
    refetchInterval: enabled ? refetchInterval : false,
    retry: false, // Disable retries to reduce console noise
    staleTime: 10000, // Consider data stale after 10 seconds
    gcTime: 60000, // Keep data in cache for 1 minute
  });
}

/**
 * Hook to start a pin on the Pi
 */
export function usePiStartPin() {
  const { toast } = useToast();
  const { piClient } = usePiConfig();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ pin, duration }: { pin: number; duration: number }): Promise<PiPinControlResponse> => {
      return await piClient.startPin(pin, duration);
    },
    onSuccess: (result, variables) => {
      toast({
        title: "Pin Started",
        description: `Pin ${variables.pin} started for ${variables.duration} minutes`,
      });
      // Invalidate status and pins to get updated pin state
      queryClient.invalidateQueries({ queryKey: ['pi-status'] });
      queryClient.invalidateQueries({ queryKey: ['pi-pins'] });
    },
    onError: (error: any, variables) => {
      let message = `Failed to start pin ${variables.pin}`;
      
      if (error instanceof PiConnectionError) {
        switch (error.type) {
          case 'auth':
            message = "Authentication failed. Check your API token.";
            break;
          case 'network':
            message = "Cannot reach Pi. Check network connection.";
            break;
          case 'mixed_content':
            message = "Mixed content blocked. See troubleshooting tips in console.";
            break;
          default:
            message = error.message;
        }
      }

      toast({
        title: "Pin Start Failed",
        description: message,
        variant: "destructive",
      });
    },
  });
}

/**
 * Hook to stop a pin on the Pi
 */
export function usePiStopPin() {
  const { toast } = useToast();
  const { piClient } = usePiConfig();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (pin: number): Promise<PiPinControlResponse> => {
      return await piClient.stopPin(pin);
    },
    onSuccess: (result, pin) => {
      toast({
        title: "Pin Stopped",
        description: `Pin ${pin} stopped successfully`,
      });
      // Invalidate status and pins to get updated pin state
      queryClient.invalidateQueries({ queryKey: ['pi-status'] });
      queryClient.invalidateQueries({ queryKey: ['pi-pins'] });
    },
    onError: (error: any, pin) => {
      let message = `Failed to stop pin ${pin}`;
      
      if (error instanceof PiConnectionError) {
        switch (error.type) {
          case 'auth':
            message = "Authentication failed. Check your API token.";
            break;
          case 'network':
            message = "Cannot reach Pi. Check network connection.";
            break;
          case 'mixed_content':
            message = "Mixed content blocked. See troubleshooting tips in console.";
            break;
          default:
            message = error.message;
        }
      }

      toast({
        title: "Pin Stop Failed",
        description: message,
        variant: "destructive",
      });
    },
  });
}

/**
 * Hook to control pins directly
 */
export function usePiPinControl() {
  const { toast } = useToast();
  const { piClient } = usePiConfig();
  const queryClient = useQueryClient();

  const turnOnMutation = useMutation({
    mutationFn: async (pin: number): Promise<PiPinControlResponse> => {
      return await piClient.turnPinOn(pin);
    },
    onSuccess: (result, pin) => {
      toast({
        title: "Pin Activated",
        description: `Pin ${pin} turned on successfully`,
      });
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['pi-status'] });
      queryClient.invalidateQueries({ queryKey: ['pi-pins'] });
    },
    onError: (error: any, pin) => {
      handlePinControlError(error, `turn on pin ${pin}`, toast);
    },
  });

  const turnOffMutation = useMutation({
    mutationFn: async (pin: number): Promise<PiPinControlResponse> => {
      return await piClient.turnPinOff(pin);
    },
    onSuccess: (result, pin) => {
      toast({
        title: "Pin Deactivated",
        description: `Pin ${pin} turned off successfully`,
      });
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['pi-status'] });
      queryClient.invalidateQueries({ queryKey: ['pi-pins'] });
    },
    onError: (error: any, pin) => {
      handlePinControlError(error, `turn off pin ${pin}`, toast);
    },
  });

  return {
    turnOn: turnOnMutation,
    turnOff: turnOffMutation,
  };
}

/**
 * Helper function to handle pin control errors
 */
function handlePinControlError(error: any, action: string, toast: any) {
  let message = `Failed to ${action}`;
  
  if (error instanceof PiConnectionError) {
    switch (error.type) {
      case 'auth':
        message = "Authentication failed. Check your API token.";
        break;
      case 'network':
        message = "Cannot reach Pi. Check network connection.";
        break;
      case 'mixed_content':
        message = "Mixed content blocked. You're accessing this page over HTTPS but the Pi uses HTTP. See troubleshooting tips in console.";
        break;
      case 'cors':
        message = "Cross-origin request blocked. The Pi needs to allow CORS.";
        break;
      default:
        message = error.message;
    }
    
    // Log troubleshooting tips for detailed errors
    const tips = getNetworkTroubleshootingTips(error);
    if (tips.length > 0) {
      console.group("Pi Connection Troubleshooting Tips:");
      tips.forEach(tip => console.log(`• ${tip}`));
      console.groupEnd();
    }
  }

  toast({
    title: "Pin Control Failed",
    description: message,
    variant: "destructive",
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
    refetchInterval: 60000, // Check every 60 seconds (less frequent)
    retry: false, // Don't retry health checks
    staleTime: 30000, // Consider stale after 30 seconds
    gcTime: 120000, // Keep in cache for 2 minutes
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
 * Hook to get Pi pins with transformation from pin-based to pin-based data (transformed for backend compatibility)
 */
export function usePiPinsTransformed(options?: { enabled?: boolean; refetchInterval?: number }) {
  const piStatusQuery = usePiStatus(options);
  const piPinsQuery = usePiPins(options);

  // Transform Pi pin data to pin format that matches the backend API
  const pins = useMemo(() => {
    if (!piStatusQuery.data?.pins || !piPinsQuery.data || !Array.isArray(piPinsQuery.data)) return [];

    // Create a map of pin states for quick lookup
    const pinStateMap = new Map();
    piPinsQuery.data.forEach((pin: any) => {
      pinStateMap.set(pin.id, pin.state === 'on');
    });

    return piStatusQuery.data.pins.map((pinNumber, index) => ({
      id: `pi-pin-${index + 1}`,
      pinNumber: index + 1,
      gpioPin: pinNumber,
      name: `Pin ${index + 1}`,
      isEnabled: !piStatusQuery.data?.deny.includes(pinNumber), // Not in deny list
      isRunning: pinStateMap.get(pinNumber) || false,
      isActive: pinStateMap.get(pinNumber) || false,
      minutesLeft: 0, // We'd need to calculate this from additional data
      currentRunSource: pinStateMap.get(pinNumber) ? 'manual' : null,
      defaultDuration: 30, // Default value since Pi doesn't provide this
    }));
  }, [piStatusQuery.data, piPinsQuery.data]);

  return {
    data: pins,
    isLoading: piStatusQuery.isLoading || piPinsQuery.isLoading,
    error: piStatusQuery.error || piPinsQuery.error,
    refetch: () => {
      piStatusQuery.refetch();
      piPinsQuery.refetch();
    },
    piRawData: piStatusQuery.data,
    piPinsData: piPinsQuery.data,
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
      isOnline: !!status && status.ok,
      backend: status?.backend,
      pigpioConnected: status?.pigpio_connected || false,
      allowedPins: status?.pins || [],
      deniedPins: status?.deny || [],
      allowMode: status?.allow_mode || '',
      error: statusError instanceof PiConnectionError ? statusError : null,
    };
  }, [config, piClient, status, statusError]);

  return diagnostics;
}