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
  accessToken?: string;
  refreshToken?: string;
  token?: string;
  jwt?: string;
  username?: string;
  email?: string;
  fullName?: string;
}

export interface AuthValidationResponse {
  valid: boolean;
  userId?: number | string;
  username?: string;
  email?: string;
  fullName?: string;
  phone?: string;
  error?: string;
}

export interface SignupResponse {
  message: string;
  username: string;
  email: string;
}

export interface User {
  id?: number;
  username: string;
  email: string;
  fullName?: string;
  phone?: string;
  roles?: string[];
}

export interface UserProfileResponse {
  id: number;
  username: string;
  email: string;
  fullName?: string;
  phone?: string;
}

export interface UpdateUserProfileRequest {
  email: string;
  fullName: string;
  phone?: string;
}

export interface UpdatePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ForgotPasswordResponse {
  message: string;
}

export interface ResetPasswordRequest {
  email: string;
  code: string;
  newPassword: string;
}

export interface ResetPasswordResponse {
  message: string;
}
