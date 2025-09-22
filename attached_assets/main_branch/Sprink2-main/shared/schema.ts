import { sql } from "drizzle-orm";
import { pgTable, text, varchar, decimal, timestamp, json, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  role: text("role").notNull().default("admin"), // admin, operator
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const zones = pgTable("zones", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  zoneNumber: integer("zone_number").notNull().unique(), // 1-16 for GPIO mapping
  gpioPin: integer("gpio_pin").notNull().unique(), // Actual GPIO pin number
  name: text("name").notNull(), // User-friendly name like "Front Lawn"
  isEnabled: boolean("is_enabled").notNull().default(true),
  defaultDuration: integer("default_duration").notNull().default(30), // minutes
  isActive: boolean("is_active").notNull().default(false),
  currentRunId: varchar("current_run_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const schedules = pgTable("schedules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  startTime: text("start_time").notNull(), // "HH:MM" format
  days: text("days").array().notNull(), // ["Mon", "Wed", "Fri"]
  isEnabled: boolean("is_enabled").notNull().default(true),
  lastRun: timestamp("last_run"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const scheduleSteps = pgTable("schedule_steps", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  scheduleId: varchar("schedule_id").notNull().references(() => schedules.id),
  zoneId: varchar("zone_id").notNull().references(() => zones.id),
  stepOrder: integer("step_order").notNull(),
  duration: integer("duration").notNull(), // minutes
});

export const zoneRuns = pgTable("zone_runs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  zoneId: varchar("zone_id").notNull().references(() => zones.id),
  duration: integer("duration").notNull(), // minutes
  source: text("source").notNull(), // "manual", "schedule:{id}"
  scheduleId: varchar("schedule_id").references(() => schedules.id),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  endsAt: timestamp("ends_at").notNull(),
  completedAt: timestamp("completed_at"),
  status: text("status").notNull().default("running"), // running, completed, cancelled
});

export const systemStatus = pgTable("system_status", {
  id: varchar("id").primaryKey().default("system"),
  rainDelayActive: boolean("rain_delay_active").notNull().default(false),
  rainDelayEndsAt: timestamp("rain_delay_ends_at"),
  connectivity: text("connectivity").notNull().default("online"), // online, offline, error
  lastUpdated: timestamp("last_updated").notNull().defaultNow(),
  piBackendUrl: text("pi_backend_url"), // URL of the Raspberry Pi backend
  piBackendToken: text("pi_backend_token"), // Authentication token for Pi backend
});

export const notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  type: text("type").notNull(), // zone_started, zone_completed, schedule_started, rain_delay_activated
  title: text("title").notNull(),
  message: text("message").notNull(),
  read: integer("read").notNull().default(0), // 0 = false, 1 = true
  relatedZoneId: varchar("related_zone_id").references(() => zones.id),
  relatedScheduleId: varchar("related_schedule_id").references(() => schedules.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const insertZoneSchema = createInsertSchema(zones).omit({
  id: true,
  isActive: true,
  currentRunId: true,
  createdAt: true,
});

export const insertScheduleSchema = createInsertSchema(schedules).omit({
  id: true,
  lastRun: true,
  createdAt: true,
});

export const insertScheduleStepSchema = createInsertSchema(scheduleSteps).omit({
  id: true,
});

export const insertZoneRunSchema = createInsertSchema(zoneRuns).omit({
  id: true,
  startedAt: true,
  completedAt: true,
});

export const insertSystemStatusSchema = createInsertSchema(systemStatus).omit({
  lastUpdated: true,
});

export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  createdAt: true,
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Zone = typeof zones.$inferSelect;
export type InsertZone = z.infer<typeof insertZoneSchema>;

export type Schedule = typeof schedules.$inferSelect;
export type InsertSchedule = z.infer<typeof insertScheduleSchema>;

export type ScheduleStep = typeof scheduleSteps.$inferSelect;
export type InsertScheduleStep = z.infer<typeof insertScheduleStepSchema>;

export type ZoneRun = typeof zoneRuns.$inferSelect;
export type InsertZoneRun = z.infer<typeof insertZoneRunSchema>;

export type SystemStatus = typeof systemStatus.$inferSelect;
export type InsertSystemStatus = z.infer<typeof insertSystemStatusSchema>;

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;

// Default GPIO pin mappings (matches Python backend)
export const DEFAULT_GPIO_PINS = [12, 16, 20, 21, 26, 19, 13, 6, 5, 11, 9, 10, 22, 27, 17, 4];

// GPIO Safety Allowlist - excludes critical I²C/UART pins
export const SAFE_GPIO_PINS = [
  // Safe GPIO pins for sprinkler control (excluding I²C, UART, SPI, etc.)
  12, 16, 20, 21, 26, 19, 13, 6, 5, 11, 9, 10, 22, 27, 17, 4, 18, 23, 24, 25
];

// Dangerous pins that should never be used for sprinkler control
export const RESTRICTED_GPIO_PINS = [
  0, 1,   // I²C (ID_SD, ID_SC)
  2, 3,   // I²C (SDA, SCL)
  7, 8,   // SPI (CE1, CE0)
  14, 15, // UART (TXD, RXD)
];

// Duration limits and safety constraints
export const SAFETY_LIMITS = {
  MIN_DURATION_MINUTES: 1,
  MAX_DURATION_MINUTES: 12 * 60, // 12 hours
  DEFAULT_DURATION_MINUTES: 30,
  MAX_CONCURRENT_ZONES: 4,
  MIN_BREAK_BETWEEN_RUNS_MINUTES: 2,
} as const;

// Rain delay safety settings
export const RAIN_DELAY_LIMITS = {
  MIN_HOURS: 1,
  MAX_HOURS: 14 * 24, // 14 days
  DEFAULT_HOURS: 24,
} as const;

// Additional schemas for API validation
export const zoneControlSchema = z.object({
  duration: z.number()
    .min(SAFETY_LIMITS.MIN_DURATION_MINUTES)
    .max(SAFETY_LIMITS.MAX_DURATION_MINUTES)
    .optional(),
});

// GPIO pin validation schema
export const gpioPinSchema = z.object({
  pin: z.number()
    .refine(pin => SAFE_GPIO_PINS.includes(pin), {
      message: "GPIO pin is not in the safe allowlist",
    })
    .refine(pin => !RESTRICTED_GPIO_PINS.includes(pin), {
      message: "GPIO pin is restricted for safety reasons (I²C/UART/SPI)",
    }),
});

export const rainDelaySchema = z.object({
  active: z.boolean(),
  hours: z.number()
    .min(RAIN_DELAY_LIMITS.MIN_HOURS)
    .max(RAIN_DELAY_LIMITS.MAX_HOURS)
    .optional(),
});

export const scheduleStepUpdateSchema = z.object({
  zoneId: z.string(),
  duration: z.number().min(SAFETY_LIMITS.MIN_DURATION_MINUTES).max(SAFETY_LIMITS.MAX_DURATION_MINUTES),
  stepOrder: z.number().min(0),
});

export const scheduleUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  startTime: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(), // HH:MM format
  days: z.array(z.enum(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"])).optional(),
  isEnabled: z.boolean().optional(),
  steps: z.array(scheduleStepUpdateSchema).optional(),
});

export const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});