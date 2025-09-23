# Sprinkler Control System

## Overview

A modern web-based sprinkler control system built with React, Express, and PostgreSQL. Features mobile-optimized interface, comprehensive schedule management, zone settings, secure authentication, and intelligent rain delay functionality.

## 🚀 Quick Deployment

For **production deployment** on Raspberry Pi, use the **validated deployment guide**:

**📖 [DEPLOYMENT_GUIDE_VALIDATED.md](./DEPLOYMENT_GUIDE_VALIDATED.md)** ← **Use This for Pi Setup**

The validated guide includes:
- ✅ **Correct Node.js 20+ requirements** 
- ✅ **Proper security configuration**
- ✅ **Working GPIO backend integration**
- ✅ **Complete network & firewall setup**
- ✅ **Production-ready systemd services**

## System Requirements

- **Raspberry Pi 4** (recommended) with Raspberry Pi OS
- **Node.js 20+** (required - do not use Node.js 18)
- **GPIO hardware**: 16-channel relay module for sprinkler valve control
- **Network connectivity** for web interface access


## (Optional) RESET

This is the most reliable approach to ensure there are no leftover files.

Stop any running services
If your sprinkler app is running as a service, stop it first:

sudo systemctl stop sprinkler.service


Navigate to the home directory

cd /home/tybuell


Delete the existing Sprink folder

rm -rf Sprink


This permanently deletes all files in the folder.

Clone the repository fresh

git clone https://github.com/tbuell124/Sprink2.git Sprink


Verify the structure

cd Sprink
ls -la


You should see a clean directory with only the files from GitHub.

-----------------------------

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

### Step 2: Install Dependencies

**⚠️ IMPORTANT**: Do NOT modify `vite.config.ts` or `server/vite.ts` - they work correctly as-is with Node.js 20+.

```bash
# Install all dependencies (works with current configuration)
npm install
```

### Step 3: Configure Environment

```bash
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
