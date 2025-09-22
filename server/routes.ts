import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  loginSchema, 
  zoneControlSchema, 
  rainDelaySchema,
  scheduleUpdateSchema,
  insertScheduleSchema,
  insertZoneSchema,
  rainDelaySettingsUpdateSchema
} from "@shared/schema";
import { z } from "zod";

// Development authentication middleware (allows demo mode)
const requireAuth = async (req: Request, res: Response, next: any) => {
  let userId = req.headers['x-user-id'] as string;
  
  // Development/demo mode: If no user ID provided, use the default admin user
  if (!userId) {
    try {
      const adminUser = await storage.getUserByUsername('admin');
      if (adminUser) {
        userId = adminUser.id;
      } else {
        // If no admin user exists, create one
        const newAdmin = await storage.createUser({
          username: "admin",
          email: "admin@sprinkler.com",
          password: "admin123", 
          firstName: "Demo",
          lastName: "User",
          role: "admin",
        });
        userId = newAdmin.id;
      }
    } catch (error) {
      console.error("Failed to get/create demo user:", error);
      return res.status(500).json({ error: 'Server error during authentication' });
    }
  }
  
  req.userId = userId;
  next();
};

declare global {
  namespace Express {
    interface Request {
      userId: string;
    }
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth routes
  app.post("/api/login", async (req: Request, res: Response) => {
    try {
      const { username, password } = loginSchema.parse(req.body);
      const user = await storage.getUserByUsername(username);
      
      if (!user || user.password !== password) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      // In production, use proper JWT tokens
      res.json({ 
        user: { 
          id: user.id, 
          username: user.username, 
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role 
        },
        token: user.id // Simplified token for demo
      });
    } catch (error) {
      res.status(400).json({ error: "Invalid request data" });
    }
  });

  // User routes
  app.get("/api/users/me", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = await storage.getUser(req.userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json({ 
        id: user.id, 
        username: user.username, 
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role 
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch user" });
    }
  });

  // System Status - Main endpoint for dashboard information
  app.get("/api/status", requireAuth, async (req: Request, res: Response) => {
    try {
      const zones = await storage.getAllZones();
      const activeRuns = await storage.getActiveZoneRuns();
      const systemStatus = await storage.getSystemStatus();
      const schedules = await storage.getActiveSchedules();

      // Format zones with current run information
      const formattedZones = await Promise.all(zones.map(async (zone) => {
        const currentRun = activeRuns.find(run => run.zoneId === zone.id);
        return {
          ...zone,
          isRunning: zone.isActive,
          minutesLeft: currentRun ? Math.max(0, 
            Math.ceil((new Date(currentRun.endsAt).getTime() - Date.now()) / (1000 * 60))
          ) : 0,
          currentRunSource: currentRun?.source || null,
        };
      }));

      // Get upcoming schedules (next 24 hours)
      const now = new Date();
      const upcomingSchedules = schedules
        .filter(schedule => schedule.isEnabled)
        .map(schedule => {
          // Simple next run calculation (can be enhanced)
          const [hours, minutes] = schedule.startTime.split(':').map(Number);
          const nextRun = new Date(now);
          nextRun.setHours(hours, minutes, 0, 0);
          if (nextRun <= now) {
            nextRun.setDate(nextRun.getDate() + 1);
          }
          
          return {
            ...schedule,
            nextRun: nextRun.toISOString(),
          };
        })
        .sort((a, b) => new Date(a.nextRun).getTime() - new Date(b.nextRun).getTime())
        .slice(0, 5);

      res.json({
        version: "1.0.0",
        lastUpdated: systemStatus.lastUpdated.toISOString(),
        connectivity: systemStatus.connectivity,
        zones: formattedZones,
        activeRuns: activeRuns.length,
        upcomingSchedules,
        rainDelay: {
          active: systemStatus.rainDelayActive,
          endsAt: systemStatus.rainDelayEndsAt?.toISOString() || null,
        },
        piBackend: {
          url: systemStatus.piBackendUrl,
          connected: systemStatus.connectivity === "online",
        }
      });
    } catch (error) {
      console.error("Failed to fetch system status:", error);
      res.status(500).json({ error: "Failed to fetch system status" });
    }
  });

  // Zone Control - Start a zone
  app.post("/zone/on/:zone", requireAuth, async (req: Request, res: Response) => {
    try {
      const zoneNumber = parseInt(req.params.zone);
      const { duration = 30 } = zoneControlSchema.parse(req.body);
      
      const zone = await storage.getZoneByNumber(zoneNumber);
      if (!zone) {
        return res.status(404).json({ error: `Zone ${zoneNumber} not found` });
      }

      if (!zone.isEnabled) {
        return res.status(400).json({ error: `Zone ${zoneNumber} is disabled` });
      }

      // Check for rain delay
      const systemStatus = await storage.getSystemStatus();
      if (systemStatus.rainDelayActive && systemStatus.rainDelayEndsAt && new Date() < systemStatus.rainDelayEndsAt) {
        return res.status(423).json({ error: "Rain delay is active" });
      }

      // Cancel any existing run for this zone
      const existingRuns = await storage.getActiveZoneRuns();
      const existingRun = existingRuns.find(run => run.zoneId === zone.id);
      if (existingRun) {
        await storage.cancelZoneRun(existingRun.id);
      }

      // Create new zone run
      const endsAt = new Date(Date.now() + duration * 60 * 1000);
      const zoneRun = await storage.createZoneRun({
        zoneId: zone.id,
        duration,
        source: "manual",
        scheduleId: null,
        endsAt,
        status: "running",
      });

      // Set automatic completion timer
      setTimeout(async () => {
        try {
          await storage.completeZoneRun(zoneRun.id);
          
          // Create notification
          await storage.createNotification({
            userId: req.userId,
            type: "zone_completed",
            title: "Zone Completed",
            message: `${zone.name} (Zone ${zone.zoneNumber}) has completed its ${duration}-minute run`,
            read: 0,
            relatedZoneId: zone.id,
            relatedScheduleId: null,
          });
        } catch (error) {
          console.error("Failed to complete zone run:", error);
        }
      }, duration * 60 * 1000);

      res.json({
        zone: zoneNumber,
        gpioPin: zone.gpioPin,
        name: zone.name,
        running: true,
        duration,
        minutesLeft: duration,
        runId: zoneRun.id,
      });
    } catch (error) {
      console.error("Failed to start zone:", error);
      res.status(400).json({ error: "Failed to start zone" });
    }
  });

  // Zone Control - Stop a zone
  app.post("/zone/off/:zone", requireAuth, async (req: Request, res: Response) => {
    try {
      const zoneNumber = parseInt(req.params.zone);
      
      const zone = await storage.getZoneByNumber(zoneNumber);
      if (!zone) {
        return res.status(404).json({ error: `Zone ${zoneNumber} not found` });
      }

      // Find and cancel active run
      const activeRuns = await storage.getActiveZoneRuns();
      const activeRun = activeRuns.find(run => run.zoneId === zone.id);
      
      if (activeRun) {
        await storage.cancelZoneRun(activeRun.id);
        
        // Create notification
        await storage.createNotification({
          userId: req.userId,
          type: "zone_completed",
          title: "Zone Stopped",
          message: `${zone.name} (Zone ${zone.zoneNumber}) was manually stopped`,
          read: 0,
          relatedZoneId: zone.id,
          relatedScheduleId: null,
        });
      }

      res.json({
        zone: zoneNumber,
        gpioPin: zone.gpioPin,
        name: zone.name,
        running: false,
        minutesLeft: 0,
      });
    } catch (error) {
      console.error("Failed to stop zone:", error);
      res.status(500).json({ error: "Failed to stop zone" });
    }
  });

  // Zone Management - CRUD operations
  app.get("/api/zones", requireAuth, async (req: Request, res: Response) => {
    try {
      const zones = await storage.getAllZones();
      const activeRuns = await storage.getActiveZoneRuns();

      const zonesWithStatus = zones.map(zone => {
        const activeRun = activeRuns.find(run => run.zoneId === zone.id);
        return {
          ...zone,
          isRunning: zone.isActive,
          minutesLeft: activeRun ? Math.max(0, 
            Math.ceil((new Date(activeRun.endsAt).getTime() - Date.now()) / (1000 * 60))
          ) : 0,
          currentRunSource: activeRun?.source || null,
        };
      });

      res.json(zonesWithStatus);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch zones" });
    }
  });

  app.get("/api/zones/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const zone = await storage.getZone(req.params.id);
      if (!zone) {
        return res.status(404).json({ error: "Zone not found" });
      }
      res.json(zone);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch zone" });
    }
  });

  app.put("/api/zones/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const updates = z.object({
        name: z.string().optional(),
        isEnabled: z.boolean().optional(),
        defaultDuration: z.number().min(1).max(12 * 60).optional(),
      }).parse(req.body);

      const zone = await storage.updateZone(req.params.id, updates);
      if (!zone) {
        return res.status(404).json({ error: "Zone not found" });
      }
      res.json(zone);
    } catch (error) {
      res.status(400).json({ error: "Failed to update zone" });
    }
  });

  // Schedule Management - CRUD operations
  app.get("/api/schedules", requireAuth, async (req: Request, res: Response) => {
    try {
      const schedules = await storage.getAllSchedules();
      const schedulesWithSteps = await Promise.all(
        schedules.map(async (schedule) => {
          const steps = await storage.getScheduleSteps(schedule.id);
          const stepsWithZones = await Promise.all(
            steps.map(async (step) => {
              const zone = await storage.getZone(step.zoneId);
              return {
                ...step,
                zoneName: zone?.name || `Zone ${zone?.zoneNumber}`,
                zoneNumber: zone?.zoneNumber,
              };
            })
          );
          return {
            ...schedule,
            steps: stepsWithZones,
            totalDuration: steps.reduce((sum, step) => sum + step.duration, 0),
          };
        })
      );
      res.json(schedulesWithSteps);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch schedules" });
    }
  });

  app.get("/api/schedules/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const schedule = await storage.getSchedule(req.params.id);
      if (!schedule) {
        return res.status(404).json({ error: "Schedule not found" });
      }
      
      const steps = await storage.getScheduleSteps(schedule.id);
      res.json({ ...schedule, steps });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch schedule" });
    }
  });

  app.post("/api/schedules", requireAuth, async (req: Request, res: Response) => {
    try {
      const { steps, ...scheduleData } = scheduleUpdateSchema.parse(req.body);
      
      const schedule = await storage.createSchedule({
        name: scheduleData.name || "New Schedule",
        startTime: scheduleData.startTime || "06:00",
        days: scheduleData.days || ["Mon", "Wed", "Fri"],
        isEnabled: scheduleData.isEnabled ?? true,
      });

      // Create schedule steps if provided
      if (steps && steps.length > 0) {
        for (const stepData of steps) {
          await storage.createScheduleStep({
            scheduleId: schedule.id,
            zoneId: stepData.zoneId,
            stepOrder: stepData.stepOrder,
            duration: stepData.duration,
          });
        }
      }

      res.status(201).json(schedule);
    } catch (error) {
      console.error("Failed to create schedule:", error);
      res.status(400).json({ error: "Failed to create schedule" });
    }
  });

  app.put("/api/schedules/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const { steps, ...scheduleData } = scheduleUpdateSchema.parse(req.body);
      
      const schedule = await storage.updateSchedule(req.params.id, scheduleData);
      if (!schedule) {
        return res.status(404).json({ error: "Schedule not found" });
      }

      // Update schedule steps if provided
      if (steps) {
        // Delete existing steps and create new ones
        await storage.deleteScheduleSteps(schedule.id);
        for (const stepData of steps) {
          await storage.createScheduleStep({
            scheduleId: schedule.id,
            zoneId: stepData.zoneId,
            stepOrder: stepData.stepOrder,
            duration: stepData.duration,
          });
        }
      }

      res.json(schedule);
    } catch (error) {
      res.status(400).json({ error: "Failed to update schedule" });
    }
  });

  app.delete("/api/schedules/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const success = await storage.deleteSchedule(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Schedule not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete schedule" });
    }
  });

  // Rain Delay Control
  app.post("/api/rain-delay", requireAuth, async (req: Request, res: Response) => {
    try {
      const { active, hours = 24 } = rainDelaySchema.parse(req.body);
      
      const endsAt = active ? new Date(Date.now() + hours * 60 * 60 * 1000) : null;
      
      const systemStatus = await storage.updateSystemStatus({
        rainDelayActive: active,
        rainDelayEndsAt: endsAt,
      });

      if (active) {
        // Cancel all active zone runs when rain delay is activated
        const activeRuns = await storage.getActiveZoneRuns();
        for (const run of activeRuns) {
          await storage.cancelZoneRun(run.id);
        }

        // Create notification
        await storage.createNotification({
          userId: req.userId,
          type: "rain_delay_activated",
          title: "Rain Delay Activated",
          message: `Rain delay activated for ${hours} hours. All zones stopped.`,
          read: 0,
          relatedZoneId: null,
          relatedScheduleId: null,
        });
      }

      res.json({
        active: systemStatus.rainDelayActive,
        endsAt: systemStatus.rainDelayEndsAt?.toISOString() || null,
        hoursRemaining: active && systemStatus.rainDelayEndsAt ? 
          Math.max(0, Math.ceil((systemStatus.rainDelayEndsAt.getTime() - Date.now()) / (1000 * 60 * 60))) : 0
      });
    } catch (error) {
      res.status(400).json({ error: "Failed to update rain delay" });
    }
  });

  app.get("/api/rain-delay", requireAuth, async (req: Request, res: Response) => {
    try {
      const systemStatus = await storage.getSystemStatus();
      res.json({
        active: systemStatus.rainDelayActive,
        endsAt: systemStatus.rainDelayEndsAt?.toISOString() || null,
        hoursRemaining: systemStatus.rainDelayActive && systemStatus.rainDelayEndsAt ? 
          Math.max(0, Math.ceil((systemStatus.rainDelayEndsAt.getTime() - Date.now()) / (1000 * 60 * 60))) : 0
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch rain delay status" });
    }
  });

  // Rain Delay Settings
  app.get("/api/rain-delay-settings", requireAuth, async (req: Request, res: Response) => {
    try {
      const settings = await storage.getRainDelaySettings();
      res.json(settings);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch rain delay settings" });
    }
  });

  app.put("/api/rain-delay-settings", requireAuth, async (req: Request, res: Response) => {
    try {
      const updates = rainDelaySettingsUpdateSchema.parse(req.body);
      const settings = await storage.updateRainDelaySettings(updates);
      res.json(settings);
    } catch (error) {
      console.error("Failed to update rain delay settings:", error);
      res.status(400).json({ error: "Failed to update rain delay settings" });
    }
  });

  // Weather API Integration
  app.get("/api/weather", requireAuth, async (req: Request, res: Response) => {
    try {
      const settings = await storage.getRainDelaySettings();
      
      if (!settings.weatherApiKey || !settings.zipCode) {
        return res.status(400).json({ 
          error: "Weather API key and ZIP code must be configured" 
        });
      }

      // OpenWeatherMap API endpoints
      const currentWeatherUrl = `https://api.openweathermap.org/data/2.5/weather?zip=${settings.zipCode}&appid=${settings.weatherApiKey}&units=imperial`;
      const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?zip=${settings.zipCode}&appid=${settings.weatherApiKey}&units=imperial`;

      // Fetch current weather and forecast
      const [currentResponse, forecastResponse] = await Promise.all([
        fetch(currentWeatherUrl),
        fetch(forecastUrl)
      ]);

      if (!currentResponse.ok || !forecastResponse.ok) {
        throw new Error("Failed to fetch weather data");
      }

      const currentData = await currentResponse.json();
      const forecastData = await forecastResponse.json();

      // Extract precipitation probabilities
      const currentRainPercent = Math.round((currentData.rain?.['1h'] || 0) * 100 / 5); // Approximate conversion
      
      // Get next 12 and 24 hour forecasts
      const now = Date.now();
      const next12Hours = forecastData.list.filter((item: any) => {
        const itemTime = new Date(item.dt * 1000).getTime();
        return itemTime <= now + (12 * 60 * 60 * 1000);
      });
      const next24Hours = forecastData.list.filter((item: any) => {
        const itemTime = new Date(item.dt * 1000).getTime();
        return itemTime <= now + (24 * 60 * 60 * 1000);
      });

      const rain12HourPercent = Math.max(...next12Hours.map((item: any) => Math.round((item.pop || 0) * 100)));
      const rain24HourPercent = Math.max(...next24Hours.map((item: any) => Math.round((item.pop || 0) * 100)));

      // Update settings with latest weather data
      await storage.updateRainDelaySettings({
        lastWeatherCheck: new Date(),
        currentRainPercent,
        rain12HourPercent,
        rain24HourPercent,
      });

      // Check if rain delay should be activated
      const shouldActivate = settings.enabled && (
        (settings.checkCurrent && currentRainPercent >= settings.threshold) ||
        (settings.check12Hour && rain12HourPercent >= settings.threshold) ||
        (settings.check24Hour && rain24HourPercent >= settings.threshold)
      );

      // Auto-activate rain delay if conditions are met
      if (shouldActivate) {
        const systemStatus = await storage.getSystemStatus();
        if (!systemStatus.rainDelayActive) {
          await storage.updateSystemStatus({
            rainDelayActive: true,
            rainDelayEndsAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
          });

          // Cancel active zones
          const activeRuns = await storage.getActiveZoneRuns();
          for (const run of activeRuns) {
            await storage.cancelZoneRun(run.id);
          }

          // Create notification
          await storage.createNotification({
            userId: req.userId,
            type: "rain_delay_activated",
            title: "Automatic Rain Delay Activated",
            message: `Rain delay automatically activated due to ${Math.max(currentRainPercent, rain12HourPercent, rain24HourPercent)}% rain probability.`,
            read: 0,
            relatedZoneId: null,
            relatedScheduleId: null,
          });
        }
      }

      res.json({
        current: {
          temperature: Math.round(currentData.main.temp),
          description: currentData.weather[0].description,
          rainPercent: currentRainPercent,
        },
        forecast: {
          rain12HourPercent,
          rain24HourPercent,
        },
        rainDelayActivated: shouldActivate,
        lastUpdated: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Weather API error:", error);
      res.status(500).json({ error: "Failed to fetch weather data" });
    }
  });

  // Zone Run History
  app.get("/api/zone-runs", requireAuth, async (req: Request, res: Response) => {
    try {
      const { zoneId, limit = 50 } = req.query;
      let runs;
      
      if (zoneId) {
        runs = await storage.getZoneRunsByZone(zoneId as string);
      } else {
        runs = await storage.getActiveZoneRuns();
        // Add completed runs (you'd need to implement getRecentZoneRuns)
      }
      
      const runsWithZoneInfo = await Promise.all(
        runs.slice(0, Number(limit)).map(async (run) => {
          const zone = await storage.getZone(run.zoneId);
          return {
            ...run,
            zoneName: zone?.name || `Zone ${zone?.zoneNumber}`,
            zoneNumber: zone?.zoneNumber,
          };
        })
      );
      
      res.json(runsWithZoneInfo);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch zone runs" });
    }
  });

  // Analytics routes
  app.get("/api/analytics", requireAuth, async (req: Request, res: Response) => {
    try {
      const { startDate, endDate } = req.query;
      const analytics = await storage.getZoneAnalytics(
        startDate ? new Date(startDate as string) : undefined,
        endDate ? new Date(endDate as string) : undefined
      );
      res.json(analytics);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch analytics" });
    }
  });

  // Notification routes
  app.get("/api/notifications", requireAuth, async (req: Request, res: Response) => {
    try {
      const notifications = await storage.getNotificationsByUser(req.userId);
      res.json(notifications);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch notifications" });
    }
  });

  app.put("/api/notifications/:id/read", requireAuth, async (req: Request, res: Response) => {
    try {
      const success = await storage.markNotificationAsRead(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Notification not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to mark notification as read" });
    }
  });

  // System Settings
  app.get("/api/system-settings", requireAuth, async (req: Request, res: Response) => {
    try {
      const systemStatus = await storage.getSystemStatus();
      res.json({
        piBackendUrl: systemStatus.piBackendUrl,
        connectivity: systemStatus.connectivity,
        lastUpdated: systemStatus.lastUpdated.toISOString(),
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch system settings" });
    }
  });

  app.put("/api/system-settings", requireAuth, async (req: Request, res: Response) => {
    try {
      const { piBackendUrl, piBackendToken } = z.object({
        piBackendUrl: z.string().url().optional(),
        piBackendToken: z.string().optional(),
      }).parse(req.body);

      const systemStatus = await storage.updateSystemStatus({
        piBackendUrl,
        piBackendToken,
        connectivity: "online", // Assume online when settings are updated
      });

      res.json({
        piBackendUrl: systemStatus.piBackendUrl,
        connectivity: systemStatus.connectivity,
        lastUpdated: systemStatus.lastUpdated.toISOString(),
      });
    } catch (error) {
      res.status(400).json({ error: "Failed to update system settings" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}