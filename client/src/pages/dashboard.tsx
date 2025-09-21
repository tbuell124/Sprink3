import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
  Timer
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  usePiStatus, 
  usePiZones, 
  usePiStartZone, 
  usePiStopZone, 
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
}

export default function Dashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // State for custom duration inputs
  const [customDurations, setCustomDurations] = React.useState<Record<string, string>>({});
  
  // Pi direct communication hooks
  const { data: piStatus, isLoading: piStatusLoading, error: piError } = usePiStatus({
    enabled: true,
    refetchInterval: 5000,
    fallbackToOffline: true,
  });
  
  const { data: piZones = [], isLoading: piZonesLoading, piRawData } = usePiZones({
    enabled: true,
    refetchInterval: 10000,
  });
  
  const piDiagnostics = usePiDiagnostics();
  
  // Fallback to backend API when Pi is not available
  const { data: backendStatus, isLoading: backendStatusLoading } = useQuery<BackendStatusResponse>({
    queryKey: ['/api/status'],
    refetchInterval: 5000,
    enabled: !piDiagnostics.isOnline, // Only use backend when Pi is offline
  });

  const { data: backendZones = [], isLoading: backendZonesLoading } = useQuery({
    queryKey: ['/api/zones'],
    refetchInterval: 10000,
    enabled: !piDiagnostics.isOnline, // Only use backend when Pi is offline
  });
  
  // Use Pi data when available, otherwise fallback to backend
  const systemStatus = piDiagnostics.isOnline ? piStatus : backendStatus;
  const zones = piDiagnostics.isOnline ? piZones : (backendZones as any[]);
  const isLoading = piDiagnostics.isOnline ? 
    (piStatusLoading || piZonesLoading) : 
    (backendStatusLoading || backendZonesLoading);

  // Pi zone control hooks
  const piStartZoneMutation = usePiStartZone();
  
  // Fallback backend zone control
  const backendStartZoneMutation = useMutation({
    mutationFn: async ({ zone, duration }: { zone: number; duration: number }) => {
      return apiRequest('POST', `/zone/on/${zone}`, { duration });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/status'] });
      queryClient.invalidateQueries({ queryKey: ['/api/zones'] });
      toast({
        title: "Zone Started",
        description: "Zone activated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.response?.data?.error || "Failed to start zone",
        variant: "destructive",
      });
    },
  });

  // Pi zone control hooks  
  const piStopZoneMutation = usePiStopZone();
  
  // Fallback backend zone control
  const backendStopZoneMutation = useMutation({
    mutationFn: async (zone: number) => {
      return apiRequest('POST', `/zone/off/${zone}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/status'] });
      queryClient.invalidateQueries({ queryKey: ['/api/zones'] });
      toast({
        title: "Zone Stopped",
        description: "Zone deactivated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.response?.data?.error || "Failed to stop zone",
        variant: "destructive",
      });
    },
  });

  // Combined mutation states for UI feedback
  const startZoneMutation = {
    isPending: piStartZoneMutation.isPending || backendStartZoneMutation.isPending,
  };
  
  const stopZoneMutation = {
    isPending: piStopZoneMutation.isPending || backendStopZoneMutation.isPending,
  };

  // Calculate stats from system data
  const statsData = {
    totalZones: zones.length,
    activeZones: zones.filter((zone: any) => zone.isRunning || zone.isActive).length,
    enabledZones: zones.filter((zone: any) => zone.isEnabled).length,
    upcomingSchedules: piDiagnostics.isOnline ? 
      (piStatus?.schedules?.length || 0) : 
      (backendStatus?.upcomingSchedules?.length || 0),
  };

  // Get active zones for the status display
  const activeZones = zones.filter((zone: any) => zone.isRunning || zone.isActive);
  const upcomingSchedules = piDiagnostics.isOnline ? 
    (piStatus?.schedules?.slice(0, 3) || []) : 
    (backendStatus?.upcomingSchedules?.slice(0, 3) || []);

  const handleQuickStart = (zoneNumber: number, duration: number = 30) => {
    if (piDiagnostics.isOnline) {
      piStartZoneMutation.mutate({ zone: zoneNumber, duration });
    } else {
      backendStartZoneMutation.mutate({ zone: zoneNumber, duration });
    }
  };

  const handleQuickStop = (zoneNumber: number) => {
    if (piDiagnostics.isOnline) {
      piStopZoneMutation.mutate(zoneNumber);
    } else {
      backendStopZoneMutation.mutate(zoneNumber);
    }
  };

  // Get custom duration for a zone, default to '10'
  const getCustomDuration = (zoneId: string): string => {
    return customDurations[zoneId] || '10';
  };

  // Update custom duration for a zone
  const setCustomDuration = (zoneId: string, duration: string) => {
    setCustomDurations(prev => ({ ...prev, [zoneId]: duration }));
  };

  // Handle custom duration start
  const handleCustomStart = (zoneNumber: number, zoneId: string) => {
    const duration = parseInt(getCustomDuration(zoneId));
    if (duration > 0 && duration <= 720) { // Max 12 hours
      handleQuickStart(zoneNumber, duration);
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
            <p className="text-muted-foreground">System status and zone controls</p>
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
          <p className="text-muted-foreground mobile-text-secondary">System status and zone controls</p>
        </div>
        {/* Stats Cards */}
        <div 
          className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6 mb-6 md:mb-8"
          role="region"
          aria-label="System statistics overview"
        >
          <Card 
            data-testid="stats-total-zones" 
            className="zone-card mobile-card touch-feedback-soft"
            role="article"
            aria-labelledby="total-zones-title"
            aria-describedby="total-zones-desc"
          >
            <CardContent className="p-4 md:p-6">
              <div className="flex items-center">
                <div className="flex-1">
                  <p id="total-zones-title" className="text-xs md:text-sm font-medium text-muted-foreground mobile-text-caption">Total Zones</p>
                  <p id="total-zones-desc" className="text-xl md:text-2xl font-bold text-foreground mobile-text-primary" aria-label={`${statsData.totalZones} zones configured`}>
                    {statsData.totalZones}
                  </p>
                </div>
                <div className="p-2 md:p-3 rounded-lg bg-blue-500/20 border border-blue-500/30" aria-hidden="true">
                  <Droplets className="h-6 w-6 md:h-8 md:w-8 text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card 
            data-testid="stats-active-zones" 
            className={`zone-card mobile-card touch-feedback-soft ${statsData.activeZones > 0 ? 'zone-active-glow' : ''}`}
            role="article"
            aria-labelledby="active-zones-title"
            aria-describedby="active-zones-desc"
            aria-live="polite"
          >
            <CardContent className="p-4 md:p-6">
              <div className="flex items-center">
                <div className="flex-1">
                  <p id="active-zones-title" className="text-xs md:text-sm font-medium text-muted-foreground mobile-text-caption">Active Zones</p>
                  <p 
                    id="active-zones-desc" 
                    className="text-xl md:text-2xl font-bold text-primary gradient-text mobile-text-primary"
                    aria-label={`${statsData.activeZones} ${statsData.activeZones === 1 ? 'zone is' : 'zones are'} currently running`}
                  >
                    {statsData.activeZones}
                  </p>
                </div>
                <div 
                  className={`p-2 md:p-3 rounded-lg border transition-all duration-300 ${
                    statsData.activeZones > 0 
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

          <Card data-testid="stats-enabled-zones" className="zone-card mobile-card touch-feedback-soft">
            <CardContent className="p-4 md:p-6">
              <div className="flex items-center">
                <div className="flex-1">
                  <p className="text-xs md:text-sm font-medium text-muted-foreground mobile-text-caption">Enabled Zones</p>
                  <p className="text-xl md:text-2xl font-bold text-foreground mobile-text-primary">{statsData.enabledZones}</p>
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

        {/* Quick Zone Controls */}
        <Card data-testid="quick-zone-controls" className="zone-card mobile-card mb-6 md:mb-8">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center mobile-text-primary">
              <div className="p-2 rounded-lg bg-orange-500/20 border border-orange-500/30 mr-3">
                <Zap className="w-4 h-4 md:w-5 md:h-5 text-orange-400" />
              </div>
              Quick Zone Controls
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 md:px-6">
            <div className="grid grid-cols-1 gap-4 md:gap-6">
              {zones.map((zone: any) => {
                const isActive = zone.isRunning || zone.isActive || zone.state === 'on';
                const isEnabled = zone.isEnabled !== false && zone.enabled !== false;
                
                return (
                  <div 
                    key={zone.id || zone.zoneNumber} 
                    className={`p-4 md:p-6 rounded-lg border transition-all duration-200 mobile-card touch-feedback-soft ${
                      isActive 
                        ? 'zone-active-glow border-primary/50 bg-primary/5' 
                        : 'glass-effect border-border/50 hover:border-primary/30'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <div className={`w-4 h-4 rounded-full ${
                          isActive ? 'bg-primary pulse-green' : 'bg-muted-foreground/30'
                        }`} />
                        <div>
                          <h4 className="font-medium text-foreground mobile-text-primary">{zone.name}</h4>
                          <p className="text-xs text-muted-foreground mobile-text-caption">
                            Zone {zone.zoneNumber} • GPIO {zone.gpioPin || zone.id}
                          </p>
                        </div>
                      </div>
                      <Badge 
                        variant={isActive ? "default" : "outline"}
                        className={`${isActive ? "bg-primary/20 text-primary border-primary/30" : ""} px-3 py-1`}
                        aria-label={`${zone.name} is ${isActive ? 'on' : 'off'}`}
                      >
                        {isActive ? "ON" : "OFF"}
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-4 gap-2 mb-4">
                      {/* Quick duration presets */}
                      {[5, 10, 15, 30].map((duration) => (
                        <Button
                          key={duration}
                          size="sm"
                          variant={isActive ? "outline" : "secondary"}
                          className="h-10 text-sm btn-mobile touch-feedback"
                          onClick={() => handleQuickStart(zone.zoneNumber || zone.id, duration)}
                          disabled={!isEnabled || startZoneMutation.isPending || isActive}
                          data-testid={`start-zone-${zone.zoneNumber || zone.id}-${duration}min`}
                          aria-label={`Start ${zone.name} for ${duration} minutes. ${isActive ? 'Currently running.' : 'Currently off.'}`}
                          aria-describedby={`zone-${zone.zoneNumber || zone.id}-status`}
                        >
                          {duration}m
                        </Button>
                      ))}
                    </div>
                    
                    <div className="flex flex-col space-y-3">
                      {/* Custom duration input */}
                      <div className="flex space-x-2">
                        <div className="flex-1">
                          <Input
                            type="number"
                            min="1"
                            max="720"
                            value={getCustomDuration(zone.id || zone.zoneNumber.toString())}
                            onChange={(e) => setCustomDuration(zone.id || zone.zoneNumber.toString(), e.target.value)}
                            className="h-12 text-center mobile-input"
                            placeholder="10"
                            disabled={!isEnabled || startZoneMutation.isPending || isActive}
                            data-testid={`custom-duration-input-${zone.zoneNumber || zone.id}`}
                            aria-label={`Custom duration in minutes for ${zone.name}`}
                          />
                        </div>
                        <Button
                          size="default"
                          variant="default"
                          className="btn-mobile-lg touch-feedback h-12 px-6"
                          onClick={() => handleCustomStart(zone.zoneNumber || zone.id, zone.id || zone.zoneNumber.toString())}
                          disabled={!isEnabled || startZoneMutation.isPending || isActive}
                          data-testid={`start-custom-duration-${zone.zoneNumber || zone.id}`}
                          aria-label={`Start ${zone.name} for custom duration`}
                        >
                          <Play className="w-4 h-4 mr-2" aria-hidden="true" />
                          Start
                        </Button>
                      </div>
                      
                      {/* Stop button */}
                      <Button
                        size="default"
                        variant={isActive ? "destructive" : "outline"}
                        className="w-full btn-mobile-lg touch-feedback h-12"
                        onClick={() => handleQuickStop(zone.zoneNumber || zone.id)}
                        disabled={!isEnabled || stopZoneMutation.isPending || !isActive}
                        data-testid={`stop-zone-${zone.zoneNumber || zone.id}`}
                        aria-label={`Stop ${zone.name}. ${isActive ? 'Currently running. Double-tap to stop.' : 'Currently off.'} ${!isEnabled ? 'Zone disabled.' : ''}`}
                        aria-describedby={`zone-${zone.zoneNumber || zone.id}-status`}
                      >
                        <Square className="w-4 h-4 mr-2" aria-hidden="true" />
                        {isActive ? "Stop Zone" : "Quick Stop"}
                      </Button>
                    </div>
                    
                    {/* Hidden status description for screen readers */}
                    <span 
                      id={`zone-${zone.zoneNumber || zone.id}-status`} 
                      className="sr-only"
                      aria-live="polite"
                    >
                      {zone.name}, Zone {zone.zoneNumber}, GPIO {zone.gpioPin || zone.id}. 
                      Status: {isActive ? 'Running' : 'Stopped'}. 
                      {!isEnabled && 'Zone is disabled.'}
                      {isActive && zone.minutesLeft && ` ${zone.minutesLeft} minutes remaining.`}
                    </span>
                    
                    {!isEnabled && (
                      <p className="text-xs text-muted-foreground mt-2 text-center">
                        Zone disabled
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
            
            {zones.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <div className="p-4 rounded-full bg-muted/50 w-fit mx-auto mb-4">
                  <Zap className="w-12 h-12 opacity-50" />
                </div>
                <p className="font-medium">No zones configured</p>
                <p className="text-sm">Add zones in Settings to get started</p>
                <Link href="/settings">
                  <Button variant="link" className="mt-2">Go to Settings</Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Active Zones & Upcoming Schedules */}
          <div className="lg:col-span-2 space-y-6">
            {/* Active Zones */}
            <Card data-testid="active-zones" className="zone-card">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <div className="p-2 rounded-lg bg-primary/20 border border-primary/30 mr-3">
                    <Activity className="w-5 h-5 text-primary" />
                  </div>
                  <span className="gradient-text">Active Zones</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {activeZones.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <div className="p-4 rounded-full bg-muted/50 w-fit mx-auto mb-4">
                      <Droplets className="w-12 h-12 opacity-50" />
                    </div>
                    <p className="font-medium">No zones currently running</p>
                    <p className="text-sm">Use quick controls to start watering</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {activeZones.map((zone: any) => (
                      <div key={zone.id} className="zone-active-glow p-4 rounded-lg relative overflow-hidden">
                        <div className="flex items-center justify-between relative z-10">
                          <div className="flex items-center space-x-3">
                            <div className="w-4 h-4 bg-primary rounded-full pulse-green" />
                            <div>
                              <h4 className="font-medium text-foreground">{zone.name}</h4>
                              <p className="text-sm text-muted-foreground">Zone {zone.zoneNumber} • GPIO {zone.gpioPin}</p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-3">
                            <div className="text-right">
                              <p className="text-sm font-medium text-primary">{zone.minutesLeft} min left</p>
                              <p className="text-xs text-muted-foreground capitalize">{zone.currentRunSource || 'Manual'}</p>
                            </div>
                            <Button
                              size="sm"
                              variant="destructive"
                              className="modern-button h-9 w-9 p-0"
                              onClick={() => handleQuickStop(zone.zoneNumber)}
                              disabled={stopZoneMutation.isPending}
                              data-testid={`stop-zone-${zone.zoneNumber}`}
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

            {/* Upcoming Schedules */}
            <Card data-testid="upcoming-schedules" className="zone-card">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <div className="p-2 rounded-lg bg-purple-500/20 border border-purple-500/30 mr-3">
                    <Clock className="w-5 h-5 text-purple-400" />
                  </div>
                  Upcoming Schedules
                </CardTitle>
              </CardHeader>
              <CardContent>
                {upcomingSchedules.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No upcoming schedules</p>
                    <Link href="/schedules">
                      <Button variant="link" className="mt-2">Create a schedule</Button>
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {upcomingSchedules.map((schedule: any, index: number) => {
                      const nextRun = new Date(schedule.nextRun);
                      const hoursUntil = Math.ceil((nextRun.getTime() - Date.now()) / (1000 * 60 * 60));
                      
                      return (
                        <div key={schedule.id || index} className="flex items-center justify-between p-4 glass-effect rounded-lg border border-border/50 hover:border-primary/30 transition-all duration-200">
                          <div className="flex items-center space-x-3">
                            <div className="w-2 h-8 bg-gradient-to-b from-primary to-primary/50 rounded-full" />
                            <div>
                              <h4 className="font-medium text-foreground">{schedule.name}</h4>
                              <p className="text-sm text-muted-foreground">
                                {schedule.startTime} • {schedule.days?.join(', ')}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium text-primary">
                              {hoursUntil < 24 ? `${hoursUntil}h` : `${Math.ceil(hoursUntil/24)}d`}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {nextRun.toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Control Panel & System Status */}
          <div className="space-y-6">
            {/* Quick Zone Controls */}
            <Card data-testid="quick-controls" className="zone-card">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <div className="p-2 rounded-lg bg-primary/20 border border-primary/30 mr-3">
                    <Play className="w-5 h-5 text-primary" />
                  </div>
                  Quick Zone Controls
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  {zones.slice(0, 4).map((zone: any) => (
                    <Button
                      key={zone.id}
                      size="sm"
                      variant={zone.isRunning ? "destructive" : "default"}
                      className={`flex flex-col h-16 text-xs modern-button relative overflow-hidden ${
                        zone.isRunning ? 'zone-active-glow' : 'zone-card'
                      }`}
                      onClick={() => zone.isRunning ? handleQuickStop(zone.zoneNumber) : handleQuickStart(zone.zoneNumber)}
                      disabled={!zone.isEnabled || startZoneMutation.isPending || stopZoneMutation.isPending}
                      data-testid={`quick-control-zone-${zone.zoneNumber}`}
                    >
                      {zone.isRunning && <div className="absolute inset-0 bg-gradient-to-t from-primary/30 to-primary/10" />}
                      {zone.isRunning ? <Square className="w-4 h-4 mb-1 relative z-10" /> : <Play className="w-4 h-4 mb-1 relative z-10" />}
                      <span className="truncate relative z-10">{zone.name}</span>
                      <span className="text-xs opacity-75 relative z-10">Zone {zone.zoneNumber}</span>
                    </Button>
                  ))}
                </div>
                
                <div className="space-y-2 pt-2 border-t">
                  <Link href="/zones">
                    <Button variant="secondary" className="w-full modern-button glass-effect" data-testid="manage-zones">
                      <SettingsIcon className="w-4 h-4 mr-2" />
                      Manage All Zones
                    </Button>
                  </Link>
                  <Link href="/schedules">
                    <Button variant="secondary" className="w-full modern-button glass-effect" data-testid="manage-schedules">
                      <Calendar className="w-4 h-4 mr-2" />
                      Manage Schedules
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>

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
                  <div className={`flex items-center justify-between p-4 glass-effect rounded-lg border transition-all duration-200 ${
                    (piDiagnostics.isOnline ? piStatus?.rain?.is_active : backendStatus?.rainDelay?.active)
                      ? 'border-blue-500/30 bg-blue-500/5'
                      : 'border-border/50 bg-muted/20'
                  }`}>
                    <div className="flex items-center space-x-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center border ${
                        (piDiagnostics.isOnline ? piStatus?.rain?.is_active : backendStatus?.rainDelay?.active) 
                          ? "bg-blue-500/20 border-blue-500/30" 
                          : "bg-muted/30 border-border/50"
                      }`}>
                        <CloudRain className={`w-5 h-5 ${
                          (piDiagnostics.isOnline ? piStatus?.rain?.is_active : backendStatus?.rainDelay?.active) ? "text-blue-400" : "text-muted-foreground"
                        }`} />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">Rain Delay</p>
                        <p className="text-xs text-muted-foreground">
                          {(piDiagnostics.isOnline ? piStatus?.rain?.is_active : backendStatus?.rainDelay?.active) ? "Active" : "Inactive"}
                        </p>
                      </div>
                    </div>
                    <Badge 
                      variant={(piDiagnostics.isOnline ? piStatus?.rain?.is_active : backendStatus?.rainDelay?.active) ? "secondary" : "outline"}
                      className={(piDiagnostics.isOnline ? piStatus?.rain?.is_active : backendStatus?.rainDelay?.active) ? "bg-blue-500/20 text-blue-400 border-blue-500/30" : ""}
                    >
                      {(piDiagnostics.isOnline ? piStatus?.rain?.is_active : backendStatus?.rainDelay?.active) ? "ON" : "OFF"}
                    </Badge>
                  </div>

                  {/* Last Updated */}
                  <div className="text-xs text-muted-foreground">
                    <p>Last updated: {(piDiagnostics.isOnline ? piStatus?.last_updated : backendStatus?.lastUpdated) ? 
                      new Date(piDiagnostics.isOnline ? piStatus!.last_updated : backendStatus!.lastUpdated).toLocaleTimeString() : 'Unknown'}</p>
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
                  Zone Usage Today
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {zones.slice(0, 3).map((zone: any, index: number) => {
                    // Mock usage data for demo purposes
                    const usage = [85, 65, 45][index] || 30;
                    
                    return (
                      <div key={zone.id} className="p-3 glass-effect rounded-lg border border-border/50">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm font-medium text-foreground">{zone.name}</span>
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