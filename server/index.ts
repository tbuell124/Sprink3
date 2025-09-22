import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { storage } from "./storage";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });

  // Start automatic weather checking interval
  startWeatherCheckInterval();
})();

// Automatic weather checking for rain delay
async function startWeatherCheckInterval() {
  const checkWeather = async () => {
    try {
      // Always check for auto-deactivation first (regardless of settings)
      const systemStatus = await storage.getSystemStatus();
      if (systemStatus.rainDelayActive && systemStatus.rainDelayEndsAt && new Date() > systemStatus.rainDelayEndsAt) {
        await storage.updateSystemStatus({
          rainDelayActive: false,
          rainDelayEndsAt: null,
        });
        log(`Rain delay auto-deactivated: expired`);
      }

      const settings = await storage.getRainDelaySettings();
      
      if (!settings.enabled || !settings.weatherApiKey || !settings.zipCode) {
        return; // Skip weather checking if not properly configured
      }

      // Check if we should run (don't check too frequently)
      const lastCheck = settings.lastWeatherCheck;
      if (lastCheck && (Date.now() - lastCheck.getTime()) < 5 * 60 * 1000) {
        return; // Skip if checked within last 5 minutes
      }

      // Fetch weather data
      const currentWeatherUrl = `https://api.openweathermap.org/data/2.5/weather?zip=${settings.zipCode}&appid=${settings.weatherApiKey}&units=imperial`;
      const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?zip=${settings.zipCode}&appid=${settings.weatherApiKey}&units=imperial`;

      const [currentResponse, forecastResponse] = await Promise.all([
        fetch(currentWeatherUrl),
        fetch(forecastUrl)
      ]);

      if (!currentResponse.ok || !forecastResponse.ok) {
        log(`Weather API error: ${currentResponse.status}, ${forecastResponse.status}`);
        return;
      }

      const currentData = await currentResponse.json();
      const forecastData = await forecastResponse.json();

      // Calculate rain probabilities
      const currentRainPercent = Math.round((currentData.rain?.['1h'] || 0) * 100 / 5);
      
      const now = Date.now();
      const next12Hours = forecastData.list.filter((item: any) => {
        const itemTime = new Date(item.dt * 1000).getTime();
        return itemTime <= now + (12 * 60 * 60 * 1000);
      });
      const next24Hours = forecastData.list.filter((item: any) => {
        const itemTime = new Date(item.dt * 1000).getTime();
        return itemTime <= now + (24 * 60 * 60 * 1000);
      });

      const rain12HourPercent = next12Hours.length > 0 ? Math.max(...next12Hours.map((item: any) => Math.round((item.pop || 0) * 100))) : 0;
      const rain24HourPercent = next24Hours.length > 0 ? Math.max(...next24Hours.map((item: any) => Math.round((item.pop || 0) * 100))) : 0;

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
        const currentSystemStatus = await storage.getSystemStatus();
        if (!currentSystemStatus.rainDelayActive) {
          await storage.updateSystemStatus({
            rainDelayActive: true,
            rainDelayEndsAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
          });

          // Cancel active zones
          const activeRuns = await storage.getActiveZoneRuns();
          for (const run of activeRuns) {
            await storage.cancelZoneRun(run.id);
          }

          log(`Rain delay auto-activated: ${Math.max(currentRainPercent, rain12HourPercent, rain24HourPercent)}% rain probability`);
        }
      }
    } catch (error) {
      // Silently handle errors to avoid spamming logs
      if (error instanceof Error && error.message.includes('fetch')) {
        // Network error, skip this check
        return;
      }
      log(`Weather check error: ${error}`);
    }
  };

  // Check weather every 10 minutes
  setInterval(checkWeather, 10 * 60 * 1000);
  
  // Initial check after 30 seconds (allow server to fully start)
  setTimeout(checkWeather, 30 * 1000);
  
  log('Weather checking interval started');
}
