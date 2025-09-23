import { 
  type User, 
  type InsertUser, 
  type Pin,
  type InsertPin,
  type Schedule,
  type InsertSchedule,
  type ScheduleStep,
  type InsertScheduleStep,
  type PinRun,
  type InsertPinRun,
  type SystemStatus,
  type InsertSystemStatus,
  type Notification,
  type InsertNotification,
  type RainDelaySettings,
  type InsertRainDelaySettings,
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

  // Pins
  getPin(id: string): Promise<Pin | undefined>;
  getPinByNumber(pinNumber: number): Promise<Pin | undefined>;
  getPinByGpioPin(gpioPin: number): Promise<Pin | undefined>;
  getAllPins(): Promise<Pin[]>;
  getActivePins(): Promise<Pin[]>;
  getEnabledPins(): Promise<Pin[]>;
  createPin(pin: InsertPin): Promise<Pin>;
  updatePin(id: string, updates: Partial<Pin>): Promise<Pin | undefined>;
  deletePin(id: string): Promise<boolean>;

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

  // Pin Runs
  getPinRun(id: string): Promise<PinRun | undefined>;
  getActivePinRuns(): Promise<PinRun[]>;
  getPinRunsByPin(pinId: string): Promise<PinRun[]>;
  getPinRunsBySchedule(scheduleId: string): Promise<PinRun[]>;
  createPinRun(pinRun: InsertPinRun): Promise<PinRun>;
  updatePinRun(id: string, updates: Partial<PinRun>): Promise<PinRun | undefined>;
  completePinRun(id: string): Promise<PinRun | undefined>;
  cancelPinRun(id: string): Promise<PinRun | undefined>;

  // System Status
  getSystemStatus(): Promise<SystemStatus>;
  updateSystemStatus(updates: Partial<SystemStatus>): Promise<SystemStatus>;

  // Notifications
  getNotification(id: string): Promise<Notification | undefined>;
  getNotificationsByUser(userId: string): Promise<Notification[]>;
  getUnreadNotificationsByUser(userId: string): Promise<Notification[]>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  markNotificationAsRead(id: string): Promise<boolean>;

  // Rain Delay Settings
  getRainDelaySettings(): Promise<RainDelaySettings>;
  updateRainDelaySettings(updates: Partial<RainDelaySettings>): Promise<RainDelaySettings>;

  // Analytics
  getPinAnalytics(startDate?: Date, endDate?: Date): Promise<{
    totalRuns: number;
    totalDuration: number;
    byPin: { pinName: string; runs: number; duration: number }[];
    bySource: { source: string; runs: number; duration: number }[];
  }>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private pins: Map<string, Pin>;
  private schedules: Map<string, Schedule>;
  private scheduleSteps: Map<string, ScheduleStep>;
  private pinRuns: Map<string, PinRun>;
  private systemStatus: SystemStatus;
  private notifications: Map<string, Notification>;
  private rainDelaySettings: RainDelaySettings;

  constructor() {
    this.users = new Map();
    this.pins = new Map();
    this.schedules = new Map();
    this.scheduleSteps = new Map();
    this.pinRuns = new Map();
    this.notifications = new Map();
    
    // Initialize system status
    this.systemStatus = {
      id: "system",
      masterEnabled: true,
      rainDelayActive: false,
      rainDelayEndsAt: null,
      connectivity: "online",
      lastUpdated: new Date(),
      piBackendUrl: null,
      piBackendToken: null,
    };

    // Initialize rain delay settings
    this.rainDelaySettings = {
      id: "rain_delay",
      enabled: false,
      zipCode: "",
      threshold: 20,
      checkCurrent: true,
      check12Hour: true,
      check24Hour: true,
      lastWeatherCheck: null,
      currentRainPercent: 0,
      rain12HourPercent: 0,
      rain24HourPercent: 0,
      weatherApiKey: null,
      updatedAt: new Date(),
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
      await this.createPin({
        pinNumber: i + 1,
        gpioPin: DEFAULT_GPIO_PINS[i],
        name: zoneNames[i] || `Pin ${i + 1}`,
        isEnabled: true,
        defaultDuration: 30,
      });
    }

    // Create sample schedule
    const pins = await this.getAllPins();
    const sampleSchedule = await this.createSchedule({
      name: "Morning Watering",
      startTime: "06:00",
      days: ["Mon", "Wed", "Fri"],
      isEnabled: true,
    });

    // Add schedule steps for first 4 zones
    for (let i = 0; i < Math.min(4, pins.length); i++) {
      await this.createScheduleStep({
        scheduleId: sampleSchedule.id,
        pinId: pins[i].id,
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
  async getPin(id: string): Promise<Pin | undefined> {
    return this.pins.get(id);
  }

  async getPinByNumber(pinNumber: number): Promise<Pin | undefined> {
    return Array.from(this.pins.values()).find(pin => pin.pinNumber === pinNumber);
  }

  async getPinByGpioPin(gpioPin: number): Promise<Pin | undefined> {
    return Array.from(this.pins.values()).find(pin => pin.gpioPin === gpioPin);
  }

  async getAllPins(): Promise<Pin[]> {
    return Array.from(this.pins.values()).sort((a, b) => a.pinNumber - b.pinNumber);
  }

  async getActivePins(): Promise<Pin[]> {
    return Array.from(this.pins.values()).filter(pin => pin.isActive);
  }

  async getEnabledPins(): Promise<Pin[]> {
    return Array.from(this.pins.values())
      .filter(pin => pin.isEnabled)
      .sort((a, b) => a.pinNumber - b.pinNumber);
  }

  async createPin(insertPin: InsertPin): Promise<Pin> {
    const id = randomUUID();
    const pin: Pin = {
      ...insertPin,
      id,
      createdAt: new Date(),
    };
    this.pins.set(id, pin);
    return pin;
  }

  async updatePin(id: string, updates: Partial<Pin>): Promise<Pin | undefined> {
    const pin = this.pins.get(id);
    if (!pin) return undefined;

    const updatedPin = { ...pin, ...updates };
    this.pins.set(id, updatedPin);
    return updatedPin;
  }

  async deletePin(id: string): Promise<boolean> {
    return this.pins.delete(id);
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

  // Pin Runs
  async getPinRun(id: string): Promise<PinRun | undefined> {
    return this.pinRuns.get(id);
  }

  async getActivePinRuns(): Promise<PinRun[]> {
    return Array.from(this.pinRuns.values())
      .filter(run => run.status === "running")
      .sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime());
  }

  async getPinRunsByPin(pinId: string): Promise<PinRun[]> {
    return Array.from(this.pinRuns.values())
      .filter(run => run.pinId === pinId)
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  }

  async getPinRunsBySchedule(scheduleId: string): Promise<PinRun[]> {
    return Array.from(this.pinRuns.values())
      .filter(run => run.scheduleId === scheduleId)
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  }

  async createPinRun(insertPinRun: InsertPinRun): Promise<PinRun> {
    const id = randomUUID();
    const pinRun: PinRun = {
      ...insertPinRun,
      id,
      startedAt: new Date(),
      completedAt: null,
    };
    this.pinRuns.set(id, pinRun);
    
    // Update the pin to mark it as active
    await this.updatePin(pinRun.pinId, { 
      isActive: true, 
      currentRunId: id 
    });
    
    return pinRun;
  }

  async updatePinRun(id: string, updates: Partial<PinRun>): Promise<PinRun | undefined> {
    const pinRun = this.pinRuns.get(id);
    if (!pinRun) return undefined;

    const updatedPinRun = { ...pinRun, ...updates };
    this.pinRuns.set(id, updatedPinRun);
    return updatedPinRun;
  }

  async completePinRun(id: string): Promise<PinRun | undefined> {
    const pinRun = this.pinRuns.get(id);
    if (!pinRun) return undefined;

    const updatedPinRun = { 
      ...pinRun, 
      status: "completed", 
      completedAt: new Date() 
    };
    this.pinRuns.set(id, updatedPinRun);
    
    // Update the pin to mark it as inactive
    await this.updatePin(pinRun.pinId, { 
      isActive: false, 
      currentRunId: null 
    });
    
    return updatedPinRun;
  }

  async cancelPinRun(id: string): Promise<PinRun | undefined> {
    const pinRun = this.pinRuns.get(id);
    if (!pinRun) return undefined;

    const updatedPinRun = { 
      ...pinRun, 
      status: "cancelled", 
      completedAt: new Date() 
    };
    this.pinRuns.set(id, updatedPinRun);
    
    // Update the pin to mark it as inactive
    await this.updatePin(pinRun.pinId, { 
      isActive: false, 
      currentRunId: null 
    });
    
    return updatedPinRun;
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

  // Rain Delay Settings
  async getRainDelaySettings(): Promise<RainDelaySettings> {
    return this.rainDelaySettings;
  }

  async updateRainDelaySettings(updates: Partial<RainDelaySettings>): Promise<RainDelaySettings> {
    this.rainDelaySettings = {
      ...this.rainDelaySettings,
      ...updates,
      updatedAt: new Date(),
    };
    return this.rainDelaySettings;
  }
}

export const storage = new MemStorage();