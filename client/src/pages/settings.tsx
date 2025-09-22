import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { 
  Droplets, 
  Play, 
  Square, 
  Settings as SettingsIcon, 
  Edit, 
  TestTube, 
  Clock,
  Zap,
  Activity,
  Wifi,
  Check,
  X,
  Loader,
  AlertTriangle,
  Cloud,
  CloudRain
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useState, useEffect } from "react";
import { 
  usePiConnectionTest, 
  usePiConfig, 
  useSavePiConfig, 
  usePiDiagnostics,
  usePiZones 
} from "@/hooks/use-pi-api";
import { PiConnectionError, getNetworkTroubleshootingTips } from "@/lib/pi-api";
import type { Zone } from "@shared/schema";

// Extended zone type for UI with runtime properties
interface ZoneWithStatus extends Zone {
  isRunning?: boolean;
  minutesLeft?: number;
  currentRunSource?: string;
}

export default function Settings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingZone, setEditingZone] = useState<ZoneWithStatus | null>(null);
  const [testDuration, setTestDuration] = useState<number>(5);
  const [piIpAddress, setPiIpAddress] = useState<string>(localStorage.getItem('piIpAddress') || '192.168.1.24');
  const [piPort, setPiPort] = useState<number>(parseInt(localStorage.getItem('piPort') || '8000'));
  const [piApiToken, setPiApiToken] = useState<string>(localStorage.getItem('piApiToken') || '');
  const [piUseHttps, setPiUseHttps] = useState<boolean>(localStorage.getItem('piUseHttps') === 'true');
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [showTroubleshooting, setShowTroubleshooting] = useState<boolean>(false);
  const [customDurations, setCustomDurations] = useState<Record<string, string>>({});
  
  // Rain delay settings state
  const [rainDelaySettings, setRainDelaySettings] = useState({
    enabled: false,
    zipCode: "",
    threshold: 20,
    checkCurrent: true,
    check12Hour: true,
    check24Hour: true,
    weatherApiKey: "",
  });
  
  // Pi integration hooks
  const { config: piConfig, updateConfig: updatePiConfig } = usePiConfig();
  const connectionTestMutation = usePiConnectionTest();
  const savePiConfigMutation = useSavePiConfig();
  const piDiagnostics = usePiDiagnostics();

  const { data: zones = [], isLoading } = useQuery({
    queryKey: ['/api/zones'],
    refetchInterval: 10000, // Refresh every 10 seconds
  });
  
  // Ensure zones is properly typed
  const typedZones = zones as ZoneWithStatus[];

  const { data: systemStatus } = useQuery({
    queryKey: ['/api/status'],
    refetchInterval: 5000,
  });

  // Rain delay settings query
  const { data: rainDelaySettingsData } = useQuery({
    queryKey: ['/api/rain-delay-settings'],
  });

  // Weather data query
  const { data: weatherData, refetch: refetchWeather } = useQuery({
    queryKey: ['/api/weather'],
    enabled: false, // Only fetch when manually triggered
  });

  // Update rain delay settings when data is fetched
  useEffect(() => {
    if (rainDelaySettingsData) {
      const data = rainDelaySettingsData as any;
      setRainDelaySettings({
        enabled: data.enabled,
        zipCode: data.zipCode,
        threshold: data.threshold,
        checkCurrent: data.checkCurrent,
        check12Hour: data.check12Hour,
        check24Hour: data.check24Hour,
        weatherApiKey: "", // Don't populate from server for security
      });
    }
  }, [rainDelaySettingsData]);

  const updateZoneMutation = useMutation({
    mutationFn: async ({ zoneId, updates }: { zoneId: string; updates: any }) => {
      return apiRequest('PUT', `/api/zones/${zoneId}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/zones'] });
      queryClient.invalidateQueries({ queryKey: ['/api/status'] });
      setEditingZone(null);
      toast({
        title: "Zone Updated",
        description: "Zone configuration saved successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.response?.data?.error || "Failed to update zone",
        variant: "destructive",
      });
    },
  });

  const testZoneMutation = useMutation({
    mutationFn: async ({ zone, duration }: { zone: number; duration: number }) => {
      return apiRequest('POST', `/zone/on/${zone}`, { duration });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/zones'] });
      queryClient.invalidateQueries({ queryKey: ['/api/status'] });
      toast({
        title: "Zone Test Started",
        description: `Zone test running for ${testDuration} minutes`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.response?.data?.error || "Failed to start zone test",
        variant: "destructive",
      });
    },
  });

  const stopZoneMutation = useMutation({
    mutationFn: async (zone: number) => {
      return apiRequest('POST', `/zone/off/${zone}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/zones'] });
      queryClient.invalidateQueries({ queryKey: ['/api/status'] });
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

  // Rain delay settings mutations
  const updateRainDelaySettingsMutation = useMutation({
    mutationFn: async (updates: any) => {
      return apiRequest('PUT', '/api/rain-delay-settings', updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/rain-delay-settings'] });
      toast({
        title: "Rain Delay Settings Updated",
        description: "Settings saved successfully",
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

  const checkWeatherMutation = useMutation({
    mutationFn: async () => {
      const response = await refetchWeather();
      return response.data;
    },
    onSuccess: () => {
      toast({
        title: "Weather Updated",
        description: "Latest weather data fetched successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Weather Error",
        description: "Failed to fetch weather data. Check your API key and ZIP code.",
        variant: "destructive",
      });
    },
  });

  // Rain delay settings handlers
  const handleUpdateRainDelaySettings = (updates: any) => {
    setRainDelaySettings(prev => ({ ...prev, ...updates }));
    updateRainDelaySettingsMutation.mutate(updates);
  };

  const handleCheckWeather = () => {
    if (!rainDelaySettings.weatherApiKey || !rainDelaySettings.zipCode) {
      toast({
        title: "Configuration Required",
        description: "Please enter your OpenWeatherMap API key and ZIP code first.",
        variant: "destructive",
      });
      return;
    }
    checkWeatherMutation.mutate();
  };

  // Remove old testConnectionMutation - now using usePiConnectionTest hook

  // Remove old savePiIpMutation - now using useSavePiConfig hook

  const handleSavePiConfig = () => {
    const newConfig = {
      ipAddress: piIpAddress,
      port: piPort,
      apiToken: piApiToken,
      useHttps: piUseHttps,
    };
    savePiConfigMutation.mutate(newConfig);
    updatePiConfig(newConfig);
  };

  const handleTestConnection = () => {
    setConnectionStatus('testing');
    setShowTroubleshooting(false);
    
    // Update config before testing
    updatePiConfig({
      ipAddress: piIpAddress,
      port: piPort,
      apiToken: piApiToken,
      useHttps: piUseHttps,
    });
    
    connectionTestMutation.mutate(undefined, {
      onSuccess: (result) => {
        setConnectionStatus(result.success ? 'success' : 'error');
        if (!result.success) {
          setShowTroubleshooting(true);
        }
      },
      onError: (error) => {
        setConnectionStatus('error');
        setShowTroubleshooting(true);
      },
    });
  };

  const handleUpdateZone = (zoneId: string, updates: any) => {
    updateZoneMutation.mutate({ zoneId, updates });
  };

  const handleTestZone = (zoneNumber: number) => {
    testZoneMutation.mutate({ zone: zoneNumber, duration: testDuration });
  };

  const handleStopZone = (zoneNumber: number) => {
    stopZoneMutation.mutate(zoneNumber);
  };

  const handleSaveEdit = () => {
    if (editingZone) {
      handleUpdateZone(editingZone.id, {
        name: editingZone.name,
        defaultDuration: editingZone.defaultDuration,
        isEnabled: editingZone.isEnabled,
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col pb-20">
        <div className="p-4 md:p-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-foreground">Settings</h1>
            <p className="text-muted-foreground">Zone configuration and system settings</p>
          </div>
          <div className="animate-pulse space-y-4">
            <div className="bg-card border border-border rounded-lg h-32" />
            <div className="bg-card border border-border rounded-lg h-48" />
            <div className="bg-card border border-border rounded-lg h-64" />
          </div>
        </div>
      </div>
    );
  }

  const activeZones = typedZones.filter((zone: ZoneWithStatus) => zone.isRunning);
  const enabledZones = typedZones.filter((zone: ZoneWithStatus) => zone.isEnabled);
  const disabledZones = typedZones.filter((zone: ZoneWithStatus) => !zone.isEnabled);

  return (
    <div className="flex-1 flex flex-col pb-20">
      <div className="p-4 md:p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground">Zone configuration and system settings</p>
        </div>

        {/* Mixed Content Security Warning */}
        {(piDiagnostics.error?.type === 'mixed_content' || 
          (window.location.protocol === 'https:' && piDiagnostics.error && !piDiagnostics.isOnline && piIpAddress === '192.168.1.24')) && (
          <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg" data-testid="mixed-content-warning">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="font-semibold text-yellow-800 dark:text-yellow-200 mb-2">
                  Browser Security Blocking Connection
                </h3>
                <p className="text-yellow-700 dark:text-yellow-300 text-sm mb-3">
                  Your browser is blocking the connection because this page is served over HTTPS but your Pi uses HTTP. This is a security feature.
                </p>
                <div className="space-y-2">
                  <p className="text-yellow-800 dark:text-yellow-200 font-medium text-sm">To connect to your Pi:</p>
                  <div className="bg-yellow-100 dark:bg-yellow-900/40 p-3 rounded border">
                    <p className="text-yellow-900 dark:text-yellow-100 text-sm font-mono">
                      {window.location.href.replace('https://', 'http://')}
                    </p>
                    <p className="text-yellow-700 dark:text-yellow-300 text-xs mt-1">
                      Copy this HTTP URL and open it in a new tab
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Raspberry Pi Configuration */}
        <Card className="mb-6" data-testid="pi-configuration">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Wifi className="w-5 h-5" />
              <span>Raspberry Pi Configuration</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="pi-ip-address">IP Address</Label>
                <Input
                  id="pi-ip-address"
                  type="text"
                  placeholder="192.168.1.24"
                  value={piIpAddress}
                  onChange={(e) => setPiIpAddress(e.target.value)}
                  data-testid="input-pi-ip"
                />
              </div>
              
              <div>
                <Label htmlFor="pi-port">Port</Label>
                <Input
                  id="pi-port"
                  type="number"
                  placeholder="8000"
                  value={piPort}
                  onChange={(e) => setPiPort(parseInt(e.target.value) || 8000)}
                  data-testid="input-pi-port"
                />
              </div>
              
              <div>
                <Label htmlFor="pi-api-token">API Token (Optional)</Label>
                <Input
                  id="pi-api-token"
                  type="password"
                  placeholder="Enter API token if required"
                  value={piApiToken}
                  onChange={(e) => setPiApiToken(e.target.value)}
                  data-testid="input-pi-token"
                />
              </div>
              
              <div className="flex items-center space-x-2">
                <Switch
                  id="pi-use-https"
                  checked={piUseHttps}
                  onCheckedChange={setPiUseHttps}
                  data-testid="switch-pi-https"
                />
                <Label htmlFor="pi-use-https">Use HTTPS</Label>
              </div>
            </div>
            
            <div className="flex space-x-2">
                <Button
                  onClick={handleSavePiConfig}
                  disabled={savePiConfigMutation.isPending}
                  variant="outline"
                  data-testid="button-save-config"
                >
                  {savePiConfigMutation.isPending ? "Saving..." : "Save"}
                </Button>
                <Button
                  onClick={handleTestConnection}
                  disabled={connectionTestMutation.isPending || !piIpAddress}
                  data-testid="button-test-connection"
                >
                  {connectionTestMutation.isPending ? (
                    <Loader className="w-4 h-4 mr-2 animate-spin" />
                  ) : connectionStatus === 'success' ? (
                    <Check className="w-4 h-4 mr-2" />
                  ) : connectionStatus === 'error' ? (
                    <X className="w-4 h-4 mr-2" />
                  ) : (
                    <Wifi className="w-4 h-4 mr-2" />
                  )}
                  Test
                </Button>
              </div>
            
            <div className="p-3 bg-muted/50 rounded-lg">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">
                    <strong>Connection URL:</strong> {piUseHttps ? 'https' : 'http'}://{piIpAddress}:{piPort}<br />
                    <strong>Status:</strong> 
                    <span className={`ml-1 ${connectionStatus === 'success' ? 'text-green-600' : connectionStatus === 'error' ? 'text-red-600' : 'text-muted-foreground'}`}>
                      {connectionStatus === 'success' ? 'Connected' : connectionStatus === 'error' ? 'Connection Failed' : connectionStatus === 'testing' ? 'Testing...' : 'Not Tested'}
                    </span>
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">
                    <strong>Pi Online:</strong> {piDiagnostics.isOnline ? '✅ Yes' : '❌ No'}<br />
                    <strong>Backend:</strong> {piDiagnostics.backend || 'Unknown'}
                  </p>
                </div>
              </div>
              
              <p className="text-xs text-muted-foreground mt-3">
                Configure your Raspberry Pi connection. Default port is 8000. 
                API token is only required if your Pi has authentication enabled.
              </p>
              
              {showTroubleshooting && connectionStatus === 'error' && (
                <div className="mt-3 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                  <h4 className="text-sm font-semibold text-destructive mb-2">Connection Troubleshooting:</h4>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    <li>• Check that the Pi is powered on and connected to your network</li>
                    <li>• Verify the IP address is correct (try pinging it)</li>
                    <li>• Make sure both your browser and Pi are on the same network</li>
                    <li>• Check if the Pi's firewall is blocking the port</li>
                    <li>• Try accessing directly: {piUseHttps ? 'https' : 'http'}://{piIpAddress}:{piPort}/status</li>
                  </ul>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* System Status Bar */}
        <Card className="mb-6" data-testid="zone-status-overview">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                  <Droplets className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Zones</p>
                  <p className="text-lg font-semibold">{typedZones.length}</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-lg">
                  <Activity className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Active Zones</p>
                  <p className="text-lg font-semibold">{activeZones.length}</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-orange-100 dark:bg-orange-900/20 rounded-lg">
                  <Zap className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Enabled Zones</p>
                  <p className="text-lg font-semibold">{enabledZones.length}</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-purple-100 dark:bg-purple-900/20 rounded-lg">
                  <TestTube className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Test Duration</p>
                  <div className="flex items-center space-x-2">
                    <Input
                      type="number"
                      min="1"
                      max="60"
                      value={testDuration}
                      onChange={(e) => setTestDuration(Number(e.target.value))}
                      className="w-16 h-6 text-sm"
                    />
                    <span className="text-sm text-muted-foreground">min</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="all" className="space-y-6" data-testid="zone-tabs">
          <TabsList>
            <TabsTrigger value="all" data-testid="tab-all">
              All Zones ({typedZones.length})
            </TabsTrigger>
            <TabsTrigger value="active" data-testid="tab-active">
              Active ({activeZones.length})
            </TabsTrigger>
            <TabsTrigger value="enabled" data-testid="tab-enabled">
              Enabled ({enabledZones.length})
            </TabsTrigger>
            <TabsTrigger value="disabled" data-testid="tab-disabled">
              Disabled ({disabledZones.length})
            </TabsTrigger>
            <TabsTrigger value="quick-controls" data-testid="tab-quick-controls">
              <Zap className="w-4 h-4 mr-2" />
              Quick Controls
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all">
            <ZoneGrid 
              zones={typedZones} 
              onEdit={setEditingZone}
              onTest={handleTestZone}
              onStop={handleStopZone}
              onToggleEnabled={(zone) => handleUpdateZone(zone.id, { isEnabled: !zone.isEnabled })}
              testDuration={testDuration}
              isLoading={testZoneMutation.isPending || stopZoneMutation.isPending}
            />
          </TabsContent>

          <TabsContent value="active">
            <ZoneGrid 
              zones={activeZones} 
              onEdit={setEditingZone}
              onTest={handleTestZone}
              onStop={handleStopZone}
              onToggleEnabled={(zone) => handleUpdateZone(zone.id, { isEnabled: !zone.isEnabled })}
              testDuration={testDuration}
              isLoading={testZoneMutation.isPending || stopZoneMutation.isPending}
            />
          </TabsContent>

          <TabsContent value="enabled">
            <ZoneGrid 
              zones={enabledZones} 
              onEdit={setEditingZone}
              onTest={handleTestZone}
              onStop={handleStopZone}
              onToggleEnabled={(zone) => handleUpdateZone(zone.id, { isEnabled: !zone.isEnabled })}
              testDuration={testDuration}
              isLoading={testZoneMutation.isPending || stopZoneMutation.isPending}
            />
          </TabsContent>

          <TabsContent value="disabled">
            <ZoneGrid 
              zones={disabledZones} 
              onEdit={setEditingZone}
              onTest={handleTestZone}
              onStop={handleStopZone}
              onToggleEnabled={(zone) => handleUpdateZone(zone.id, { isEnabled: !zone.isEnabled })}
              testDuration={testDuration}
              isLoading={testZoneMutation.isPending || stopZoneMutation.isPending}
            />
          </TabsContent>

          <TabsContent value="quick-controls" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="w-5 h-5" />
                  Zone Quick Controls
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {typedZones.map((zone) => {
                    const isActive = zone.isRunning || zone.isActive;
                    const customDuration = customDurations[zone.id] || "10";
                    
                    return (
                      <div
                        key={zone.id}
                        className={`p-4 rounded-lg border transition-all ${
                          isActive 
                            ? 'border-primary/50 bg-primary/5' 
                            : 'border-border/50 hover:border-primary/30'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center space-x-2">
                            <div className={`w-3 h-3 rounded-full ${
                              isActive ? 'bg-primary pulse-green' : 'bg-muted-foreground/30'
                            }`} />
                            <h4 className="font-medium">{zone.name}</h4>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setEditingZone(zone)}
                              data-testid={`edit-zone-${zone.id}`}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Switch
                              checked={zone.isEnabled}
                              onCheckedChange={(checked) => handleUpdateZone(zone.id, { isEnabled: checked })}
                              data-testid={`toggle-zone-${zone.id}`}
                            />
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <div className="flex space-x-2">
                            <Input
                              type="number"
                              min="1"
                              max="720"
                              value={customDuration}
                              onChange={(e) => setCustomDurations(prev => ({ ...prev, [zone.id]: e.target.value }))}
                              className="h-8 text-center flex-1"
                              placeholder="10"
                              disabled={!zone.isEnabled || isActive}
                              data-testid={`duration-input-${zone.id}`}
                            />
                            <Button
                              size="sm"
                              onClick={() => handleTestZone(zone, parseInt(customDuration) || 10)}
                              disabled={!zone.isEnabled || isActive || testZoneMutation.isPending}
                              data-testid={`start-zone-${zone.id}`}
                            >
                              <Play className="w-4 h-4 mr-1" />
                              Start
                            </Button>
                          </div>
                          
                          <Button
                            size="sm"
                            variant={isActive ? "destructive" : "outline"}
                            className="w-full"
                            onClick={() => handleStopZone(zone)}
                            disabled={!zone.isEnabled || !isActive || stopZoneMutation.isPending}
                            data-testid={`stop-zone-${zone.id}`}
                          >
                            <Square className="w-4 h-4 mr-1" />
                            {isActive ? "Stop" : "Quick Stop"}
                          </Button>
                        </div>
                        
                        <div className="text-xs text-muted-foreground mt-2">
                          Zone {zone.zoneNumber} • GPIO {zone.gpioPin}
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                {typedZones.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Zap className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p className="font-medium">No zones configured</p>
                    <p className="text-sm">Add zones to enable quick controls</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="rain-delay" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CloudRain className="w-5 h-5" />
                  Rain Delay Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Enable Rain Delay */}
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="rain-delay-enabled" className="text-base font-medium">
                      Enable Automatic Rain Delay
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Automatically skip watering when rain is predicted
                    </p>
                  </div>
                  <Switch
                    id="rain-delay-enabled"
                    checked={rainDelaySettings.enabled}
                    onCheckedChange={(checked) => handleUpdateRainDelaySettings({ enabled: checked })}
                    data-testid="switch-rain-delay-enabled"
                  />
                </div>

                {/* API Configuration */}
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="weather-api-key">OpenWeatherMap API Key</Label>
                    <Input
                      id="weather-api-key"
                      type="password"
                      value={rainDelaySettings.weatherApiKey}
                      onChange={(e) => setRainDelaySettings(prev => ({ ...prev, weatherApiKey: e.target.value }))}
                      placeholder="Enter your OpenWeatherMap API key"
                      data-testid="input-weather-api-key"
                    />
                    <p className="text-xs text-muted-foreground">
                      Get a free API key at{' '}
                      <a 
                        href="https://openweathermap.org/api" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        openweathermap.org
                      </a>
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="zip-code">ZIP Code</Label>
                    <Input
                      id="zip-code"
                      value={rainDelaySettings.zipCode}
                      onChange={(e) => setRainDelaySettings(prev => ({ ...prev, zipCode: e.target.value }))}
                      placeholder="12345"
                      data-testid="input-zip-code"
                    />
                  </div>

                  <div>
                    <Label htmlFor="rain-threshold">Rain Probability Threshold (%)</Label>
                    <Input
                      id="rain-threshold"
                      type="number"
                      min="0"
                      max="100"
                      value={rainDelaySettings.threshold}
                      onChange={(e) => setRainDelaySettings(prev => ({ ...prev, threshold: Number(e.target.value) }))}
                      data-testid="input-rain-threshold"
                    />
                    <p className="text-xs text-muted-foreground">
                      Skip watering when rain probability exceeds this percentage
                    </p>
                  </div>
                </div>

                {/* Forecast Options */}
                <div className="space-y-3">
                  <Label className="text-base font-medium">Check Rain Forecast</Label>
                  
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="check-current"
                      checked={rainDelaySettings.checkCurrent}
                      onCheckedChange={(checked) => setRainDelaySettings(prev => ({ ...prev, checkCurrent: checked }))}
                      data-testid="switch-check-current"
                    />
                    <Label htmlFor="check-current">Current Conditions</Label>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="check-12hour"
                      checked={rainDelaySettings.check12Hour}
                      onCheckedChange={(checked) => setRainDelaySettings(prev => ({ ...prev, check12Hour: checked }))}
                      data-testid="switch-check-12hour"
                    />
                    <Label htmlFor="check-12hour">Next 12 Hours</Label>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="check-24hour"
                      checked={rainDelaySettings.check24Hour}
                      onCheckedChange={(checked) => setRainDelaySettings(prev => ({ ...prev, check24Hour: checked }))}
                      data-testid="switch-check-24hour"
                    />
                    <Label htmlFor="check-24hour">Next 24 Hours</Label>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex space-x-3">
                  <Button
                    onClick={() => handleUpdateRainDelaySettings(rainDelaySettings)}
                    disabled={updateRainDelaySettingsMutation.isPending}
                    data-testid="button-save-rain-settings"
                  >
                    {updateRainDelaySettingsMutation.isPending ? (
                      <>
                        <Loader className="w-4 h-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4 mr-2" />
                        Save Settings
                      </>
                    )}
                  </Button>

                  <Button
                    variant="outline"
                    onClick={handleCheckWeather}
                    disabled={checkWeatherMutation.isPending || !rainDelaySettings.weatherApiKey || !rainDelaySettings.zipCode}
                    data-testid="button-check-weather"
                  >
                    {checkWeatherMutation.isPending ? (
                      <>
                        <Loader className="w-4 h-4 mr-2 animate-spin" />
                        Checking...
                      </>
                    ) : (
                      <>
                        <Cloud className="w-4 h-4 mr-2" />
                        Check Weather
                      </>
                    )}
                  </Button>
                </div>

                {/* Weather Display */}
                {weatherData && (
                  <Card className="mt-4">
                    <CardHeader>
                      <CardTitle className="text-lg">Current Weather</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="text-center">
                          <p className="text-sm text-muted-foreground">Temperature</p>
                          <p className="text-lg font-semibold" data-testid="text-temperature">
                            {(weatherData as any)?.current?.temperature}°F
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-sm text-muted-foreground">Current Rain</p>
                          <p className="text-lg font-semibold" data-testid="text-current-rain">
                            {(weatherData as any)?.current?.rainPercent}%
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-sm text-muted-foreground">12hr Forecast</p>
                          <p className="text-lg font-semibold" data-testid="text-12hr-rain">
                            {(weatherData as any)?.forecast?.rain12HourPercent}%
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-sm text-muted-foreground">24hr Forecast</p>
                          <p className="text-lg font-semibold" data-testid="text-24hr-rain">
                            {(weatherData as any)?.forecast?.rain24HourPercent}%
                          </p>
                        </div>
                      </div>
                      {(weatherData as any)?.rainDelayActivated && (
                        <div className="mt-4 p-3 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                          <p className="text-sm text-blue-800 dark:text-blue-200 flex items-center">
                            <CloudRain className="w-4 h-4 mr-2" />
                            Rain delay has been automatically activated due to weather conditions.
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Edit Zone Dialog */}
      <Dialog open={!!editingZone} onOpenChange={(open) => !open && setEditingZone(null)}>
        <DialogContent data-testid="edit-zone-dialog">
          <DialogHeader>
            <DialogTitle>Edit Zone {editingZone?.zoneNumber}</DialogTitle>
          </DialogHeader>
          
          {editingZone && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="zone-name">Zone Name</Label>
                <Input
                  id="zone-name"
                  value={editingZone.name}
                  onChange={(e) => setEditingZone({...editingZone, name: e.target.value})}
                  placeholder="Enter zone name"
                  data-testid="edit-zone-name"
                />
              </div>
              
              <div>
                <Label htmlFor="default-duration">Default Duration (minutes)</Label>
                <Input
                  id="default-duration"
                  type="number"
                  min="1"
                  max="720"
                  value={editingZone.defaultDuration}
                  onChange={(e) => setEditingZone({...editingZone, defaultDuration: Number(e.target.value)})}
                  data-testid="edit-zone-duration"
                />
              </div>
              
              <div className="flex items-center space-x-2">
                <Switch
                  id="zone-enabled"
                  checked={editingZone.isEnabled}
                  onCheckedChange={(checked) => setEditingZone({...editingZone, isEnabled: checked})}
                  data-testid="edit-zone-enabled"
                />
                <Label htmlFor="zone-enabled">Zone Enabled</Label>
              </div>

              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground">
                  <strong>GPIO Pin:</strong> {editingZone.gpioPin}<br />
                  <strong>Zone Number:</strong> {editingZone.zoneNumber}
                </p>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingZone(null)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSaveEdit}
              disabled={updateZoneMutation.isPending}
              data-testid="save-zone-changes"
            >
              {updateZoneMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface ZoneGridProps {
  zones: ZoneWithStatus[];
  onEdit: (zone: ZoneWithStatus) => void;
  onTest: (zoneNumber: number) => void;
  onStop: (zoneNumber: number) => void;
  onToggleEnabled: (zone: ZoneWithStatus) => void;
  testDuration: number;
  isLoading: boolean;
}

function ZoneGrid({ zones, onEdit, onTest, onStop, onToggleEnabled, testDuration, isLoading }: ZoneGridProps) {
  if (zones.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <Droplets className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">No zones found</h3>
          <p className="text-muted-foreground">No zones match the current filter</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {zones.map((zone: ZoneWithStatus) => (
        <Card key={zone.id} className={`${zone.isRunning ? 'ring-2 ring-green-500' : ''}`} data-testid={`zone-card-${zone.zoneNumber}`}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">{zone.name}</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Zone {zone.zoneNumber} • GPIO {zone.gpioPin}
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <Badge variant={zone.isEnabled ? "default" : "secondary"}>
                  {zone.isEnabled ? "Enabled" : "Disabled"}
                </Badge>
                {zone.isRunning && (
                  <Badge variant="destructive">
                    <Activity className="w-3 h-3 mr-1" />
                    Active
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="space-y-4">
            {zone.isRunning && (
              <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-green-700 dark:text-green-300">
                    Running: {zone.minutesLeft} min left
                  </span>
                  <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                </div>
                <p className="text-xs text-green-600 dark:text-green-400 mt-1 capitalize">
                  Source: {zone.currentRunSource || 'Manual'}
                </p>
              </div>
            )}
            
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Default Duration:</span>
              <span className="font-medium">{zone.defaultDuration} min</span>
            </div>
            
            <div className="flex items-center space-x-2">
              <Switch
                checked={zone.isEnabled}
                onCheckedChange={() => onToggleEnabled(zone)}
                data-testid={`toggle-zone-${zone.zoneNumber}`}
              />
              <Label className="text-sm">Zone Enabled</Label>
            </div>
            
            <div className="flex space-x-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => onEdit(zone)}
                className="flex-1"
                data-testid={`edit-zone-${zone.zoneNumber}`}
              >
                <Edit className="w-4 h-4 mr-1" />
                Edit
              </Button>
              
              {zone.isRunning ? (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => onStop(zone.zoneNumber)}
                  disabled={isLoading}
                  data-testid={`stop-zone-${zone.zoneNumber}`}
                >
                  <Square className="w-4 h-4 mr-1" />
                  Stop
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={() => onTest(zone.zoneNumber)}
                  disabled={!zone.isEnabled || isLoading}
                  data-testid={`test-zone-${zone.zoneNumber}`}
                >
                  <Play className="w-4 h-4 mr-1" />
                  Test
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}