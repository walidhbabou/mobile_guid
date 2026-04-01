export interface LoginRequest {
  username: string;
  password: string;
}

export interface SignupRequest {
  username: string;
  email: string;
  password: string;
  fullName?: string;
  phone?: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  username?: string;
  email?: string;
  fullName?: string;
}

export interface SignupResponse {
  message: string;
  username: string;
  email: string;
}

export interface User {
  username: string;
  email: string;
  fullName?: string;
  phone?: string;
  roles?: string[];
}
