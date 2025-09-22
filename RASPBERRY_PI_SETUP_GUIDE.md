# Comprehensive Raspberry Pi Sprinkler Controller Setup Guide

## Table of Contents
1. [Hardware Requirements](#1-hardware-requirements)
2. [Operating System Setup](#2-operating-system-setup)
3. [Node.js Web App Setup](#3-nodejs-web-app-setup)
4. [Pi Backend Installation](#4-pi-backend-installation)
5. [Network Configuration](#5-network-configuration)
6. [Security Configuration](#6-security-configuration)
7. [Integration Testing](#7-integration-testing)
8. [Troubleshooting](#8-troubleshooting)
9. [Maintenance](#9-maintenance)

---

## 1. Hardware Requirements

### Recommended Raspberry Pi Models
- **Raspberry Pi 4 Model B (4GB+)**: Recommended for best performance
- **Raspberry Pi 3 Model B+**: Minimum recommended
- **Raspberry Pi Zero 2 W**: Budget option (may be slower)

### Essential Components
- **MicroSD Card**: 32GB Class 10 or better (SanDisk Extreme recommended)
- **Power Supply**: Official Raspberry Pi power adapter (5V 3A for Pi 4)
- **Ethernet Cable**: For initial setup and stable connection
- **Case**: With ventilation for heat dissipation

### Sprinkler Control Hardware
- **Relay Module**: 16-channel 5V relay board (JQC-3FF relays recommended)
- **GPIO Ribbon Cable**: 40-pin male-to-female jumper wires
- **Power Supply for Relays**: 5V 10A switching power supply
- **Terminal Blocks**: For connecting sprinkler wires
- **Fuses**: 1A blade fuses for each zone (safety)

### GPIO Pin Configuration
The system uses these GPIO pins for sprinkler zone control:
```
Zone  1: GPIO 12   |  Zone  9: GPIO  5
Zone  2: GPIO 16   |  Zone 10: GPIO 11
Zone  3: GPIO 20   |  Zone 11: GPIO  9
Zone  4: GPIO 21   |  Zone 12: GPIO 10
Zone  5: GPIO 26   |  Zone 13: GPIO 22
Zone  6: GPIO 19   |  Zone 14: GPIO 27
Zone  7: GPIO 13   |  Zone 15: GPIO 17
Zone  8: GPIO  6   |  Zone 16: GPIO  4
```

### Wiring Diagram
```
Raspberry Pi → Relay Board → Sprinkler Valves
GPIO Pin ────→ Relay IN    → 24VAC Valve Control
Ground   ────→ Relay GND   
5V       ────→ Relay VCC   
```

**⚠️ SAFETY WARNING**: 
- Never connect 24VAC directly to Raspberry Pi GPIO pins
- Always use relays to isolate high voltage from the Pi
- Use proper fuses for each sprinkler zone
- Follow local electrical codes

---

## 2. Operating System Setup

### Download and Flash Raspberry Pi OS

1. **Download Raspberry Pi Imager**:
   - Visit: https://www.raspberrypi.org/software/
   - Download for your operating system

2. **Flash the OS**:
   - Use Raspberry Pi OS Lite (64-bit) for headless setup
   - Select "Raspberry Pi OS Lite (64-bit)" in the imager
   - Choose your SD card
   - Click the gear icon for advanced options

3. **Advanced Configuration**:
   ```
   ✓ Enable SSH (use password authentication)
   ✓ Set username: tybuell (or your preferred username)
   ✓ Set password: [your-secure-password]
   ✓ Configure wireless LAN (if needed)
   ✓ Set locale settings
   ```

4. **Flash and Boot**:
   - Click "Write" to flash the SD card
   - Insert SD card into Pi and power on
   - Wait 2-3 minutes for first boot

### Initial Configuration

1. **Connect via SSH**:
   ```bash
   ssh tybuell@[PI_IP_ADDRESS]  # Replace 'tybuell' with your username
   ```

2. **Update the System**:
   ```bash
   sudo apt update && sudo apt upgrade -y
   sudo reboot
   ```

3. **Enable GPIO and Required Services**:
   ```bash
   sudo raspi-config
   ```
   - Interface Options → SSH → Enable
   - Interface Options → I2C → Enable (if using I2C sensors)
   - Interface Options → SPI → Enable (if using SPI sensors)
   - Advanced Options → Expand Filesystem
   - Finish and reboot

4. **Install Essential Packages**:
   ```bash
   sudo apt install -y git curl nano htop ufw fail2ban pigpio
   ```

5. **Enable Services**:
   ```bash
   sudo systemctl enable pigpiod
   sudo systemctl start pigpiod
   sudo systemctl enable ssh
   ```

---

## 3. Node.js Web App Setup

### Install Node.js 20+

1. **Install Node.js using NodeSource Repository**:
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```

2. **Verify Installation**:
   ```bash
   node --version  # Should show v20.x.x
   npm --version   # Should show 10.x.x+
   ```

3. **Install PM2 Process Manager**:
   ```bash
   sudo npm install -g pm2
   ```

### Clone and Setup the Web Application

1. **Create Directory and Clone Repository**:
   ```bash
   cd /home/pi
   git clone https://github.com/tbuell124/Sprink2.git sprinkler-web
   cd sprinkler-web
   ```

2. **Install Required Dependencies and Remove Replit Dependencies**:
   ```bash
   # Install nanoid for unique IDs (required by vite server)
   npm install nanoid
   
   # Remove Replit-specific dev dependencies that won't exist on Pi
   npm uninstall @replit/vite-plugin-runtime-error-modal @replit/vite-plugin-cartographer @replit/vite-plugin-dev-banner
   ```

3. **Create Pi-Compatible Configuration Files**:
   
   **Create Pi-Compatible vite.config.ts**:
   ```bash
   cat > vite.config.ts << 'EOF'
   import { defineConfig } from "vite";
   import react from "@vitejs/plugin-react";
   import path from "path";
   import { fileURLToPath } from "url";

   const __dirname = path.dirname(fileURLToPath(import.meta.url));

   export default defineConfig({
     plugins: [react()],
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
       host: "0.0.0.0",
       port: 5000,
       fs: {
         strict: true,
         deny: ["**/.*"],
       },
     },
   });
   EOF
   ```

   **Update server/vite.ts**:
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

     app.use("*", (_req, res) => {
       res.sendFile(path.resolve(distPath, "index.html"));
     });
   }
   EOF
   ```

4. **Install Dependencies**:
   ```bash
   npm install
   ```

5. **Create Environment Configuration**:
   ```bash
   cat > .env << 'EOF'
   NODE_ENV=production
   SESSION_SECRET=sprinkler-secret-$(date +%s)
   PORT=5000
   EOF
   ```

### Production vs Development Mode

**For Pi Deployment, we recommend DEVELOPMENT MODE** for the following reasons:

1. **Hot Reload**: Automatically picks up configuration changes
2. **Better Debugging**: Easier to troubleshoot issues with detailed error messages
3. **Live Updates**: Changes to frontend are reflected without manual rebuilds
4. **Maintenance**: Easier to apply updates from the repository

**Development Mode (Recommended for Pi)**:
```bash
# This is what we set up above with PM2
pm2 start npm --name "sprinkler-web" -- run dev
```

**Production Mode (Alternative Setup)**:
If you prefer a traditional production build:
```bash
# Build the application
npm run build

# Start production server
pm2 start npm --name "sprinkler-web" -- run start
```

**⚠️ Note**: Production mode requires rebuilding after any code changes, while development mode automatically reloads changes. For a Pi deployment where you may need to make configuration adjustments, development mode is more practical.

6. **Start the Web Application and Configure Autostart**:
   ```bash
   pm2 start npm --name "sprinkler-web" -- run dev
   pm2 save
   
   # Setup PM2 autostart on boot
   pm2 startup
   # IMPORTANT: Copy and run the command that PM2 outputs above!
   # It will look like: sudo env PATH=... pm2 startup systemd -u pi --hp /home/pi
   
   # After running the suggested command, save the PM2 process list:
   pm2 save
   ```

7. **Verify Web App is Running**:
   ```bash
   pm2 status
   netstat -tulpn | grep :5000
   curl -I http://localhost:5000
   ```

---

## 4. Pi Backend Installation

### Automated Installation Using install.sh

1. **Navigate to Backend Directory**:
   ```bash
   cd /home/pi/sprinkler-web/pi-backend
   ```

2. **Make Install Script Executable**:
   ```bash
   chmod +x install.sh
   ```

3. **Run the Installation Script**:
   ```bash
   ./install.sh
   ```

   The script will automatically:
   - Create installation directory at `/home/pi/sprinkler-backend`
   - Update system packages
   - Install Python 3 and dependencies
   - Install and configure pigpio
   - Create Python virtual environment
   - Install required Python packages
   - Install systemd service
   - Start the sprinkler service

### Manual Installation (Alternative)

If you prefer manual installation:

1. **Create Backend Directory**:
   ```bash
   sudo mkdir -p /home/pi/sprinkler-backend
   sudo chown pi:pi /home/pi/sprinkler-backend
   cd /home/pi/sprinkler-backend
   ```

2. **Copy Backend Files**:
   ```bash
   cp /home/pi/sprinkler-web/pi-backend/* .
   ```

3. **Install Python Dependencies**:
   ```bash
   sudo apt install -y python3 python3-pip python3-venv pigpio
   python3 -m venv venv
   source venv/bin/activate
   pip install --upgrade pip
   pip install -r requirements.txt
   ```

4. **Install Systemd Service**:
   ```bash
   sudo cp sprinkler.service /etc/systemd/system/
   sudo systemctl daemon-reload
   sudo systemctl enable sprinkler.service
   sudo systemctl start sprinkler.service
   ```

### Verify Backend Installation

1. **Check Service Status**:
   ```bash
   sudo systemctl status sprinkler.service
   ```

2. **Test API Endpoints**:
   ```bash
   curl http://localhost:8000/health
   curl http://localhost:8000/api/status
   curl http://localhost:8000/api/pins
   ```

3. **View Service Logs**:
   ```bash
   sudo journalctl -u sprinkler.service -f
   ```

---

## 5. Network Configuration

### Set Static IP Address

1. **Edit DHCP Configuration**:
   ```bash
   sudo nano /etc/dhcpcd.conf
   ```

2. **Add Static IP Configuration**:
   ```bash
   # Add to end of file (adjust for your network)
   interface eth0
   static ip_address=192.168.1.100/24
   static routers=192.168.1.1
   static domain_name_servers=192.168.1.1 8.8.8.8

   # For WiFi (if using)
   interface wlan0
   static ip_address=192.168.1.100/24
   static routers=192.168.1.1
   static domain_name_servers=192.168.1.1 8.8.8.8
   ```

3. **Restart Networking**:
   ```bash
   sudo systemctl restart dhcpcd
   ```

### Configure Firewall

1. **Enable UFW Firewall**:
   ```bash
   sudo ufw enable
   ```

2. **Configure Secure Firewall Rules (LAN Only Access)**:
   ```bash
   # Allow SSH (always configure this first!)
   sudo ufw allow ssh

   # SECURE SETUP: Allow sprinkler services only from LAN subnet
   # Replace 192.168.1.0/24 with your actual network subnet if different
   sudo ufw allow from 192.168.1.0/24 to any port 5000 comment "Sprinkler Web Interface - LAN Only"
   sudo ufw allow from 192.168.1.0/24 to any port 8000 comment "Sprinkler GPIO API - LAN Only"

   # Optional: Allow from anywhere (LESS SECURE - only use for testing)
   # sudo ufw allow 5000/tcp comment "Sprinkler Web Interface - Global"
   # sudo ufw allow 8000/tcp comment "Sprinkler GPIO API - Global"
   ```

3. **Check Firewall Status**:
   ```bash
   sudo ufw status verbose
   ```

### Port Access Configuration

1. **Verify Port Binding**:
   ```bash
   netstat -tulpn | grep -E ':(5000|8000)'
   ```

2. **Test External Access**:
   ```bash
   # From another machine on the network
   curl http://192.168.1.100:5000
   curl http://192.168.1.100:8000/health
   ```

---

## 6. Security Configuration

### Generate and Configure API Tokens

1. **Generate Secure API Token**:
   ```bash
   # Generate a strong random token (64 characters)
   TOKEN=$(openssl rand -hex 32)
   echo "Generated API Token: $TOKEN"
   echo "Save this token - you'll need it for the web interface!"
   ```

2. **Configure Backend with API Token and CORS**:
   ```bash
   sudo nano /etc/systemd/system/sprinkler.service
   ```
   
   **Update the [Service] section to include these environment variables**:
   ```ini
   [Service]
   Type=simple
   User=pi
   Group=pi
   WorkingDirectory=/home/pi/sprinkler-backend
   Environment=PATH=/home/pi/sprinkler-backend/venv/bin
   Environment=PYTHONPATH=/home/pi/sprinkler-backend
   Environment=SPRINKLER_API_TOKEN=YOUR_GENERATED_TOKEN_HERE
   Environment=ALLOWED_ORIGINS=http://localhost:5000,http://192.168.1.100:5000
   ExecStart=/home/pi/sprinkler-backend/venv/bin/python main.py
   ```
   
   **⚠️ IMPORTANT**: Replace `YOUR_GENERATED_TOKEN_HERE` with your actual generated token from step 1.
   **⚠️ IMPORTANT**: Replace `192.168.1.100` with your Pi's actual IP address.

3. **Reload and Restart Backend Service**:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl restart sprinkler.service
   
   # Verify the service started successfully
   sudo systemctl status sprinkler.service
   ```

### CORS Configuration

The backend is pre-configured with CORS settings that allow:
- `http://localhost:5000` (development)
- `https://localhost:5000` (HTTPS development)

To add your Pi's IP address:

1. **Edit Backend Configuration**:
   ```bash
   sudo nano /home/pi/sprinkler-backend/main.py
   ```

2. **Update ALLOWED_ORIGINS**:
   ```python
   ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", 
       "http://localhost:5000,https://localhost:5000,http://192.168.1.100:5000").split(",")
   ```

3. **Or Set Environment Variable**:
   ```bash
   sudo systemctl edit sprinkler.service
   ```
   
   Add:
   ```ini
   [Service]
   Environment=ALLOWED_ORIGINS=http://localhost:5000,http://192.168.1.100:5000
   ```

### Additional Security Measures

1. **Change Default Password**:
   ```bash
   passwd pi
   ```

2. **Disable Root Login**:
   ```bash
   sudo passwd -l root
   ```

3. **Configure Fail2ban**:
   ```bash
   sudo systemctl enable fail2ban
   sudo systemctl start fail2ban
   ```

4. **Update SSH Configuration**:
   ```bash
   sudo nano /etc/ssh/sshd_config
   ```
   
   Recommended settings:
   ```
   PermitRootLogin no
   PasswordAuthentication yes
   PubkeyAuthentication yes
   X11Forwarding no
   ```

---

## 7. Integration Testing

### Pre-Test Verification

1. **Check Both Services are Running**:
   ```bash
   pm2 status  # Web app should be running
   sudo systemctl status sprinkler.service  # Backend should be active
   ```

2. **Verify Port Access**:
   ```bash
   netstat -tulpn | grep -E ':(5000|8000)'
   ```

3. **Test Individual APIs**:
   ```bash
   # Test web app
   curl -I http://localhost:5000

   # Test backend health
   curl http://localhost:8000/health

   # Test backend status
   curl http://localhost:8000/api/status
   ```

### Web Interface Testing

1. **Access Web Interface**:
   - Open browser to `http://192.168.1.100:5000`
   - You should see the sprinkler control dashboard

2. **Configure Pi Connection in Web Interface**:
   
   **⚠️ CRITICAL**: You must configure the frontend to connect to your Pi backend:
   
   - Open browser to `http://192.168.1.100:5000` (replace with your Pi's IP)
   - Navigate to **Settings** page
   - Configure **Pi Backend Connection**:
     - **Pi IP Address**: `192.168.1.100` (your Pi's actual IP address)
     - **Pi Port**: `8000`
     - **API Token**: Enter the token you generated in Security Configuration step
   - Click **"Save Settings"**
   - Click **"Test Connection"** to verify communication
   
   **Expected Result**: You should see "✓ Connection Successful" message.
   
   **If connection fails**:
   - Verify Pi IP address is correct
   - Check that both services are running (`pm2 status` and `sudo systemctl status sprinkler.service`)
   - Verify firewall allows your computer's IP (`sudo ufw status`)
   - Check API token matches exactly

3. **Test Zone Control**:
   - Go to Dashboard
   - Try turning a zone on/off
   - Verify GPIO pins change state
   - Check logs for any errors

### GPIO Testing (Without Hardware)

1. **Monitor GPIO States**:
   ```bash
   # Install gpio utility
   sudo apt install raspi-gpio

   # Monitor pin states
   watch -n 1 'raspi-gpio get 12,16,20,21'
   ```

2. **Test Zone Activation via Web Interface**:
   - Turn on Zone 1 (GPIO 12)
   - Verify pin goes HIGH
   - Turn off Zone 1
   - Verify pin goes LOW

### Backend API Testing

1. **Test Direct API Calls**:
   ```bash
   # Get system status
   curl http://localhost:8000/api/status

   # Get pin states
   curl http://localhost:8000/api/pins

   # Turn on pin 12 (with API token if required)
   curl -X POST -H "Authorization: Bearer YOUR_TOKEN" \
        http://localhost:8000/api/pin/12/on

   # Turn off pin 12
   curl -X POST -H "Authorization: Bearer YOUR_TOKEN" \
        http://localhost:8000/api/pin/12/off
   ```

2. **Check Response Formats**:
   - Status endpoint should return `{"ok": true, "backend": "pigpio"}`
   - Pins endpoint should return array of pin objects
   - Control endpoints should return success messages

### End-to-End Integration Test

1. **Complete System Test**:
   ```bash
   #!/bin/bash
   # Save as test_system.sh
   
   echo "Testing Sprinkler Control System..."
   
   # Test web app
   if curl -s -I http://localhost:5000 | grep -q "200 OK"; then
       echo "✓ Web app is running"
   else
       echo "✗ Web app failed"
       exit 1
   fi
   
   # Test backend
   if curl -s http://localhost:8000/health | grep -q "ok"; then
       echo "✓ Backend is running"
   else
       echo "✗ Backend failed"
       exit 1
   fi
   
   # Test GPIO control
   if curl -s -X POST http://localhost:8000/api/pin/12/on | grep -q "success"; then
       echo "✓ GPIO control working"
       sleep 2
       curl -s -X POST http://localhost:8000/api/pin/12/off
   else
       echo "✗ GPIO control failed"
   fi
   
   echo "System test completed!"
   ```

---

## 8. Troubleshooting

### Common Issues and Solutions

#### Web App Won't Start

**Symptoms**: PM2 shows app as stopped or errored
```bash
pm2 logs sprinkler-web
```

**Solutions**:
1. **Node.js Version Issue**:
   ```bash
   node --version  # Should be 20.x
   npm rebuild  # Rebuild native modules
   ```

2. **Port 5000 Already in Use**:
   ```bash
   sudo lsof -i :5000
   sudo kill -9 [PID]
   ```

3. **Permission Issues**:
   ```bash
   sudo chown -R pi:pi /home/pi/sprinkler-web
   npm install  # Reinstall dependencies
   ```

#### Backend Won't Start

**Symptoms**: Service fails to start or crashes
```bash
sudo journalctl -u sprinkler.service -f
```

**Solutions**:
1. **Pigpio Daemon Not Running**:
   ```bash
   sudo systemctl start pigpiod
   sudo systemctl enable pigpiod
   ```

2. **Python Dependencies Missing**:
   ```bash
   cd /home/pi/sprinkler-backend
   source venv/bin/activate
   pip install -r requirements.txt
   ```

3. **Permission Issues**:
   ```bash
   sudo chown -R pi:pi /home/pi/sprinkler-backend
   ```

#### Network Connection Issues

**Symptoms**: Web interface can't connect to Pi backend

**Solutions**:
1. **Check Firewall**:
   ```bash
   sudo ufw status
   sudo ufw allow 8000/tcp
   ```

2. **Check Service Binding**:
   ```bash
   netstat -tulpn | grep :8000
   # Should show 0.0.0.0:8000, not 127.0.0.1:8000
   ```

3. **CORS Issues**:
   - Verify ALLOWED_ORIGINS includes your web app URL
   - Check browser console for CORS errors

#### GPIO Control Issues

**Symptoms**: Pins don't change state or backend shows GPIO errors

**Solutions**:
1. **Check Pigpio Service**:
   ```bash
   sudo systemctl status pigpiod
   sudo systemctl restart pigpiod
   ```

2. **Verify GPIO Permissions**:
   ```bash
   sudo usermod -a -G gpio pi
   sudo reboot
   ```

3. **Test GPIO Manually**:
   ```bash
   # Install gpio tools
   sudo apt install raspi-gpio
   
   # Test pin 12
   raspi-gpio set 12 op dl  # Set low
   raspi-gpio set 12 op dh  # Set high
   raspi-gpio get 12        # Check state
   ```

#### Mixed Content Security Issues

**Symptoms**: Browser blocks HTTP requests from HTTPS page

**Solutions**:
1. **Access via HTTP**:
   - Use `http://192.168.1.100:5000` instead of HTTPS

2. **Allow Insecure Content**:
   - Click shield icon in browser address bar
   - Allow insecure content for this site

3. **Use Same Protocol**:
   - Ensure both web app and API use HTTP or both use HTTPS

### System Diagnostics

#### Health Check Script
```bash
#!/bin/bash
# Save as health_check.sh

echo "=== Sprinkler System Health Check ==="
echo

echo "1. System Status:"
uptime
free -h
df -h /
echo

echo "2. Network Configuration:"
ip addr show eth0 | grep inet
echo "Default gateway: $(ip route | grep default)"
echo

echo "3. Service Status:"
echo "Web App (PM2):"
pm2 list | grep sprinkler-web
echo
echo "Backend Service:"
sudo systemctl is-active sprinkler.service
echo

echo "4. Port Status:"
netstat -tulpn | grep -E ':(22|5000|8000)'
echo

echo "5. Recent Logs:"
echo "Backend logs (last 5 lines):"
sudo journalctl -u sprinkler.service -n 5 --no-pager
echo

echo "6. GPIO Status:"
if command -v raspi-gpio >/dev/null; then
    echo "GPIO pins 12,16,20,21:"
    raspi-gpio get 12,16,20,21
else
    echo "raspi-gpio not installed"
fi
echo

echo "7. Temperature:"
if [ -f /sys/class/thermal/thermal_zone0/temp ]; then
    temp=$(cat /sys/class/thermal/thermal_zone0/temp)
    echo "CPU Temperature: $((temp/1000))°C"
fi

echo "=== Health Check Complete ==="
```

#### Log Monitoring

1. **Real-time Log Monitoring**:
   ```bash
   # Monitor all logs
   sudo journalctl -f
   
   # Monitor specific service
   sudo journalctl -u sprinkler.service -f
   
   # Monitor web app
   pm2 logs sprinkler-web --lines 20 -f
   ```

2. **Log Rotation Configuration**:
   ```bash
   sudo nano /etc/logrotate.d/sprinkler
   ```
   
   Add:
   ```
   /var/log/sprinkler/*.log {
       daily
       missingok
       rotate 7
       compress
       delaycompress
       notifempty
       copytruncate
   }
   ```

---

## 9. Maintenance

### Regular Maintenance Tasks

#### Weekly Tasks

1. **Check System Health**:
   ```bash
   ./health_check.sh  # Run the diagnostic script
   ```

2. **Review Logs**:
   ```bash
   sudo journalctl -u sprinkler.service --since "1 week ago" | grep -i error
   pm2 logs sprinkler-web --lines 100
   ```

3. **Check Disk Space**:
   ```bash
   df -h
   sudo du -sh /var/log/*
   ```

#### Monthly Tasks

1. **Update System Packages**:
   ```bash
   sudo apt update && sudo apt upgrade -y
   sudo reboot
   ```

2. **Update Node.js Dependencies**:
   ```bash
   cd /home/pi/sprinkler-web
   npm update
   pm2 restart sprinkler-web
   ```

3. **Update Python Dependencies**:
   ```bash
   cd /home/pi/sprinkler-backend
   source venv/bin/activate
   pip list --outdated
   # Update specific packages if needed
   pip install --upgrade [package-name]
   ```

#### Quarterly Tasks

1. **Security Updates**:
   ```bash
   # Change passwords
   passwd pi
   
   # Review SSH logs
   sudo grep "Failed password" /var/log/auth.log
   
   # Update fail2ban rules if needed
   sudo fail2ban-client status sshd
   ```

2. **Performance Review**:
   ```bash
   # Check system performance
   top
   iotop
   
   # Check memory usage
   free -h
   
   # Check network usage
   vnstat -m
   ```

### Backup Procedures

#### Automated Backup Script

```bash
#!/bin/bash
# Save as backup_system.sh

BACKUP_DIR="/home/pi/backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="sprinkler_backup_$DATE.tar.gz"

echo "Starting system backup..."

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup application files and configurations
tar -czf "$BACKUP_DIR/$BACKUP_FILE" \
    --exclude='/home/pi/sprinkler-web/node_modules' \
    --exclude='/home/pi/sprinkler-backend/venv' \
    /home/pi/sprinkler-web \
    /home/pi/sprinkler-backend \
    /etc/systemd/system/sprinkler.service \
    /etc/dhcpcd.conf \
    /home/pi/.pm2

echo "Backup created: $BACKUP_DIR/$BACKUP_FILE"

# Keep only last 5 backups
cd $BACKUP_DIR
ls -t sprinkler_backup_*.tar.gz | tail -n +6 | xargs -r rm

echo "Backup completed!"
```

#### Database Backup (if using PostgreSQL)

```bash
#!/bin/bash
# Save as backup_database.sh

DB_NAME="sprinkler_db"
BACKUP_DIR="/home/pi/backups/database"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Backup database
pg_dump $DB_NAME > "$BACKUP_DIR/db_backup_$DATE.sql"

# Compress backup
gzip "$BACKUP_DIR/db_backup_$DATE.sql"

echo "Database backup completed: $BACKUP_DIR/db_backup_$DATE.sql.gz"
```

### System Updates

#### Safe Update Procedure

1. **Create System Backup**:
   ```bash
   ./backup_system.sh
   ```

2. **Test Current System**:
   ```bash
   ./health_check.sh
   ```

3. **Update System**:
   ```bash
   sudo apt update
   sudo apt list --upgradable
   sudo apt upgrade -y
   ```

4. **Update Application**:
   ```bash
   cd /home/pi/sprinkler-web
   git stash  # Save any local changes
   git pull origin main
   npm install
   pm2 restart sprinkler-web
   ```

5. **Update Backend**:
   ```bash
   cd /home/pi/sprinkler-backend
   source venv/bin/activate
   pip install --upgrade -r requirements.txt
   sudo systemctl restart sprinkler.service
   ```

6. **Verify System**:
   ```bash
   ./health_check.sh
   # Test web interface functionality
   ```

### Log Monitoring and Alerting

#### Log Analysis Script

```bash
#!/bin/bash
# Save as analyze_logs.sh

echo "=== System Log Analysis ==="
echo

echo "Recent Errors in Backend:"
sudo journalctl -u sprinkler.service --since "24 hours ago" | grep -i error
echo

echo "Recent Web App Errors:"
pm2 logs sprinkler-web --lines 100 | grep -i error
echo

echo "SSH Login Attempts:"
sudo grep "Failed password" /var/log/auth.log | tail -10
echo

echo "System Resource Issues:"
sudo journalctl --since "24 hours ago" | grep -E "(out of memory|disk full|high load)"
echo

echo "Network Issues:"
sudo journalctl --since "24 hours ago" | grep -E "(network|connection|timeout)"
```

#### Email Alerts Setup (Optional)

1. **Install Mail Utilities**:
   ```bash
   sudo apt install ssmtp mailutils
   ```

2. **Configure SSMTP**:
   ```bash
   sudo nano /etc/ssmtp/ssmtp.conf
   ```
   
   Add:
   ```
   root=your-email@example.com
   mailhub=smtp.gmail.com:587
   rewriteDomain=gmail.com
   AuthUser=your-email@example.com
   AuthPass=your-app-password
   fromLineOverride=YES
   useSTARTTLS=YES
   ```

3. **Create Alert Script**:
   ```bash
   #!/bin/bash
   # Save as send_alert.sh
   
   ALERT_EMAIL="your-email@example.com"
   
   if ! systemctl is-active --quiet sprinkler.service; then
       echo "Sprinkler backend service is down!" | mail -s "Pi Alert: Service Down" $ALERT_EMAIL
   fi
   
   if ! pm2 list | grep -q "sprinkler-web.*online"; then
       echo "Web application is down!" | mail -s "Pi Alert: Web App Down" $ALERT_EMAIL
   fi
   ```

4. **Add to Cron for Regular Monitoring**:
   ```bash
   crontab -e
   ```
   
   Add:
   ```
   # Check every 15 minutes
   */15 * * * * /home/pi/send_alert.sh
   
   # Daily log analysis
   0 9 * * * /home/pi/analyze_logs.sh | mail -s "Daily Pi Report" your-email@example.com
   ```

---

## Final Verification Checklist

Before considering the installation complete, verify:

- [ ] Raspberry Pi boots successfully
- [ ] Static IP address is configured and accessible
- [ ] SSH access is working
- [ ] Firewall is configured with appropriate rules
- [ ] Web application starts and is accessible on port 5000
- [ ] Backend service starts and is accessible on port 8000
- [ ] Web interface can connect to backend API
- [ ] GPIO pins can be controlled via web interface
- [ ] Both services auto-start on boot
- [ ] Backup procedures are in place
- [ ] Security measures are configured
- [ ] Documentation is available for future reference

## Support and Resources

- **Project Repository**: https://github.com/tbuell124/Sprink2
- **Raspberry Pi Documentation**: https://www.raspberrypi.org/documentation/
- **FastAPI Documentation**: https://fastapi.tiangolo.com/
- **React Documentation**: https://reactjs.org/docs/
- **GPIO Pinout Reference**: https://pinout.xyz/

## Safety Reminders

⚠️ **ELECTRICAL SAFETY**:
- Never connect high voltage directly to GPIO pins
- Always use proper relays and isolation
- Follow local electrical codes
- Use appropriate fuses and circuit protection
- Test all connections before energizing sprinkler valves

🔒 **SECURITY REMINDERS**:
- Change default passwords
- Keep system updated
- Use strong API tokens
- Monitor access logs
- Backup configurations regularly

This completes the comprehensive Raspberry Pi setup guide for the sprinkler control system. The system should now be fully operational with both the web interface and GPIO control backend working together.