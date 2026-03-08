export interface User {
  id: string;
  email: string;
  displayName: string;
  createdAt: Date;
}

export interface AuthTokenPayload {
  sub: string; // user id
  email: string;
  iat?: number;
  exp?: number;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  displayName: string;
}

export interface AuthResponse {
  accessToken: string;
  user: User;
}
