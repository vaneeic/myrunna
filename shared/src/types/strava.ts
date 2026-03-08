export interface StravaTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // Unix timestamp
  athleteId: number;
  scope: string;
}

export interface StravaActivity {
  id: string;
  userId: string;
  stravaId: string;
  name: string;
  type: string;
  distance: number; // metres
  movingTime: number; // seconds
  elapsedTime: number; // seconds
  startDate: Date;
  averageHeartrate?: number;
  maxHeartrate?: number;
  averageCadence?: number;
  sufferScore?: number;
}

export interface StravaAthlete {
  id: number;
  firstname: string;
  lastname: string;
  profile: string;
  city?: string;
  country?: string;
}

export interface StravaSyncResult {
  imported: number;
  updated: number;
  errors: number;
}

export interface StravaConnectionStatus {
  connected: boolean;
  athleteId?: number;
  athleteName?: string;
  scope?: string;
  expiresAt?: number;
}
