import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { 
  Droplets, 
  Clock, 
  Calendar, 
  Settings as SettingsIcon, 
  Play, 
  Square, 
  CloudRain,
  Activity,
  Wifi,
  WifiOff,
  Zap,
  Timer,
  Power,
  Thermometer,
  Cloud,
  Sun
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  usePiStatus, 
  usePiPinsTransformed, 
  usePiStartPin, 
  usePiStopPin, 
  usePiDiagnostics 
} from "@/hooks/use-pi-api";
import type { SystemStatus } from "@shared/schema";

// Define types for backend API responses
interface BackendStatusResponse {
  version: string;
  lastUpdated: string;
  connectivity: string;
  zones: any[];
  activeRuns: number;
  upcomingSchedules: any[];
  rainDelay: {
    active: boolean;
    endsAt: string | null;
  };
  piBackend: {
    url: string | null;
    connected: boolean;
  };
  masterEnabled?: boolean;
  schedules?: Array<{
    id: string;
    name?: string;
    nextRun?: string;
    isRunning?: boolean;
    zoneIds?: number[];
    minutesLeft?: number;
    steps?: Array<{
      zoneNumber: number;
      duration: number;
      timeLeft?: number;
    }>;
    currentStep?: number;
  }>;
}

export default function Dashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // State for custom duration inputs
  const [customDurations, setCustomDurations] = useState<Record<string, string>>({});
  
  // Pi direct communication hooks
  const { data: piStatus, isLoading: piStatusLoading, error: piError } = usePiStatus({
    enabled: true,
    refetchInterval: 5000,
    fallbackToOffline: true,
  });
  
  const { data: piPins = [], isLoading: piPinsLoading, piRawData } = usePiPinsTransformed({
    enabled: true,
    refetchInterval: 10000,
  });
  
  const piDiagnostics = usePiDiagnostics();
  
  // Rain delay settings and weather data
  const { data: rainDelaySettings } = useQuery({
    queryKey: ['/api/rain-delay-settings'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Weather data query - fetch detailed weather info
  const { data: weatherData, isLoading: weatherLoading } = useQuery({
    queryKey: ['/api/weather'],
    refetchInterval: 300000, // Refresh every 5 minutes
    enabled: !!(rainDelaySettings as any)?.weatherApiKey && !!(rainDelaySettings as any)?.zipCode,
  });

  // Backend API status (always fetch for rain delay info)
  const { data: backendStatus, isLoading: backendStatusLoading } = useQuery<BackendStatusResponse>({
    queryKey: ['/api/status'],
    refetchInterval: 5000,
  });

  const { data: backendPins = [], isLoading: backendPinsLoading } = useQuery({
    queryKey: ['/api/pins'],
    refetchInterval: 10000,
    enabled: !piDiagnostics.isOnline, // Only use backend when Pi is offline
  });
  
  // Use Pi data when available, otherwise fallback to backend
  const systemStatus = piDiagnostics.isOnline ? piStatus : backendStatus;
  const pins = piDiagnostics.isOnline ? piPins : (backendPins as any[]);
  const isLoading = piDiagnostics.isOnline ? 
    (piStatusLoading || piPinsLoading) : 
    (backendStatusLoading || backendPinsLoading);

  // Pi zone control hooks
  const piStartPinMutation = usePiStartPin();
  
  // Fallback backend pin control
  const backendStartPinMutation = useMutation({
    mutationFn: async ({ pin, duration }: { pin: number; duration: number }) => {
      return apiRequest('POST', `/pin/on/${pin}`, { duration });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/status'] });
      queryClient.invalidateQueries({ queryKey: ['/api/pins'] });
      toast({
        title: "Pin Started",
        description: "Pin activated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.response?.data?.error || "Failed to start pin",
        variant: "destructive",
      });
    },
  });

  // Pi zone control hooks  
  const piStopPinMutation = usePiStopPin();
  
  // Fallback backend pin control
  const backendStopPinMutation = useMutation({
    mutationFn: async (pin: number) => {
      return apiRequest('POST', `/pin/off/${pin}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/status'] });
      queryClient.invalidateQueries({ queryKey: ['/api/pins'] });
      toast({
        title: "Pin Stopped",
        description: "Pin deactivated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.response?.data?.error || "Failed to stop pin",
        variant: "destructive",
      });
    },
  });

  // Combined mutation states for UI feedback
  const startPinMutation = {
    isPending: piStartPinMutation.isPending || backendStartPinMutation.isPending,
  };
  
  const stopPinMutation = {
    isPending: piStopPinMutation.isPending || backendStopPinMutation.isPending,
  };


  // Master control mutation
  const masterControlMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      // Note: This endpoint needs to be implemented in the backend
      return apiRequest('PUT', '/api/system/master', { enabled });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/status'] });
      toast({
        title: "Master Control",
        description: "System control updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.response?.data?.error || "Failed to update master control",
        variant: "destructive",
      });
    },
  });

  // Rain delay settings mutation
  const rainDelayMutation = useMutation({
    mutationFn: async (updates: any) => {
      return apiRequest('PUT', '/api/rain-delay-settings', updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/rain-delay-settings'] });
      queryClient.invalidateQueries({ queryKey: ['/api/status'] });
      toast({
        title: "Rain Delay Settings",
        description: "Settings updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.response?.data?.error || "Failed to update rain delay settings",
        variant: "destructive",
      });
    },
  });

  // Calculate stats from system data
  const statsData = {
    totalPins: pins.length,
    activePins: pins.filter((pin: any) => pin.isRunning || pin.isActive).length,
    enabledPins: pins.filter((pin: any) => pin.isEnabled).length,
    upcomingSchedules: piDiagnostics.isOnline ? 
      0 : 
      (backendStatus?.upcomingSchedules?.length || 0),
  };

  // Get active pins for the status display
  const activePins = pins.filter((pin: any) => pin.isRunning || pin.isActive);
  const upcomingSchedules = piDiagnostics.isOnline ? 
    [] : 
    (backendStatus?.upcomingSchedules?.slice(0, 1) || []);

  const handleQuickStart = (pinNumber: number, duration: number = 30) => {
    // Check master control before starting any pin
    const masterEnabled = piDiagnostics.isOnline ? systemStatus?.masterEnabled : backendStatus?.masterEnabled;
    if (masterEnabled === false) {
      toast({
        title: "System Disabled",
        description: "Master control is disabled. Enable it to start pins.",
        variant: "destructive",
      });
      return;
    }

    if (piDiagnostics.isOnline) {
      piStartPinMutation.mutate({ pin: pinNumber, duration });
    } else {
      backendStartPinMutation.mutate({ pin: pinNumber, duration });
    }
  };

  const handleQuickStop = (pinNumber: number) => {
    if (piDiagnostics.isOnline) {
      piStopPinMutation.mutate(pinNumber);
    } else {
      backendStopPinMutation.mutate(pinNumber);
    }
  };

  // Get custom duration for a pin, default to '10'
  const getCustomDuration = (pinId: string): string => {
    return customDurations[pinId] || '10';
  };

  // Update custom duration for a pin
  const setCustomDuration = (pinId: string, duration: string) => {
    setCustomDurations(prev => ({ ...prev, [pinId]: duration }));
  };

  // Handle custom duration start
  const handleCustomStart = (pinNumber: number, pinId: string) => {
    const duration = parseInt(getCustomDuration(pinId));
    if (duration > 0 && duration <= 720) { // Max 12 hours
      handleQuickStart(pinNumber, duration);
    } else {
      toast({
        title: "Invalid Duration",
        description: "Duration must be between 1 and 720 minutes (12 hours)",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col pb-20">
        <div className="p-4 md:p-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
            <p className="text-muted-foreground">System status and pin controls</p>
          </div>
          <div className="animate-pulse space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="bg-card border border-border rounded-lg p-4 h-24" />
              ))}
            </div>
            <div className="space-y-4">
              <div className="bg-card border border-border rounded-lg h-48" />
              <div className="bg-card border border-border rounded-lg h-32" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col pb-20 safe-area-pb">
      <div className="p-4 md:p-6 mobile-scroll">
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground mobile-text-primary">Dashboard</h1>
          <p className="text-muted-foreground mobile-text-secondary">System status and pin controls</p>
        </div>
        {/* Stats Cards */}
        <div 
          className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6 mb-6 md:mb-8"
          role="region"
          aria-label="System statistics overview"
        >
          <Card 
            data-testid="stats-total-pins" 
            className="zone-card mobile-card touch-feedback-soft"
            role="article"
            aria-labelledby="total-zones-title"
            aria-describedby="total-zones-desc"
          >
            <CardContent className="p-4 md:p-6">
              <div className="flex items-center">
                <div className="flex-1">
                  <p id="total-zones-title" className="text-xs md:text-sm font-medium text-muted-foreground mobile-text-caption">Total Pins</p>
                  <p id="total-zones-desc" className="text-xl md:text-2xl font-bold text-foreground mobile-text-primary" aria-label={`${statsData.totalPins} pins configured`}>
                    {statsData.totalPins}
                  </p>
                </div>
                <div className="p-2 md:p-3 rounded-lg bg-blue-500/20 border border-blue-500/30" aria-hidden="true">
                  <Droplets className="h-6 w-6 md:h-8 md:w-8 text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card 
            data-testid="stats-active-pins" 
            className={`zone-card mobile-card touch-feedback-soft ${statsData.activePins > 0 ? 'zone-active-glow' : ''}`}
            role="article"
            aria-labelledby="active-zones-title"
            aria-describedby="active-zones-desc"
            aria-live="polite"
          >
            <CardContent className="p-4 md:p-6">
              <div className="flex items-center">
                <div className="flex-1">
                  <p id="active-zones-title" className="text-xs md:text-sm font-medium text-muted-foreground mobile-text-caption">Active Pins</p>
                  <p 
                    id="active-zones-desc" 
                    className="text-xl md:text-2xl font-bold text-primary gradient-text mobile-text-primary"
                    aria-label={`${statsData.activePins} ${statsData.activePins === 1 ? 'pin is' : 'pins are'} currently running`}
                  >
                    {statsData.activePins}
                  </p>
                </div>
                <div 
                  className={`p-2 md:p-3 rounded-lg border transition-all duration-300 ${
                    statsData.activePins > 0 
                      ? 'bg-primary/20 border-primary/50 pulse-green' 
                      : 'bg-primary/10 border-primary/20'
                  }`}
                  aria-hidden="true"
                >
                  <Activity className="h-6 w-6 md:h-8 md:w-8 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="stats-enabled-pins" className="zone-card mobile-card touch-feedback-soft">
            <CardContent className="p-4 md:p-6">
              <div className="flex items-center">
                <div className="flex-1">
                  <p className="text-xs md:text-sm font-medium text-muted-foreground mobile-text-caption">Enabled Pins</p>
                  <p className="text-xl md:text-2xl font-bold text-foreground mobile-text-primary">{statsData.enabledPins}</p>
                </div>
                <div className="p-2 md:p-3 rounded-lg bg-orange-500/20 border border-orange-500/30">
                  <Zap className="h-6 w-6 md:h-8 md:w-8 text-orange-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="stats-upcoming-schedules" className="zone-card mobile-card touch-feedback-soft">
            <CardContent className="p-4 md:p-6">
              <div className="flex items-center">
                <div className="flex-1">
                  <p className="text-xs md:text-sm font-medium text-muted-foreground mobile-text-caption">Upcoming Schedules</p>
                  <p className="text-xl md:text-2xl font-bold text-foreground mobile-text-primary">{statsData.upcomingSchedules}</p>
                </div>
                <div className="p-2 md:p-3 rounded-lg bg-purple-500/20 border border-purple-500/30">
                  <Calendar className="h-6 w-6 md:h-8 md:w-8 text-purple-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Weather Tile */}
        {weatherData && (
          <Card data-testid="weather-tile" className="zone-card mobile-card mb-6 md:mb-8">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center space-x-3">
                <div className="p-3 rounded-lg bg-sky-500/20 border border-sky-500/30">
                  <Cloud className="w-6 h-6 text-sky-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Weather Conditions</h3>
                  <p className="text-sm text-muted-foreground capitalize">
                    {weatherData.current?.description || 'Loading weather data...'}
                  </p>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Current Weather */}
                <div className="p-4 rounded-lg bg-gradient-to-br from-sky-500/10 to-blue-500/10 border border-sky-500/20">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <Thermometer className="w-5 h-5 text-sky-400" />
                      <span className="text-sm font-medium text-foreground">Current</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <CloudRain className="w-4 h-4 text-blue-400" />
                      <span className="text-xs text-muted-foreground">
                        {weatherData.current?.rainPercent || 0}%
                      </span>
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-foreground mb-1">
                    {weatherData.current?.temperature || '--'}°F
                  </div>
                  <div className="text-xs text-muted-foreground capitalize">
                    {weatherData.current?.description || 'No data'}
                  </div>
                </div>

                {/* 12 Hour Forecast */}
                <div className="p-4 rounded-lg bg-gradient-to-br from-orange-500/10 to-amber-500/10 border border-orange-500/20">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <Clock className="w-5 h-5 text-orange-400" />
                      <span className="text-sm font-medium text-foreground">12 Hour</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <CloudRain className="w-4 h-4 text-blue-400" />
                      <span className="text-xs text-muted-foreground">
                        {weatherData.forecast?.rain12HourPercent || 0}%
                      </span>
                    </div>
                  </div>
                  <div className="text-lg font-semibold text-foreground mb-1">
                    Rain Chance
                  </div>
                  <Progress 
                    value={weatherData.forecast?.rain12HourPercent || 0} 
                    className="h-2 bg-muted"
                  />
                </div>

                {/* 24 Hour Forecast */}
                <div className="p-4 rounded-lg bg-gradient-to-br from-purple-500/10 to-indigo-500/10 border border-purple-500/20">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <Calendar className="w-5 h-5 text-purple-400" />
                      <span className="text-sm font-medium text-foreground">24 Hour</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <CloudRain className="w-4 h-4 text-blue-400" />
                      <span className="text-xs text-muted-foreground">
                        {weatherData.forecast?.rain24HourPercent || 0}%
                      </span>
                    </div>
                  </div>
                  <div className="text-lg font-semibold text-foreground mb-1">
                    Rain Chance
                  </div>
                  <Progress 
                    value={weatherData.forecast?.rain24HourPercent || 0} 
                    className="h-2 bg-muted"
                  />
                </div>
              </div>
              
              {/* Last Updated */}
              {weatherData.lastUpdated && (
                <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-center">
                  <p className="text-xs text-muted-foreground">
                    Last updated: {new Date(weatherData.lastUpdated).toLocaleString()}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Weather Loading State */}
        {weatherLoading && (
          <Card className="zone-card mobile-card mb-6 md:mb-8">
            <CardContent className="p-4 md:p-6">
              <div className="animate-pulse space-y-4">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-muted rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <div className="w-32 h-4 bg-muted rounded" />
                    <div className="w-48 h-3 bg-muted rounded" />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-muted/30 rounded-lg h-24" />
                  <div className="p-4 bg-muted/30 rounded-lg h-24" />
                  <div className="p-4 bg-muted/30 rounded-lg h-24" />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Master System Control */}
        <Card data-testid="master-control" className="zone-card mobile-card mb-6 md:mb-8">
          <CardContent className="p-4 md:p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="p-3 rounded-lg bg-primary/20 border border-primary/30">
                  <Power className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Master System Control</h3>
                  <p className="text-sm text-muted-foreground">
                    {(piDiagnostics.isOnline ? systemStatus?.masterEnabled : backendStatus?.masterEnabled) ? "System is enabled and operational" : "System is disabled - all pins stopped"}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <div className={`w-3 h-3 rounded-full ${
                  (piDiagnostics.isOnline ? systemStatus?.masterEnabled : backendStatus?.masterEnabled) ? 'bg-green-400 pulse-green' : 'bg-red-400 pulse-red'
                }`} />
                <Switch
                  checked={(piDiagnostics.isOnline ? systemStatus?.masterEnabled : backendStatus?.masterEnabled) || false}
                  onCheckedChange={(checked) => {
                    masterControlMutation.mutate(checked);
                  }}
                  disabled={masterControlMutation.isPending}
                  className="data-[state=checked]:bg-primary"
                  data-testid="master-control-switch"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Rain Delay Controls */}
        <Card data-testid="rain-delay-controls" className="zone-card mobile-card mb-6 md:mb-8">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className={`p-3 rounded-lg border ${
                  backendStatus?.rainDelay?.active 
                    ? 'bg-blue-500/20 border-blue-500/30' 
                    : 'bg-muted/20 border-muted/30'
                }`}>
                  <CloudRain className={`w-6 h-6 ${
                    backendStatus?.rainDelay?.active ? 'text-blue-400' : 'text-muted-foreground'
                  }`} />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Rain Delay</h3>
                  <p className="text-sm text-muted-foreground">
                    {backendStatus?.rainDelay?.active ? "Active - watering suspended" : "Monitoring weather conditions"}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${
                  backendStatus?.rainDelay?.active ? 'bg-blue-400 pulse-blue' : 'bg-gray-400'
                }`} />
                <span className="text-sm font-medium">
                  {backendStatus?.rainDelay?.active ? 'Active' : 'Inactive'}
                </span>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Enable/Disable Toggle */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                <div>
                  <p className="text-sm font-medium">Rain Delay Enabled</p>
                  <p className="text-xs text-muted-foreground">Monitor weather automatically</p>
                </div>
                <Switch
                  checked={rainDelaySettings?.enabled || false}
                  onCheckedChange={(checked) => {
                    rainDelayMutation.mutate({ enabled: checked });
                  }}
                  disabled={rainDelayMutation.isPending}
                  data-testid="rain-delay-enabled-switch"
                />
              </div>
              
              {/* Threshold Setting */}
              <div className="p-3 rounded-lg bg-muted/30">
                <p className="text-sm font-medium mb-2">Rain Threshold</p>
                <div className="flex items-center space-x-2">
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    defaultValue="20"
                    className="h-8 text-center"
                    data-testid="rain-threshold-input"
                  />
                  <span className="text-xs text-muted-foreground">%</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Skip when rain probability exceeds this</p>
              </div>
              
              {/* ZIP Code Setting */}
              <div className="p-3 rounded-lg bg-muted/30">
                <p className="text-sm font-medium mb-2">Location</p>
                <Input
                  type="text"
                  placeholder="ZIP Code"
                  defaultValue=""
                  className="h-8"
                  data-testid="zip-code-input"
                />
                <p className="text-xs text-muted-foreground mt-1">Weather monitoring location</p>
              </div>
            </div>
            
            {/* Current Status */}
            {backendStatus?.rainDelay?.active && (
              <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <div className="flex items-center space-x-2">
                  <CloudRain className="w-4 h-4 text-blue-400" />
                  <p className="text-sm font-medium text-blue-400">Rain delay is currently active</p>
                </div>
                {backendStatus.rainDelay.endsAt && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Ends at: {new Date(backendStatus.rainDelay.endsAt).toLocaleString()}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Active Zones & Upcoming Schedules */}
          <div className="lg:col-span-2 space-y-6">
            {/* Active Zones */}
            <Card data-testid="active-pins" className="zone-card">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <div className="p-2 rounded-lg bg-primary/20 border border-primary/30 mr-3">
                    <Activity className="w-5 h-5 text-primary" />
                  </div>
                  <span className="gradient-text">Active Pins</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {activePins.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <div className="p-4 rounded-full bg-muted/50 w-fit mx-auto mb-4">
                      <Droplets className="w-12 h-12 opacity-50" />
                    </div>
                    <p className="font-medium">No pins currently running</p>
                    <p className="text-sm">Use quick controls to start watering</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {activePins.map((pin: any) => (
                      <div key={pin.pinNumber} className="zone-active-glow p-4 rounded-lg relative overflow-hidden">
                        <div className="flex items-center justify-between relative z-10">
                          <div className="flex items-center space-x-3">
                            <div className="w-4 h-4 bg-primary rounded-full pulse-green" />
                            <div>
                              <h4 className="font-medium text-foreground">{pin.name}</h4>
                              <p className="text-sm text-muted-foreground">Pin {pin.pinNumber} • GPIO {pin.gpioPin}</p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-3">
                            <div className="text-right">
                              <p className="text-sm font-medium text-primary">{pin.minutesLeft} min left</p>
                              <p className="text-xs text-muted-foreground capitalize">{pin.currentRunSource || 'Manual'}</p>
                            </div>
                            <Button
                              size="sm"
                              variant="destructive"
                              className="modern-button h-9 w-9 p-0"
                              onClick={() => handleQuickStop(pin.pinNumber)}
                              disabled={stopPinMutation.isPending}
                              data-testid={`stop-pin-${pin.pinNumber}`}
                            >
                              <Square className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Schedule Status */}
            <Card data-testid="upcoming-schedules" className="zone-card">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <div className="p-2 rounded-lg bg-purple-500/20 border border-purple-500/30 mr-3">
                    <Clock className="w-5 h-5 text-purple-400" />
                  </div>
                  Schedule Status
                  <span className="sr-only" data-testid="schedule-status">Schedule Status</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Currently Running Schedules */}
                {(() => {
                  const runningSchedules = backendStatus?.schedules?.filter((s: any) => s?.isRunning) || [];
                  return runningSchedules.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-primary mb-3 flex items-center">
                        <div className="w-2 h-2 bg-primary rounded-full pulse-green mr-2" />
                        Currently Running
                      </h4>
                      <div className="space-y-3">
                        {runningSchedules.map((schedule: any, index: number) => (
                          <div key={schedule?.id || index} className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                            <div className="flex items-center justify-between mb-2">
                              <h5 className="font-medium text-foreground">{schedule?.name || 'Unnamed Schedule'}</h5>
                              <Badge variant="default" className="bg-primary/20 text-primary">Running</Badge>
                            </div>
                            {schedule?.steps && Array.isArray(schedule.steps) && schedule.steps.length > 0 && (
                              <div className="space-y-1">
                                <p className="text-xs text-muted-foreground mb-1">Series Timeline:</p>
                                {schedule.steps.map((step: any, stepIndex: number) => (
                                  <div key={stepIndex} className="flex items-center text-xs">
                                    <div className={`w-1.5 h-1.5 rounded-full mr-2 ${
                                      stepIndex === (schedule?.currentStep || 0) ? 'bg-primary' : 'bg-muted-foreground/30'
                                    }`} />
                                    <span className={stepIndex === (schedule?.currentStep || 0) ? 'text-primary font-medium' : 'text-muted-foreground'}>
                                      Pin {step?.zoneNumber || '?'} • {step?.duration || '?'}min
                                      {stepIndex === (schedule?.currentStep || 0) && step?.timeLeft && ` (${step.timeLeft}min left)`}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* Next Upcoming Schedule */}
                {upcomingSchedules.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-muted-foreground mb-3">Next Up</h4>
                    {(() => {
                      const schedule = upcomingSchedules[0];
                      if (!schedule) return null;
                      
                      const nextRun = schedule.nextRun ? new Date(schedule.nextRun) : new Date();
                      const hoursUntil = Math.ceil((nextRun.getTime() - Date.now()) / (1000 * 60 * 60));
                      
                      return (
                        <div className="p-3 rounded-lg bg-muted/30 border">
                          <div className="flex items-center justify-between">
                            <div>
                              <h5 className="font-medium text-foreground">{schedule.name || 'Unnamed Schedule'}</h5>
                              <p className="text-xs text-muted-foreground">
                                {schedule.startTime || 'No time set'} • {nextRun.toLocaleDateString()}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-medium text-primary">
                                {hoursUntil < 24 ? `${hoursUntil}h` : `${Math.ceil(hoursUntil/24)}d`}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* No Schedules State */}
                {upcomingSchedules.length === 0 && (!(backendStatus?.schedules?.some((s: any) => s?.isRunning))) && (
                  <div className="text-center py-6 text-muted-foreground">
                    <Calendar className="w-8 h-8 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">No active or upcoming schedules</p>
                    <Link href="/schedules">
                      <Button variant="link" size="sm" className="mt-1">Create a schedule</Button>
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Control Panel & System Status */}
          <div className="space-y-6">

            {/* System Status */}
            <Card data-testid="system-status" className="zone-card">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <div className={`p-2 rounded-lg border mr-3 ${
                    (piDiagnostics.isOnline ? piDiagnostics.isOnline : backendStatus?.connectivity === "online")
                      ? 'bg-primary/20 border-primary/30'
                      : 'bg-red-500/20 border-red-500/30'
                  }`}>
                    {(piDiagnostics.isOnline ? piDiagnostics.isOnline : backendStatus?.connectivity === "online") ? (
                      <Wifi className="w-5 h-5 text-primary" />
                    ) : (
                      <WifiOff className="w-5 h-5 text-red-400" />
                    )}
                  </div>
                  System Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Connectivity Status */}
                  <div className={`flex items-center justify-between p-4 glass-effect rounded-lg border transition-all duration-200 ${
                    (piDiagnostics.isOnline ? piDiagnostics.isOnline : backendStatus?.connectivity === "online") 
                      ? 'border-primary/30 bg-primary/5'
                      : 'border-red-500/30 bg-red-500/5'
                  }`}>
                    <div className="flex items-center space-x-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center border ${
                        (piDiagnostics.isOnline ? piDiagnostics.isOnline : backendStatus?.connectivity === "online") 
                          ? "bg-primary/20 border-primary/30" 
                          : "bg-red-500/20 border-red-500/30"
                      }`}>
                        {(piDiagnostics.isOnline ? piDiagnostics.isOnline : backendStatus?.connectivity === "online") ? (
                          <Wifi className="text-primary w-5 h-5" />
                        ) : (
                          <WifiOff className="text-red-400 w-5 h-5" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">Raspberry Pi</p>
                        <p className="text-xs text-muted-foreground capitalize">
                          {piDiagnostics.isOnline ? "online" : (backendStatus?.connectivity || "Unknown")}
                        </p>
                      </div>
                    </div>
                    <span className={`w-3 h-3 rounded-full pulse-green ${
                      (piDiagnostics.isOnline ? piDiagnostics.isOnline : backendStatus?.connectivity === "online") ? "bg-primary" : "bg-red-500"
                    }`} data-testid="connectivity-indicator"></span>
                  </div>

                  {/* Rain Delay Status */}
                  <Card className={`transition-all duration-200 ${
                    backendStatus?.rainDelay?.active
                      ? 'border-blue-500/30 bg-blue-500/5'
                      : 'border-border/50'
                  }`}>
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center justify-between text-base">
                        <div className="flex items-center space-x-2">
                          <CloudRain className={`w-5 h-5 ${
                            backendStatus?.rainDelay?.active ? "text-blue-400" : "text-muted-foreground"
                          }`} />
                          <span>Rain Delay</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          {/* Enabled LED */}
                          <div className="flex items-center space-x-1">
                            <div className={`w-2 h-2 rounded-full ${
                              (rainDelaySettings as any)?.enabled ? "bg-green-400" : "bg-gray-400"
                            }`} />
                            <span className="text-xs text-muted-foreground">Enabled</span>
                          </div>
                          {/* Active LED */}
                          <div className="flex items-center space-x-1">
                            <div className={`w-2 h-2 rounded-full ${
                              backendStatus?.rainDelay?.active ? "bg-blue-400" : "bg-gray-400"
                            }`} />
                            <span className="text-xs text-muted-foreground">Active</span>
                          </div>
                        </div>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="space-y-3">
                        {/* Status and weather info */}
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium" data-testid="text-rain-delay-status">
                              {backendStatus?.rainDelay?.active ? "Currently Active" : "Inactive"}
                            </p>
                            {backendStatus?.rainDelay?.active && backendStatus?.rainDelay?.endsAt && (
                              <p className="text-xs text-muted-foreground">
                                Ends: {new Date(backendStatus.rainDelay.endsAt).toLocaleDateString()} at{' '}
                                {new Date(backendStatus.rainDelay.endsAt).toLocaleTimeString()}
                              </p>
                            )}
                          </div>
                          <Badge 
                            variant={backendStatus?.rainDelay?.active ? "secondary" : "outline"}
                            className={backendStatus?.rainDelay?.active ? "bg-blue-500/20 text-blue-400 border-blue-500/30" : ""}
                            data-testid="badge-rain-delay-status"
                          >
                            {backendStatus?.rainDelay?.active ? "ON" : "OFF"}
                          </Badge>
                        </div>

                        {/* Weather data display */}
                        {(rainDelaySettings as any)?.enabled && (rainDelaySettings as any)?.lastWeatherCheck && (
                          <div className="pt-2 border-t border-border/50">
                            <div className="grid grid-cols-3 gap-3 text-center">
                              <div>
                                <p className="text-xs text-muted-foreground">Current</p>
                                <p className="text-sm font-semibold" data-testid="text-current-rain">
                                  {(rainDelaySettings as any)?.currentRainPercent || 0}%
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">12hr</p>
                                <p className="text-sm font-semibold" data-testid="text-12hr-rain">
                                  {(rainDelaySettings as any)?.rain12HourPercent || 0}%
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">24hr</p>
                                <p className="text-sm font-semibold" data-testid="text-24hr-rain">
                                  {(rainDelaySettings as any)?.rain24HourPercent || 0}%
                                </p>
                              </div>
                            </div>
                            <p className="text-xs text-muted-foreground text-center mt-2">
                              Threshold: {(rainDelaySettings as any)?.threshold || 20}% • 
                              Last updated: {new Date((rainDelaySettings as any)?.lastWeatherCheck).toLocaleTimeString()}
                            </p>
                          </div>
                        )}

                        {/* Configuration status */}
                        {!(rainDelaySettings as any)?.enabled && (
                          <div className="pt-2 border-t border-border/50">
                            <p className="text-xs text-muted-foreground text-center">
                              Automatic rain delay is disabled. 
                              <Link href="/settings" className="text-blue-600 hover:underline ml-1">
                                Configure in Settings
                              </Link>
                            </p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Last Updated */}
                  <div className="text-xs text-muted-foreground">
                    <p>Last updated: {(piDiagnostics.isOnline ? null : backendStatus?.lastUpdated) ? 
                      new Date(backendStatus!.lastUpdated).toLocaleTimeString() : 'Unknown'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Zone Usage Summary */}
            <Card data-testid="zone-usage" className="zone-card">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <div className="p-2 rounded-lg bg-chart-1/20 border border-chart-1/30 mr-3">
                    <Activity className="w-5 h-5 text-chart-1" />
                  </div>
                  Pin Usage Today
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {pins.filter((pin: any) => pin.isEnabled !== false && pin.enabled !== false).slice(0, 3).map((pin: any, index: number) => {
                    // Mock usage data for demo purposes
                    const usage = [85, 65, 45][index] || 30;
                    
                    return (
                      <div key={pin.id} className="p-3 glass-effect rounded-lg border border-border/50">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm font-medium text-foreground">{pin.name}</span>
                          <span className="text-sm font-bold text-primary">
                            {Math.floor(usage * 0.3)} min
                          </span>
                        </div>
                        <div className="relative">
                          <Progress value={usage} className="h-3" />
                          <div className="absolute inset-0 rounded-full bg-gradient-to-r from-primary/20 to-primary/40 opacity-50" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}