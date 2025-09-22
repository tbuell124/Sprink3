# Sprinkler Controller Authentication Setup

## Overview

This sprinkler control system uses environment variables for secure credential management. **Never hardcode usernames and passwords directly in the code or configuration files.**

## Quick Setup for Your System

Since your Raspberry Pi uses the username `tybuell`, follow these steps to set up authentication:

### 1. Set Environment Variables

Create a `.env` file in your project root with your credentials:

```bash
# Admin user credentials for web interface
ADMIN_USERNAME=tybuell
ADMIN_PASSWORD=your_secure_password_here
ADMIN_EMAIL=tybuell@sprinkler.local
ADMIN_FIRST_NAME=Your_First_Name
ADMIN_LAST_NAME=Your_Last_Name
```

**Security Note**: Replace `your_secure_password_here` with your actual password. Never commit the `.env` file to version control.

### 2. For Development (Local Testing)

If running the web app locally for development:

```bash
# In your project directory
echo "ADMIN_USERNAME=tybuell" >> .env
echo "ADMIN_PASSWORD=sprinkler" >> .env
echo "ADMIN_EMAIL=tybuell@sprinkler.local" >> .env
```

### 3. For Production (Raspberry Pi)

On your Raspberry Pi, set environment variables in the systemd service:

```bash
# Edit the service file
sudo nano /etc/systemd/system/sprinkler.service

# Add these lines in the [Service] section:
Environment=ADMIN_USERNAME=tybuell
Environment=ADMIN_PASSWORD=your_secure_password
Environment=ADMIN_EMAIL=tybuell@sprinkler.local
Environment=NODE_ENV=production

# Reload and restart
sudo systemctl daemon-reload
sudo systemctl restart sprinkler.service
```

## Changing Credentials

### To Update Username or Password:

1. **For local development**: Update your `.env` file
2. **For Raspberry Pi**: Update the systemd service environment variables
3. Restart the application

### Steps:

```bash
# Stop the service
sudo systemctl stop sprinkler.service

# Edit service file
sudo nano /etc/systemd/system/sprinkler.service

# Update the Environment variables:
Environment=ADMIN_USERNAME=new_username
Environment=ADMIN_PASSWORD=new_password

# Save file and restart
sudo systemctl daemon-reload
sudo systemctl start sprinkler.service
```

## Security Best Practices

### ✅ DO:
- Use environment variables for all credentials
- Use strong, unique passwords
- Keep your `.env` file out of version control
- Regularly update passwords
- Use proper file permissions (600) on credential files

### ❌ DON'T:
- Hardcode passwords in source code
- Commit `.env` files to Git
- Share passwords in plain text
- Use default or weak passwords
- Run services as root user

## Authentication Flow

1. **Web Interface Login**: Users log in with the username/password set in environment variables
2. **Session Management**: The system creates secure sessions for logged-in users
3. **API Access**: All API endpoints require authentication

## Troubleshooting

### "Server configuration error" message:
- Ensure `ADMIN_PASSWORD` environment variable is set
- Check spelling of environment variable names
- Verify the service has been restarted after changes

### Cannot log in:
- Verify username and password match environment variables
- Check service logs: `sudo journalctl -u sprinkler.service -f`
- Ensure the user was created successfully in the database

### Service won't start:
- Check environment variables are properly set
- Verify no special characters are breaking the configuration
- Check system logs for detailed error messages

## Environment Variables Reference

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `ADMIN_USERNAME` | No | Admin username (default: 'admin') | `tybuell` |
| `ADMIN_PASSWORD` | **Yes** | Admin password (no default) | `your_secure_password` |
| `ADMIN_EMAIL` | No | Admin email address | `tybuell@sprinkler.local` |
| `ADMIN_FIRST_NAME` | No | Admin first name (default: 'Admin') | `Tyler` |
| `ADMIN_LAST_NAME` | No | Admin last name (default: 'User') | `Buell` |

## Example Service Configuration

Complete systemd service file example:

```ini
[Unit]
Description=Sprinkler Control Web App
After=network.target

[Service]
Type=simple
User=tybuell
Group=tybuell
WorkingDirectory=/home/tybuell/sprinkler-app
ExecStart=/usr/bin/node server/index.js
Restart=always
RestartSec=10

# Environment variables for authentication
Environment=NODE_ENV=production
Environment=ADMIN_USERNAME=tybuell
Environment=ADMIN_PASSWORD=your_secure_password
Environment=ADMIN_EMAIL=tybuell@sprinkler.local
Environment=ADMIN_FIRST_NAME=Tyler
Environment=ADMIN_LAST_NAME=Buell

# Security settings
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=read-only
ReadWritePaths=/home/tybuell/sprinkler-app

[Install]
WantedBy=multi-user.target
```

## Support

If you need to change your username or password in the future, simply update the environment variables and restart the service. The system will automatically update the database with the new credentials.