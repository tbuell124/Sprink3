# Sprinkler Control System - Raspberry Pi Deployment Guide

## Overview

A modern web-based sprinkler control system built with React, Express, and PostgreSQL. This guide provides step-by-step instructions for deploying the application on a Raspberry Pi with Node.js 18.

## Prerequisites

- Raspberry Pi with Raspbian OS
- Node.js 18+ installed
- Git installed
- Network connectivity

## Deployment Instructions

### Step 1: Get the Code

```bash
# Navigate to home directory
cd /home/tybuell

# Clone the repository
git clone https://github.com/tbuell124/Sprink2.git Sprink

# Enter the project directory
cd Sprink
```

### Step 2: Fix Node.js 18 Compatibility Issues

The original code uses `import.meta.dirname` which is not available in Node.js 18. Fix the compatibility issues:

**Fix vite.config.ts:**
```bash
cat > vite.config.ts << 'EOF'
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer(),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client", "src"),
      "@shared": path.resolve(__dirname, "shared"),
      "@assets": path.resolve(__dirname, "attached_assets"),
    },
  },
  root: path.resolve(__dirname, "client"),
  build: {
    outDir: path.resolve(__dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
EOF
```

**Fix server/vite.ts:**
```bash
cat > server/vite.ts << 'EOF'
import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer, createLogger } from "vite";
import { type Server } from "http";
import viteConfig from "../vite.config";
import { nanoid } from "nanoid";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const viteLogger = createLogger();

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        __dirname,
        "..",
        "client",
        "index.html",
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
EOF
```

### Step 3: Install Dependencies and Configure Environment

```bash
# Install all project dependencies
npm install

# Create environment configuration
cat > .env << 'EOF'
NODE_ENV=production
SESSION_SECRET=sprinkler-secret-$(date +%s)
PORT=5000
EOF
```

### Step 4: Install PM2 Process Manager (if not already installed)

```bash
# Install PM2 globally
sudo npm install -g pm2
```

### Step 5: Start the Application

```bash
# Start the application with PM2 in development mode
pm2 start npm --name "sprinkler-web" -- run dev

# Check status
pm2 status

# Verify the application is listening on port 5000
netstat -tulpn | grep :5000
```

### Step 6: Set Up Auto-Start on Boot

```bash
# Save current PM2 processes
pm2 save

# Set up PM2 to start on boot
pm2 startup

# Follow any instructions that pm2 startup provides
# (It will show a command to run with sudo)
```

### Step 7: Get Your Pi's IP Address

```bash
# Find your Pi's IP address
hostname -I
```

The first IP address shown (e.g., 192.168.1.24) is your Pi's local network address.

## Accessing the Application

Once deployed, you can access your sprinkler controller at:

```
http://YOUR_PI_IP_ADDRESS:5000
```

For example: `http://192.168.1.24:5000`

## Features

- **Mobile-optimized interface** - Works great on phones and tablets
- **Touch-friendly controls** - Large buttons and touch targets
- **Manual duration input** - Prepopulated with 10 minutes (1-720 minute range)
- **Zone control** - Individual sprinkler zone management
- **Real-time status** - Live updates of sprinkler system status
- **Accessibility features** - Screen reader support and keyboard navigation

## Troubleshooting

### Check Application Status
```bash
# Check PM2 status
pm2 status

# View application logs
pm2 logs sprinkler-web --lines 20

# Check if port 5000 is in use
netstat -tulpn | grep :5000
```

### Restart Application
```bash
# Restart the application
pm2 restart sprinkler-web

# Or stop and start fresh
pm2 stop sprinkler-web
pm2 start npm --name "sprinkler-web" -- run dev
```

### Clean Install
```bash
# If you need to start over
pm2 stop all
pm2 delete all
cd /home/tybuell
rm -rf Sprink
git clone https://github.com/tbuell124/Sprink2.git Sprink
cd Sprink
# Then follow steps 2-5 above
```

## Network Configuration

### Set Static IP (Optional but Recommended)
```bash
# Edit network configuration
sudo nano /etc/dhcpcd.conf

# Add these lines (adjust for your network):
interface eth0
static ip_address=192.168.1.24/24
static routers=192.168.1.1
static domain_name_servers=192.168.1.1 8.8.8.8
```

### Configure Firewall
```bash
# Enable firewall
sudo ufw enable

# Allow web interface access
sudo ufw allow 5000

# Keep SSH access
sudo ufw allow ssh
```

## Hardware Integration

The application is designed to work with GPIO pins for sprinkler valve control. The default configuration uses these GPIO pins:
```
[12, 16, 20, 21, 26, 19, 13, 6, 5, 11, 9, 10, 22, 27, 17, 4]
```

These pins are safe for sprinkler relay control and avoid power/system pins.

## Maintenance

### Update the Application
```bash
cd /home/tybuell/Sprink
git pull origin main
npm install
pm2 restart sprinkler-web
```

### View Logs
```bash
# Real-time logs
pm2 logs sprinkler-web

# Recent logs
pm2 logs sprinkler-web --lines 50
```

### Backup Configuration
```bash
# Create backup of current installation
cp -r /home/tybuell/Sprink /home/tybuell/Sprink-backup-$(date +%Y%m%d)
```

## Development vs Production

This guide uses development mode (`npm run dev`) for easier debugging. For production deployment, you would:

1. Run `npm run build` to create production build
2. Use `pm2 start npm --name "sprinkler-web" -- start` instead

However, development mode is recommended for Pi deployment as it provides better error messages and hot reloading for maintenance.

---

**Repository:** https://github.com/tbuell124/Sprink2
**Deployment Path:** `/home/tybuell/Sprink`  
**Access URL:** `http://YOUR_PI_IP:5000`