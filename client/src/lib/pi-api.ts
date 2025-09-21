/**
 * Direct browser-to-Raspberry Pi communication client
 * Handles CORS, mixed content, and network connectivity issues
 */

export interface PiConnectionConfig {
  ipAddress: string;
  port?: number;
  useHttps?: boolean;
  apiToken?: string;
}

export interface PiZoneStatus {
  zone: number;
  gpio: number;
  name?: string;
  is_active: boolean;
  is_enabled: boolean;
  minutes_left?: number;
  source?: string;
}

export interface PiSystemStatus {
  version: string;
  last_updated: string;
  pins: Array<{
    pin: number;
    name?: string;
    is_active: boolean;
    is_enabled: boolean;
  }>;
  schedules: Array<{
    id: string;
    name?: string;
    start_time: string;
    days: string[];
    is_enabled: boolean;
    duration: number;
  }>;
  rain: {
    is_active: boolean;
    ends_at?: string;
    duration_hours?: number;
  };
}

export interface PiZoneControlRequest {
  minutes: number;
}

export interface PiZoneControlResponse {
  zone: number;
  gpio: number;
  on: boolean;
  minutes_left: number;
}

export class PiConnectionError extends Error {
  constructor(
    message: string,
    public readonly type: 'network' | 'auth' | 'cors' | 'mixed_content' | 'timeout' | 'server_error',
    public readonly details?: any
  ) {
    super(message);
    this.name = 'PiConnectionError';
  }
}

export class PiApiClient {
  private config: Required<PiConnectionConfig>;
  private baseUrl: string = '';

  constructor(config: PiConnectionConfig) {
    this.config = {
      port: 8000,
      useHttps: false,
      apiToken: '',
      ...config,
    };
    
    this.reconstructBaseUrl();
  }

  /**
   * Test connection to the Pi
   */
  async testConnection(): Promise<{ success: boolean; version?: string; error?: string }> {
    try {
      const response = await this.makeRequest('/status', 'GET');
      return {
        success: true,
        version: response.version || 'Unknown',
      };
    } catch (error) {
      if (error instanceof PiConnectionError) {
        return {
          success: false,
          error: error.message,
        };
      }
      return {
        success: false,
        error: 'Unknown connection error',
      };
    }
  }

  /**
   * Get system status from Pi
   */
  async getStatus(): Promise<PiSystemStatus> {
    return this.makeRequest('/status', 'GET');
  }

  /**
   * Start a zone on the Pi
   */
  async startZone(zone: number, duration: number): Promise<PiZoneControlResponse> {
    return this.makeRequest(`/zone/on/${zone}`, 'POST', { minutes: duration });
  }

  /**
   * Stop a zone on the Pi
   */
  async stopZone(zone: number): Promise<PiZoneControlResponse> {
    return this.makeRequest(`/zone/off/${zone}`, 'POST');
  }

  /**
   * Get health check from Pi (simpler endpoint)
   */
  async getHealth(): Promise<{ status: string }> {
    try {
      // Try a simple health check first
      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        headers: this.getHeaders(),
        signal: AbortSignal.timeout(5000), // 5 second timeout
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      // If /health doesn't exist, try /status as fallback
      if (error instanceof Error && error.message.includes('404')) {
        const statusResponse = await this.getStatus();
        return { status: 'ok' };
      }
      throw error;
    }
  }

  /**
   * Update Pi connection configuration
   */
  updateConfig(newConfig: Partial<PiConnectionConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.reconstructBaseUrl();
  }

  /**
   * Reconstruct base URL to avoid double port issues
   */
  private reconstructBaseUrl(): void {
    const protocol = this.config.useHttps ? 'https' : 'http';
    
    // Remove any existing port from IP address to avoid duplication
    const cleanIpAddress = this.config.ipAddress.replace(/:\d+$/, '');
    
    this.baseUrl = `${protocol}://${cleanIpAddress}:${this.config.port}`;
  }

