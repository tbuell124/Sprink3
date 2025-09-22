#!/usr/bin/env python3
"""
Raspberry Pi GPIO Sprinkler Control Backend
FastAPI server for controlling sprinkler zones via GPIO pins
"""

import os
import asyncio
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, BackgroundTasks, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field
import uvicorn

# GPIO control - handles both real hardware and simulation
try:
    import pigpio
    HAS_PIGPIO = True
except ImportError:
    HAS_PIGPIO = False
    print("Warning: pigpio not available. Running in simulation mode.")

# Configuration
SPRINKLER_API_TOKEN = os.getenv("SPRINKLER_API_TOKEN", "")
DEFAULT_PORT = int(os.getenv("PORT", "8000"))
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:5000,https://localhost:5000").split(",")
GPIO_PINS = [12, 16, 20, 21, 26, 19, 13, 6, 5, 11, 9, 10, 22, 27, 17, 4]
DENIED_PINS = [2, 3, 14, 15, 18]  # Critical system pins to avoid (removed pin 4 conflict)

# Global state
pi = None
pin_states: Dict[int, str] = {}
active_timers: Dict[int, asyncio.Task] = {}

# Security
security = HTTPBearer(auto_error=False)

# Authentication dependency
async def verify_auth_token(authorization: HTTPAuthorizationCredentials = Depends(security)):
    """Verify authentication token for mutating endpoints"""
    # If no token is configured, skip authentication (for local development)
    if not SPRINKLER_API_TOKEN:
        return True
    
    if not authorization:
        raise HTTPException(
            status_code=401,
            detail="Authentication required. Provide API token in Authorization header.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if authorization.credentials != SPRINKLER_API_TOKEN:
        raise HTTPException(
            status_code=401,
            detail="Invalid API token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    return True

# Models
class PinControlRequest(BaseModel):
    duration: Optional[int] = Field(10, description="Duration in minutes for auto-off (default: 10 minutes)")

class PinStatus(BaseModel):
    id: int
    name: str
    enabled: bool
    state: str  # 'on' or 'off'

class SystemStatus(BaseModel):
    ok: bool
    pins: List[int]
    allow_mode: str
    deny: List[int]
    backend: str
    pigpio_connected: bool

class PinControlResponse(BaseModel):
    pin: int
    state: str
    success: bool
    message: Optional[str] = None

# GPIO Control Class
class GPIOController:
    def __init__(self):
        self.pi = None
        self.connected = False
        
    async def initialize(self):
        """Initialize GPIO connection"""
        if HAS_PIGPIO:
            try:
                self.pi = pigpio.pi()
                if self.pi.connected:
                    self.connected = True
                    # Set all sprinkler pins to output mode, initially off
                    for pin in GPIO_PINS:
                        self.pi.set_mode(pin, pigpio.OUTPUT)
                        self.pi.write(pin, 0)  # Start with all zones off
                        pin_states[pin] = 'off'
                    logging.info(f"GPIO initialized. Connected pins: {GPIO_PINS}")
                else:
                    logging.error("Failed to connect to pigpio daemon")
            except Exception as e:
                logging.error(f"GPIO initialization failed: {e}")
        else:
            # Simulation mode
            self.connected = False
            for pin in GPIO_PINS:
                pin_states[pin] = 'off'
            logging.info("Running in simulation mode (no pigpio)")
    
    async def cleanup(self):
        """Cleanup GPIO connections"""
        if self.pi and self.connected:
            # Turn off all pins before cleanup
            for pin in GPIO_PINS:
                self.pi.write(pin, 0)
            self.pi.stop()
            
        # Cancel any active timers
        for task in active_timers.values():
            if not task.done():
                task.cancel()
        active_timers.clear()
    
    def set_pin(self, pin: int, state: bool) -> bool:
        """Set pin state (True = on, False = off)"""
        if pin not in GPIO_PINS:
            raise ValueError(f"Pin {pin} not in allowed pins list")
            
        if self.pi and self.connected:
            try:
                self.pi.write(pin, 1 if state else 0)
                pin_states[pin] = 'on' if state else 'off'
                logging.info(f"Pin {pin} set to {'ON' if state else 'OFF'}")
                return True
            except Exception as e:
                logging.error(f"Failed to set pin {pin}: {e}")
                return False
        else:
            # Simulation mode
            pin_states[pin] = 'on' if state else 'off'
            logging.info(f"[SIMULATION] Pin {pin} set to {'ON' if state else 'OFF'}")
            return True
    
    def get_pin_state(self, pin: int) -> str:
        """Get current pin state"""
        return pin_states.get(pin, 'off')
    
    def get_all_pins(self) -> List[PinStatus]:
        """Get status of all pins"""
        pins = []
        for i, pin in enumerate(GPIO_PINS):
            pins.append(PinStatus(
                id=pin,
                name=f"Zone {i + 1}",
                enabled=pin not in DENIED_PINS,
                state=self.get_pin_state(pin)
            ))
        return pins

# Initialize GPIO controller
gpio = GPIOController()

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifespan"""
    # Startup
    await gpio.initialize()
    logging.info("Sprinkler GPIO backend started")
    yield
    # Shutdown
    await gpio.cleanup()
    logging.info("Sprinkler GPIO backend stopped")

# Create FastAPI app
app = FastAPI(
    title="Sprinkler GPIO Control",
    description="Raspberry Pi GPIO control for sprinkler zones",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware with restricted origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,  # Restricted to specific origins for security
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],  # Only necessary methods
    allow_headers=["Content-Type", "Authorization", "Accept"],  # Only necessary headers
)

# Auto-off timer function
async def auto_off_timer(pin: int, duration_minutes: int):
    """Turn off pin after specified duration"""
    try:
        await asyncio.sleep(duration_minutes * 60)
        gpio.set_pin(pin, False)
        logging.info(f"Auto-off: Pin {pin} turned off after {duration_minutes} minutes")
        
        # Remove timer from active list
        if pin in active_timers:
            del active_timers[pin]
            
    except asyncio.CancelledError:
        logging.info(f"Auto-off timer for pin {pin} was cancelled")

# API Endpoints

@app.get("/api/status", response_model=SystemStatus)
async def get_system_status():
    """Get system status and configuration"""
    return SystemStatus(
        ok=True,
        pins=GPIO_PINS,
        allow_mode="whitelist",
        deny=DENIED_PINS,
        backend="pigpio" if gpio.connected else "simulation",
        pigpio_connected=gpio.connected
    )

@app.get("/api/pins", response_model=List[PinStatus])
async def get_pins():
    """Get status of all GPIO pins"""
    return gpio.get_all_pins()

@app.get("/api/pin/{pin}")
async def get_pin_status(pin: int):
    """Get status of specific pin"""
    if pin not in GPIO_PINS:
        raise HTTPException(status_code=404, detail=f"Pin {pin} not found")
    
    return {
        "pin": pin,
        "state": gpio.get_pin_state(pin),
        "enabled": pin not in DENIED_PINS
    }

@app.post("/api/pin/{pin}/on", response_model=PinControlResponse)
async def turn_pin_on(
    pin: int, 
    request: PinControlRequest = PinControlRequest(), 
    background_tasks: BackgroundTasks = None,
    authenticated: bool = Depends(verify_auth_token)
):
    """Turn on a GPIO pin with optional auto-off timer"""
    if pin not in GPIO_PINS:
        raise HTTPException(status_code=404, detail=f"Pin {pin} not available")
    
    if pin in DENIED_PINS:
        raise HTTPException(status_code=403, detail=f"Pin {pin} is denied for safety")
    
    # Cancel any existing timer for this pin
    if pin in active_timers:
        active_timers[pin].cancel()
        del active_timers[pin]
    
    # Turn on the pin
    success = gpio.set_pin(pin, True)
    
    if not success:
        raise HTTPException(status_code=500, detail="Failed to control GPIO pin")
    
    message = f"Pin {pin} turned on"
    
    # Set up auto-off timer (use provided duration or default 10 minutes)
    duration = request.duration if request.duration and request.duration > 0 else 10
    timer_task = asyncio.create_task(auto_off_timer(pin, duration))
    active_timers[pin] = timer_task
    message += f" for {duration} minutes"
    
    return PinControlResponse(
        pin=pin,
        state='on',
        success=True,
        message=message
    )

@app.post("/api/pin/{pin}/off", response_model=PinControlResponse)
async def turn_pin_off(pin: int, authenticated: bool = Depends(verify_auth_token)):
    """Turn off a GPIO pin"""
    if pin not in GPIO_PINS:
        raise HTTPException(status_code=404, detail=f"Pin {pin} not available")
    
    # Cancel any existing timer for this pin
    if pin in active_timers:
        active_timers[pin].cancel()
        del active_timers[pin]
    
    # Turn off the pin
    success = gpio.set_pin(pin, False)
    
    if not success:
        raise HTTPException(status_code=500, detail="Failed to control GPIO pin")
    
    return PinControlResponse(
        pin=pin,
        state='off',
        success=True,
        message=f"Pin {pin} turned off"
    )

@app.post("/api/emergency-stop")
async def emergency_stop(authenticated: bool = Depends(verify_auth_token)):
    """Turn off all pins immediately"""
    stopped_pins = []
    
    # Cancel all timers
    for pin, task in active_timers.items():
        task.cancel()
    active_timers.clear()
    
    # Turn off all pins
    for pin in GPIO_PINS:
        if gpio.get_pin_state(pin) == 'on':
            gpio.set_pin(pin, False)
            stopped_pins.append(pin)
    
    return {
        "success": True,
        "message": f"Emergency stop: {len(stopped_pins)} pins turned off",
        "stopped_pins": stopped_pins
    }

@app.get("/health")
async def health_check():
    """Simple health check endpoint"""
    return {
        "status": "ok",
        "timestamp": datetime.now().isoformat(),
        "gpio_connected": gpio.connected
    }

# Development/debugging endpoints
@app.get("/api/debug/timers")
async def get_active_timers():
    """Get information about active auto-off timers"""
    timer_info = {}
    for pin, task in active_timers.items():
        timer_info[pin] = {
            "active": not task.done(),
            "cancelled": task.cancelled()
        }
    return timer_info

if __name__ == "__main__":
    # Configure logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    # Run the server
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=DEFAULT_PORT,
        reload=False,  # Disable in production
        access_log=True
    )