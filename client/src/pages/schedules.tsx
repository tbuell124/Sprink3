import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Header from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { 
  Calendar, 
  Plus, 
  Clock, 
  Play, 
  Pause,
  Edit, 
  Trash2,
  Droplets
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function Schedules() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: "",
    startTime: "06:00",
    days: [] as string[],
    isEnabled: true,
    defaultDurationPerZone: 30,
    steps: [] as any[],
  });

  const { data: schedules = [], isLoading: schedulesLoading } = useQuery({
    queryKey: ['/api/schedules'],
    refetchInterval: 30000,
  });

  const { data: zones = [] } = useQuery({
    queryKey: ['/api/zones'],
  });

  // Auto-populate zones when creating a new schedule
  useEffect(() => {
    if (isCreating && !editingSchedule && zones.length > 0 && formData.steps.length === 0) {
      const enabledZones = zones
        .filter((zone: any) => zone.isEnabled)
        .sort((a: any, b: any) => a.zoneNumber - b.zoneNumber);
      
      const autoSteps = enabledZones.map((zone: any, index: number) => ({
        zoneId: zone.id,
        duration: formData.defaultDurationPerZone,
        stepOrder: index,
        zoneName: zone.name,
        zoneNumber: zone.zoneNumber,
      }));
      
      setFormData(prev => ({
        ...prev,
        steps: autoSteps,
      }));
    }
  }, [isCreating, editingSchedule, zones, formData.defaultDurationPerZone, formData.steps.length]);

  // Calculate timing for sequential zones
  const calculateZoneTiming = useMemo(() => {
    const timings = [];
    let currentTime = new Date(`2000-01-01T${formData.startTime}:00`);
    
    formData.steps.forEach((step, index) => {
      const startTime = new Date(currentTime);
      const endTime = new Date(currentTime.getTime() + step.duration * 60000);
      
      timings.push({
        ...step,
        startTime: startTime.toTimeString().slice(0, 5),
        endTime: endTime.toTimeString().slice(0, 5),
        startDate: startTime,
        endDate: endTime,
      });
      
      currentTime = endTime;
    });
    
    return timings;
  }, [formData.startTime, formData.steps]);

  const totalDuration = useMemo(() => {
    return formData.steps.reduce((total, step) => total + step.duration, 0);
  }, [formData.steps]);

  const createScheduleMutation = useMutation({
    mutationFn: async (scheduleData: any) => {
      return apiRequest('POST', '/api/schedules', scheduleData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/schedules'] });
      setIsCreating(false);
      resetForm();
      toast({
        title: "Schedule Created",
        description: "Irrigation schedule created successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.response?.data?.error || "Failed to create schedule",
        variant: "destructive",
      });
    },
  });

  const updateScheduleMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      return apiRequest('PUT', `/api/schedules/${id}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/schedules'] });
      setEditingSchedule(null);
      resetForm();
      toast({
        title: "Schedule Updated",
        description: "Schedule updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.response?.data?.error || "Failed to update schedule",
        variant: "destructive",
      });
    },
  });

  const deleteScheduleMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest('DELETE', `/api/schedules/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/schedules'] });
      toast({
        title: "Schedule Deleted",
        description: "Schedule deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.response?.data?.error || "Failed to delete schedule",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      startTime: "06:00",
      days: [],
      isEnabled: true,
      defaultDurationPerZone: 30,
      steps: [],
    });
  };

  const handleDayToggle = (day: string) => {
    setFormData(prev => ({
      ...prev,
      days: prev.days.includes(day)
        ? prev.days.filter(d => d !== day)
        : [...prev.days, day]
    }));
  };

  const addStep = () => {
    setFormData(prev => ({
      ...prev,
      steps: [...prev.steps, { zoneId: "", duration: 10, stepOrder: prev.steps.length }]
    }));
  };

  const removeStep = (index: number) => {
    setFormData(prev => ({
      ...prev,
      steps: prev.steps.filter((_, i) => i !== index).map((step, i) => ({ ...step, stepOrder: i }))
    }));
  };

  const updateStep = (index: number, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      steps: prev.steps.map((step, i) => 
        i === index ? { ...step, [field]: value } : step
      )
    }));
  };

  const handleSubmit = () => {
    if (!formData.name.trim()) {
      toast({
        title: "Error",
        description: "Schedule name is required",
        variant: "destructive",
      });
      return;
    }

    if (formData.days.length === 0) {
      toast({
        title: "Error", 
        description: "Please select at least one day",
        variant: "destructive",
      });
      return;
    }

    if (editingSchedule) {
      updateScheduleMutation.mutate({ id: editingSchedule.id, updates: formData });
    } else {
      createScheduleMutation.mutate(formData);
    }
  };

  const startEdit = (schedule: any) => {
    setEditingSchedule(schedule);
    setFormData({
      name: schedule.name,
      startTime: schedule.startTime,
      days: schedule.days,
      isEnabled: schedule.isEnabled,
      defaultDurationPerZone: 30,
      steps: schedule.steps || [],
    });
    setIsCreating(true);
  };

  const formatTime = (timeStr: string) => {
    const [hours, minutes] = timeStr.split(':');
    const date = new Date();
    date.setHours(parseInt(hours), parseInt(minutes));
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  const formatDays = (days: string[]) => {
    if (days.length === 7) return "Daily";
    if (days.length === 5 && !days.includes("Sat") && !days.includes("Sun")) return "Weekdays";
    if (days.length === 2 && days.includes("Sat") && days.includes("Sun")) return "Weekends";
    return days.join(", ");
  };

  if (schedulesLoading) {
    return (
      <div className="flex-1 flex flex-col pb-20">
        <div className="p-4 md:p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Schedules</h1>
              <p className="text-muted-foreground">Manage irrigation schedules</p>
            </div>
          </div>
          <div className="animate-pulse space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-card border border-border rounded-lg h-32" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col pb-20">
      <div className="p-4 md:p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Schedules</h1>
            <p className="text-muted-foreground">Manage irrigation schedules</p>
          </div>
          
          <Dialog open={isCreating} onOpenChange={(open) => {
            setIsCreating(open);
            if (!open) {
              setEditingSchedule(null);
              resetForm();
            }
          }}>
            <DialogTrigger asChild>
              <Button 
                size="lg"
                className="h-12 px-6 text-base"
                data-testid="button-add-schedule"
              >
                <Plus className="w-5 h-5 mr-2" />
                Add Schedule
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingSchedule ? "Edit Schedule" : "Create New Schedule"}
                </DialogTitle>
              </DialogHeader>
              
              <div className="space-y-6 py-4">
                {/* Basic Info */}
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="name">Schedule Name</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="e.g., Morning Lawn"
                      className="h-12 text-base"
                      data-testid="input-schedule-name"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="startTime">Start Time</Label>
                    <Input
                      id="startTime"
                      type="time"
                      value={formData.startTime}
                      onChange={(e) => setFormData(prev => ({ ...prev, startTime: e.target.value }))}
                      className="h-12 text-base"
                      data-testid="input-start-time"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="defaultDuration">Duration per Zone (minutes)</Label>
                    <Input
                      id="defaultDuration"
                      type="number"
                      value={formData.defaultDurationPerZone}
                      onChange={(e) => {
                        const newDuration = parseInt(e.target.value) || 30;
                        setFormData(prev => ({
                          ...prev,
                          defaultDurationPerZone: newDuration,
                          steps: prev.steps.map(step => ({ ...step, duration: newDuration }))
                        }));
                      }}
                      min="1"
                      max="180"
                      placeholder="30"
                      className="h-12 text-base"
                      data-testid="input-duration-per-zone"
                    />
                  </div>
                </div>

                {/* Days Selection */}
                <div>
                  <Label className="text-sm font-medium mb-3 block">Days</Label>
                  <div className="grid grid-cols-4 gap-2">
                    {DAYS.map((day) => (
                      <Button
                        key={day}
                        type="button"
                        variant={formData.days.includes(day) ? "default" : "outline"}
                        size="sm"
                        className="h-10"
                        onClick={() => handleDayToggle(day)}
                        data-testid={`button-day-${day.toLowerCase()}`}
                      >
                        {day}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Schedule Preview */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <Label>Schedule Preview</Label>
                    {totalDuration > 0 && (
                      <Badge variant="outline" className="text-sm">
                        Total: {totalDuration} min
                      </Badge>
                    )}
                  </div>
                  
                  {formData.steps.length === 0 ? (
                    <div className="text-center py-8 border border-dashed border-border rounded-lg">
                      <Droplets className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                      <p className="text-muted-foreground mb-2">
                        All enabled zones will be automatically added
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Zones run sequentially with no overlap
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {/* Timeline header */}
                      <div className="flex items-center justify-between text-xs text-muted-foreground px-2">
                        <span>Zone Sequence</span>
                        <span>Start → End</span>
                      </div>
                      
                      {/* Horizontal timeline */}
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {calculateZoneTiming.map((timing, index) => (
                          <div 
                            key={timing.zoneId} 
                            className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border"
                            data-testid={`timeline-zone-${index}`}
                          >
                            {/* Zone info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge variant="secondary" className="text-xs px-2 py-0.5">
                                  {index + 1}
                                </Badge>
                                <span className="font-medium text-sm truncate">
                                  Zone {timing.zoneNumber}: {timing.zoneName}
                                </span>
                              </div>
                              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Play className="w-3 h-3" />
                                  {timing.startTime}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Pause className="w-3 h-3" />
                                  {timing.endTime}
                                </span>
                              </div>
                            </div>
                            
                            {/* Duration input */}
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                value={timing.duration}
                                onChange={(e) => updateStep(index, 'duration', parseInt(e.target.value) || 1)}
                                min="1"
                                max="180"
                                className="w-16 h-8 text-center text-xs"
                                data-testid={`input-duration-${index}`}
                              />
                              <span className="text-xs text-muted-foreground">min</span>
                            </div>
                          </div>
                        ))}
                      </div>
                      
                      {/* Summary */}
                      {calculateZoneTiming.length > 0 && (
                        <div className="mt-4 p-3 bg-primary/10 border border-primary/20 rounded-lg">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium">Schedule Summary</span>
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              <span>{calculateZoneTiming.length} zones</span>
                              <span>{totalDuration} minutes total</span>
                              <span>
                                Ends at {calculateZoneTiming[calculateZoneTiming.length - 1]?.endTime}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Enable/Disable */}
                <div className="flex items-center justify-between">
                  <Label htmlFor="enabled">Enable Schedule</Label>
                  <Switch
                    id="enabled"
                    checked={formData.isEnabled}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isEnabled: checked }))}
                    data-testid="switch-enabled"
                  />
                </div>
              </div>

              <DialogFooter className="gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsCreating(false);
                    setEditingSchedule(null);
                    resetForm();
                  }}
                  className="h-12 flex-1"
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={createScheduleMutation.isPending || updateScheduleMutation.isPending}
                  className="h-12 flex-1"
                  data-testid="button-save"
                >
                  {createScheduleMutation.isPending || updateScheduleMutation.isPending ? "Saving..." : "Save"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Schedules List */}
        <div className="space-y-4">
          {schedules.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Calendar className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">No schedules created</h3>
                <p className="text-muted-foreground mb-6">Create your first irrigation schedule to automate watering</p>
                <Button onClick={() => setIsCreating(true)} data-testid="button-create-first">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Schedule
                </Button>
              </CardContent>
            </Card>
          ) : (
            schedules.map((schedule: any) => (
              <Card key={schedule.id} data-testid={`schedule-card-${schedule.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-foreground">{schedule.name}</h3>
                        <Badge variant={schedule.isEnabled ? "default" : "secondary"}>
                          {schedule.isEnabled ? "Enabled" : "Disabled"}
                        </Badge>
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {formatTime(schedule.startTime)}
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {formatDays(schedule.days)}
                        </div>
                        {schedule.totalDuration && (
                          <div className="flex items-center gap-1">
                            <Droplets className="w-4 h-4" />
                            {schedule.totalDuration} min
                          </div>
                        )}
                      </div>
                      
                      {schedule.steps && schedule.steps.length > 0 && (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium text-foreground">Zone Timeline</p>
                            <Badge variant="outline" className="text-xs">
                              {schedule.steps.reduce((total: number, step: any) => total + step.duration, 0)} min total
                            </Badge>
                          </div>
                          
                          {/* Compact horizontal timeline */}
                          <div className="space-y-2">
                            {(() => {
                              // Calculate timing for each step
                              let currentTime = new Date(`2000-01-01T${schedule.startTime}:00`);
                              return schedule.steps.map((step: any, index: number) => {
                                const startTime = new Date(currentTime);
                                const endTime = new Date(currentTime.getTime() + step.duration * 60000);
                                const startTimeStr = startTime.toTimeString().slice(0, 5);
                                const endTimeStr = endTime.toTimeString().slice(0, 5);
                                currentTime = endTime;
                                
                                return (
                                  <div 
                                    key={step.id || index} 
                                    className="flex items-center gap-3 p-2 bg-muted/30 rounded-lg border border-muted"
                                    data-testid={`schedule-zone-${index}`}
                                  >
                                    {/* Zone sequence number */}
                                    <Badge variant="secondary" className="text-xs px-2 py-0.5 min-w-[24px] text-center">
                                      {index + 1}
                                    </Badge>
                                    
                                    {/* Zone info */}
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 mb-1">
                                        <span className="font-medium text-sm truncate">
                                          Zone {step.zoneNumber || (index + 1)}: {step.zoneName || step.name || `Zone ${index + 1}`}
                                        </span>
                                      </div>
                                    </div>
                                    
                                    {/* Timing info */}
                                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                      <div className="flex items-center gap-1">
                                        <Play className="w-3 h-3" />
                                        <span className="font-mono">{startTimeStr}</span>
                                      </div>
                                      <span>→</span>
                                      <div className="flex items-center gap-1">
                                        <Pause className="w-3 h-3" />
                                        <span className="font-mono">{endTimeStr}</span>
                                      </div>
                                      <div className="flex items-center gap-1 ml-2">
                                        <Clock className="w-3 h-3" />
                                        <span>{step.duration}m</span>
                                      </div>
                                    </div>
                                  </div>
                                );
                              });
                            })()}
                          </div>
                          
                          {/* Schedule summary */}
                          <div className="flex items-center justify-between pt-2 border-t border-muted">
                            <span className="text-xs text-muted-foreground">
                              {schedule.steps.length} zones • Sequential operation
                            </span>
                            <span className="text-xs text-muted-foreground">
                              Ends at {(() => {
                                const totalDuration = schedule.steps.reduce((total: number, step: any) => total + step.duration, 0);
                                const endTime = new Date(`2000-01-01T${schedule.startTime}:00`);
                                endTime.setMinutes(endTime.getMinutes() + totalDuration);
                                return endTime.toTimeString().slice(0, 5);
                              })()}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2 ml-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => startEdit(schedule)}
                        className="h-10 w-10 p-0"
                        data-testid={`button-edit-${schedule.id}`}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteScheduleMutation.mutate(schedule.id)}
                        className="h-10 w-10 p-0 text-destructive"
                        data-testid={`button-delete-${schedule.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}