  /**
   * Make a request to the Pi with proper error handling
   */
  private async makeRequest(endpoint: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE', body?: any): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout (reduced)

      const response = await fetch(url, {
        method,
        headers: this.getHeaders(),
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
        // Important: Allow cross-origin requests
        mode: 'cors',
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 401) {
          throw new PiConnectionError(
            'Authentication failed. Check your API token.',
            'auth',
            { status: response.status, statusText: response.statusText }
          );
        }

        if (response.status >= 500) {
          throw new PiConnectionError(
            `Pi server error: ${response.statusText}`,
            'server_error',
            { status: response.status, statusText: response.statusText }
          );
        }

        const errorText = await response.text().catch(() => response.statusText);
        throw new PiConnectionError(
          `HTTP ${response.status}: ${errorText}`,
          'server_error',
          { status: response.status, statusText: response.statusText }
        );
      }

      return await response.json();

    } catch (error) {
      if (error instanceof PiConnectionError) {
        throw error;
      }

      if (error instanceof DOMException) {
        if (error.name === 'AbortError') {
          throw new PiConnectionError(
            'Request timed out. Check if Pi is reachable on the network.',
            'timeout',
            error
          );
        }
      }

      if (error instanceof TypeError) {
        // Network error, CORS, or mixed content
        const errorMessage = error.message.toLowerCase();
        
        // In demo mode, suppress verbose error messages for expected failures
        const isDemoMode = this.config.ipAddress === '192.168.1.100' && !this.config.apiToken;
        
        if (errorMessage.includes('cors')) {
          throw new PiConnectionError(
            isDemoMode ? 'Pi not available (demo mode)' : 'CORS error. Make sure the Pi allows cross-origin requests from your browser.',
            'cors',
            error
          );
        }

        if (errorMessage.includes('mixed content') || errorMessage.includes('https')) {
          throw new PiConnectionError(
            isDemoMode ? 'Pi not available (demo mode)' : 'Mixed content error. Try using HTTPS or accessing this page over HTTP.',
            'mixed_content',
            error
          );
        }

        if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
          throw new PiConnectionError(
            isDemoMode ? 'Pi offline (demo mode)' : `Network error: Unable to reach Pi at ${this.config.ipAddress}:${this.config.port}. Check IP address and network connectivity.`,
            'network',
            error
          );
        }
      }

      // Generic error
      throw new PiConnectionError(
        `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'network',
        error
      );
    }
  }

  /**
   * Get headers for Pi requests
   */
  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    if (this.config.apiToken) {
      headers['Authorization'] = `Bearer ${this.config.apiToken}`;
    }

    return headers;
  }

  /**
   * Get connection info for debugging
   */
  getConnectionInfo(): { url: string; hasToken: boolean } {
    return {
      url: this.baseUrl,
      hasToken: !!this.config.apiToken,
    };
  }
}

/**
 * Create a Pi API client instance
 */
export function createPiApiClient(config: PiConnectionConfig): PiApiClient {
  return new PiApiClient(config);
}

/**
 * Get Pi configuration from localStorage
 */
export function getPiConfigFromStorage(): PiConnectionConfig {
  const ipAddress = localStorage.getItem('piIpAddress') || '192.168.1.100';
  const port = parseInt(localStorage.getItem('piPort') || '8000');
  const useHttps = localStorage.getItem('piUseHttps') === 'true';
  const apiToken = localStorage.getItem('piApiToken') || '';

  return { ipAddress, port, useHttps, apiToken };
}

/**
 * Check if we're in demo mode (no actual Pi configured)
 */
export function isDemoMode(): boolean {
  const config = getPiConfigFromStorage();
  return config.ipAddress === '192.168.1.100' && !config.apiToken;
}

/**
 * Save Pi configuration to localStorage
 */
export function savePiConfigToStorage(config: Partial<PiConnectionConfig>): void {
  if (config.ipAddress) localStorage.setItem('piIpAddress', config.ipAddress);
  if (config.port !== undefined) localStorage.setItem('piPort', config.port.toString());
  if (config.useHttps !== undefined) localStorage.setItem('piUseHttps', config.useHttps.toString());
  if (config.apiToken !== undefined) localStorage.setItem('piApiToken', config.apiToken);
}

/**
 * Network troubleshooting suggestions
 */
export function getNetworkTroubleshootingTips(error: PiConnectionError): string[] {
  const tips: string[] = [];

  switch (error.type) {
    case 'network':
      tips.push(
        'Check that the Raspberry Pi is powered on and connected to your network',
        'Verify the IP address is correct (try pinging it from your computer)',
        'Make sure both your browser and Pi are on the same network',
        'Check if the Pi\'s firewall is blocking port 8000'
      );
      break;

    case 'cors':
      tips.push(
        'The Pi should allow CORS by default, but check the server logs',
        'Try accessing the Pi directly in your browser: http://[PI_IP]:8000/status',
        'Restart the sprinkler service on the Pi'
      );
      break;

    case 'mixed_content':
      tips.push(
        'You\'re accessing this page over HTTPS but the Pi uses HTTP',
        'Either: Access this page over HTTP, or configure the Pi to use HTTPS',
        'Or: Use the "Allow insecure content" option in your browser settings'
      );
      break;

    case 'auth':
      tips.push(
        'Check that the API token is correctly configured',
        'The token should match the SPRINKLER_API_TOKEN environment variable on the Pi',
        'Try leaving the token empty if the Pi doesn\'t require authentication'
      );
      break;

    case 'timeout':
      tips.push(
        'The Pi is taking too long to respond',
        'Check your network connection speed',
        'The Pi might be overloaded - try restarting it',
        'Check if there are network latency issues'
      );
      break;

    case 'server_error':
      tips.push(
        'The Pi returned an error - check the Pi\'s logs',
        'The sprinkler service might need to be restarted',
        'Check if the Pi has enough disk space and memory'
      );
      break;
  }

  return tips;
}