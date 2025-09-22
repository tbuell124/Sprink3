import { 
  type User, 
  type InsertUser, 
  type Zone,
  type InsertZone,
  type Schedule,
  type InsertSchedule,
  type ScheduleStep,
  type InsertScheduleStep,
  type ZoneRun,
  type InsertZoneRun,
  type SystemStatus,
  type InsertSystemStatus,
  type Notification,
  type InsertNotification,
  DEFAULT_GPIO_PINS
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getUsersByRole(role: string): Promise<User[]>;

  // Zones
  getZone(id: string): Promise<Zone | undefined>;
  getZoneByNumber(zoneNumber: number): Promise<Zone | undefined>;
  getZoneByGpioPin(gpioPin: number): Promise<Zone | undefined>;
  getAllZones(): Promise<Zone[]>;
  getActiveZones(): Promise<Zone[]>;
  getEnabledZones(): Promise<Zone[]>;
  createZone(zone: InsertZone): Promise<Zone>;
  updateZone(id: string, updates: Partial<Zone>): Promise<Zone | undefined>;
  deleteZone(id: string): Promise<boolean>;

  // Schedules
  getSchedule(id: string): Promise<Schedule | undefined>;
  getAllSchedules(): Promise<Schedule[]>;
  getActiveSchedules(): Promise<Schedule[]>;
  createSchedule(schedule: InsertSchedule): Promise<Schedule>;
  updateSchedule(id: string, updates: Partial<Schedule>): Promise<Schedule | undefined>;
  deleteSchedule(id: string): Promise<boolean>;

  // Schedule Steps
  getScheduleStep(id: string): Promise<ScheduleStep | undefined>;
  getScheduleSteps(scheduleId: string): Promise<ScheduleStep[]>;
  createScheduleStep(step: InsertScheduleStep): Promise<ScheduleStep>;
  updateScheduleStep(id: string, updates: Partial<ScheduleStep>): Promise<ScheduleStep | undefined>;
  deleteScheduleStep(id: string): Promise<boolean>;
  deleteScheduleSteps(scheduleId: string): Promise<boolean>;

  // Zone Runs
  getZoneRun(id: string): Promise<ZoneRun | undefined>;
  getActiveZoneRuns(): Promise<ZoneRun[]>;
  getZoneRunsByZone(zoneId: string): Promise<ZoneRun[]>;
  getZoneRunsBySchedule(scheduleId: string): Promise<ZoneRun[]>;
  createZoneRun(zoneRun: InsertZoneRun): Promise<ZoneRun>;
  updateZoneRun(id: string, updates: Partial<ZoneRun>): Promise<ZoneRun | undefined>;
  completeZoneRun(id: string): Promise<ZoneRun | undefined>;
  cancelZoneRun(id: string): Promise<ZoneRun | undefined>;

  // System Status
  getSystemStatus(): Promise<SystemStatus>;
  updateSystemStatus(updates: Partial<SystemStatus>): Promise<SystemStatus>;

  // Notifications
  getNotification(id: string): Promise<Notification | undefined>;
  getNotificationsByUser(userId: string): Promise<Notification[]>;
  getUnreadNotificationsByUser(userId: string): Promise<Notification[]>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  markNotificationAsRead(id: string): Promise<boolean>;

  // Analytics
  getZoneAnalytics(startDate?: Date, endDate?: Date): Promise<{
    totalRuns: number;
    totalDuration: number;
    byZone: { zoneName: string; runs: number; duration: number }[];
    bySource: { source: string; runs: number; duration: number }[];
  }>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private zones: Map<string, Zone>;
  private schedules: Map<string, Schedule>;
  private scheduleSteps: Map<string, ScheduleStep>;
  private zoneRuns: Map<string, ZoneRun>;
  private systemStatus: SystemStatus;
  private notifications: Map<string, Notification>;

  constructor() {
    this.users = new Map();
    this.zones = new Map();
    this.schedules = new Map();
    this.scheduleSteps = new Map();
    this.zoneRuns = new Map();
    this.notifications = new Map();
    
    // Initialize system status
    this.systemStatus = {
      id: "system",
      rainDelayActive: false,
      rainDelayEndsAt: null,
      connectivity: "online",
      lastUpdated: new Date(),
      piBackendUrl: null,
      piBackendToken: null,
    };

    // Initialize with sample data
    this.initializeSampleData();
  }

  private async initializeSampleData() {
    // Create admin user
    const admin = await this.createUser({
      username: "admin",
      email: "admin@sprinkler.com",
      password: "admin123",
      firstName: "System",
      lastName: "Administrator",
      role: "admin",
    });

    // Create default zones based on GPIO pins
    const zoneNames = [
      "Front Lawn", "Back Lawn", "Side Garden", "Flower Beds",
      "Vegetable Garden", "Driveway Strip", "Hedge Row", "Patio Plants",
      "Rose Garden", "Oak Tree Area", "Perennials", "Herb Garden",
      "Corner Beds", "Entrance Garden", "Pool Area", "Back Corner"
    ];

    for (let i = 0; i < DEFAULT_GPIO_PINS.length; i++) {
      await this.createZone({
        zoneNumber: i + 1,
        gpioPin: DEFAULT_GPIO_PINS[i],
        name: zoneNames[i] || `Zone ${i + 1}`,
        isEnabled: true,
        defaultDuration: 30,
        isActive: false,
        currentRunId: null,
      });
    }

    // Create sample schedule
    const zones = await this.getAllZones();
    const sampleSchedule = await this.createSchedule({
      name: "Morning Watering",
      startTime: "06:00",
      days: ["Mon", "Wed", "Fri"],
      isEnabled: true,
      lastRun: null,
    });

    // Add schedule steps for first 4 zones
    for (let i = 0; i < Math.min(4, zones.length); i++) {
      await this.createScheduleStep({
        scheduleId: sampleSchedule.id,
        zoneId: zones[i].id,
        stepOrder: i,
        duration: 15,
      });
    }
  }

  // Users
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.username === username);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.email === email);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = {
      ...insertUser,
      id,
      createdAt: new Date(),
    };
    this.users.set(id, user);
    return user;
  }

  async getUsersByRole(role: string): Promise<User[]> {
    return Array.from(this.users.values()).filter(user => user.role === role);
  }

  // Zones
  async getZone(id: string): Promise<Zone | undefined> {
    return this.zones.get(id);
  }

  async getZoneByNumber(zoneNumber: number): Promise<Zone | undefined> {
    return Array.from(this.zones.values()).find(zone => zone.zoneNumber === zoneNumber);
  }

  async getZoneByGpioPin(gpioPin: number): Promise<Zone | undefined> {
    return Array.from(this.zones.values()).find(zone => zone.gpioPin === gpioPin);
  }

  async getAllZones(): Promise<Zone[]> {
    return Array.from(this.zones.values()).sort((a, b) => a.zoneNumber - b.zoneNumber);
  }

  async getActiveZones(): Promise<Zone[]> {
    return Array.from(this.zones.values()).filter(zone => zone.isActive);
  }

  async getEnabledZones(): Promise<Zone[]> {
    return Array.from(this.zones.values())
      .filter(zone => zone.isEnabled)
      .sort((a, b) => a.zoneNumber - b.zoneNumber);
  }

  async createZone(insertZone: InsertZone): Promise<Zone> {
    const id = randomUUID();
    const zone: Zone = {
      ...insertZone,
      id,
      createdAt: new Date(),
    };
    this.zones.set(id, zone);
    return zone;
  }

  async updateZone(id: string, updates: Partial<Zone>): Promise<Zone | undefined> {
    const zone = this.zones.get(id);
    if (!zone) return undefined;

    const updatedZone = { ...zone, ...updates };
    this.zones.set(id, updatedZone);
    return updatedZone;
  }

  async deleteZone(id: string): Promise<boolean> {
    return this.zones.delete(id);
  }

  // Schedules
  async getSchedule(id: string): Promise<Schedule | undefined> {
    return this.schedules.get(id);
  }

  async getAllSchedules(): Promise<Schedule[]> {
    return Array.from(this.schedules.values())
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getActiveSchedules(): Promise<Schedule[]> {
    return Array.from(this.schedules.values()).filter(schedule => schedule.isEnabled);
  }

  async createSchedule(insertSchedule: InsertSchedule): Promise<Schedule> {
    const id = randomUUID();
    const schedule: Schedule = {
      ...insertSchedule,
      id,
      createdAt: new Date(),
    };
    this.schedules.set(id, schedule);
    return schedule;
  }

  async updateSchedule(id: string, updates: Partial<Schedule>): Promise<Schedule | undefined> {
    const schedule = this.schedules.get(id);
    if (!schedule) return undefined;

    const updatedSchedule = { ...schedule, ...updates };
    this.schedules.set(id, updatedSchedule);
    return updatedSchedule;
  }

  async deleteSchedule(id: string): Promise<boolean> {
    // Also delete associated schedule steps
    await this.deleteScheduleSteps(id);
    return this.schedules.delete(id);
  }

  // Schedule Steps
  async getScheduleStep(id: string): Promise<ScheduleStep | undefined> {
    return this.scheduleSteps.get(id);
  }

  async getScheduleSteps(scheduleId: string): Promise<ScheduleStep[]> {
    return Array.from(this.scheduleSteps.values())
      .filter(step => step.scheduleId === scheduleId)
      .sort((a, b) => a.stepOrder - b.stepOrder);
  }

  async createScheduleStep(insertStep: InsertScheduleStep): Promise<ScheduleStep> {
    const id = randomUUID();
    const step: ScheduleStep = {
      ...insertStep,
      id,
    };
    this.scheduleSteps.set(id, step);
    return step;
  }

  async updateScheduleStep(id: string, updates: Partial<ScheduleStep>): Promise<ScheduleStep | undefined> {
    const step = this.scheduleSteps.get(id);
    if (!step) return undefined;

    const updatedStep = { ...step, ...updates };
    this.scheduleSteps.set(id, updatedStep);
    return updatedStep;
  }

  async deleteScheduleStep(id: string): Promise<boolean> {
    return this.scheduleSteps.delete(id);
  }

  async deleteScheduleSteps(scheduleId: string): Promise<boolean> {
    const steps = await this.getScheduleSteps(scheduleId);
    let allDeleted = true;
    for (const step of steps) {
      if (!this.scheduleSteps.delete(step.id)) {
        allDeleted = false;
      }
    }
    return allDeleted;
  }

  // Zone Runs
  async getZoneRun(id: string): Promise<ZoneRun | undefined> {
    return this.zoneRuns.get(id);
  }

  async getActiveZoneRuns(): Promise<ZoneRun[]> {
    return Array.from(this.zoneRuns.values())
      .filter(run => run.status === "running")
      .sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime());
  }

  async getZoneRunsByZone(zoneId: string): Promise<ZoneRun[]> {
    return Array.from(this.zoneRuns.values())
      .filter(run => run.zoneId === zoneId)
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  }

  async getZoneRunsBySchedule(scheduleId: string): Promise<ZoneRun[]> {
    return Array.from(this.zoneRuns.values())
      .filter(run => run.scheduleId === scheduleId)
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  }

  async createZoneRun(insertZoneRun: InsertZoneRun): Promise<ZoneRun> {
    const id = randomUUID();
    const zoneRun: ZoneRun = {
      ...insertZoneRun,
      id,
      startedAt: new Date(),
      completedAt: null,
    };
    this.zoneRuns.set(id, zoneRun);
    
    // Update the zone to mark it as active
    await this.updateZone(zoneRun.zoneId, { 
      isActive: true, 
      currentRunId: id 
    });
    
    return zoneRun;
  }

  async updateZoneRun(id: string, updates: Partial<ZoneRun>): Promise<ZoneRun | undefined> {
    const zoneRun = this.zoneRuns.get(id);
    if (!zoneRun) return undefined;

    const updatedZoneRun = { ...zoneRun, ...updates };
    this.zoneRuns.set(id, updatedZoneRun);
    return updatedZoneRun;
  }

  async completeZoneRun(id: string): Promise<ZoneRun | undefined> {
    const zoneRun = this.zoneRuns.get(id);
    if (!zoneRun) return undefined;

    const updatedZoneRun = { 
      ...zoneRun, 
      status: "completed", 
      completedAt: new Date() 
    };
    this.zoneRuns.set(id, updatedZoneRun);
    
    // Update the zone to mark it as inactive
    await this.updateZone(zoneRun.zoneId, { 
      isActive: false, 
      currentRunId: null 
    });
    
    return updatedZoneRun;
  }

  async cancelZoneRun(id: string): Promise<ZoneRun | undefined> {
    const zoneRun = this.zoneRuns.get(id);
    if (!zoneRun) return undefined;

    const updatedZoneRun = { 
      ...zoneRun, 
      status: "cancelled", 
      completedAt: new Date() 
    };
    this.zoneRuns.set(id, updatedZoneRun);
    
    // Update the zone to mark it as inactive
    await this.updateZone(zoneRun.zoneId, { 
      isActive: false, 
      currentRunId: null 
    });
    
    return updatedZoneRun;
  }

  // System Status
  async getSystemStatus(): Promise<SystemStatus> {
    this.systemStatus.lastUpdated = new Date();
    return this.systemStatus;
  }

  async updateSystemStatus(updates: Partial<SystemStatus>): Promise<SystemStatus> {
    this.systemStatus = { 
      ...this.systemStatus, 
      ...updates, 
      lastUpdated: new Date() 
    };
    return this.systemStatus;
  }

  // Notifications
  async getNotification(id: string): Promise<Notification | undefined> {
    return this.notifications.get(id);
  }

  async getNotificationsByUser(userId: string): Promise<Notification[]> {
    return Array.from(this.notifications.values())
      .filter(notification => notification.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getUnreadNotificationsByUser(userId: string): Promise<Notification[]> {
    return Array.from(this.notifications.values())
      .filter(notification => notification.userId === userId && notification.read === 0)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async createNotification(insertNotification: InsertNotification): Promise<Notification> {
    const id = randomUUID();
    const notification: Notification = {
      ...insertNotification,
      id,
      createdAt: new Date(),
    };
    this.notifications.set(id, notification);
    return notification;
  }

  async markNotificationAsRead(id: string): Promise<boolean> {
    const notification = this.notifications.get(id);
    if (!notification) return false;

    notification.read = 1;
    this.notifications.set(id, notification);
    return true;
  }

  // Analytics
  async getZoneAnalytics(startDate?: Date, endDate?: Date): Promise<{
    totalRuns: number;
    totalDuration: number;
    byZone: { zoneName: string; runs: number; duration: number }[];
    bySource: { source: string; runs: number; duration: number }[];
  }> {
    let runs = Array.from(this.zoneRuns.values())
      .filter(run => run.status === "completed");

    if (startDate) {
      runs = runs.filter(run => new Date(run.startedAt) >= startDate);
    }
    if (endDate) {
      runs = runs.filter(run => new Date(run.startedAt) <= endDate);
    }

    const totalRuns = runs.length;
    const totalDuration = runs.reduce((sum, run) => sum + run.duration, 0);

    // Group by zone
    const zoneMap = new Map<string, { runs: number; duration: number }>();
    for (const run of runs) {
      const zone = await this.getZone(run.zoneId);
      const zoneName = zone?.name || `Zone ${zone?.zoneNumber || 'Unknown'}`;
      const existing = zoneMap.get(zoneName) || { runs: 0, duration: 0 };
      zoneMap.set(zoneName, {
        runs: existing.runs + 1,
        duration: existing.duration + run.duration,
      });
    }

    const byZone = Array.from(zoneMap.entries()).map(([zoneName, data]) => ({
      zoneName,
      ...data,
    }));

    // Group by source
    const sourceMap = new Map<string, { runs: number; duration: number }>();
    runs.forEach(run => {
      const source = run.source.startsWith("schedule:") ? "Scheduled" : "Manual";
      const existing = sourceMap.get(source) || { runs: 0, duration: 0 };
      sourceMap.set(source, {
        runs: existing.runs + 1,
        duration: existing.duration + run.duration,
      });
    });

    const bySource = Array.from(sourceMap.entries()).map(([source, data]) => ({
      source,
      ...data,
    }));

    return {
      totalRuns,
      totalDuration,
      byZone,
      bySource,
    };
  }
}

export const storage = new MemStorage();