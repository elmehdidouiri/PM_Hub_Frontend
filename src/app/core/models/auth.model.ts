 
export interface LoginRequest {
  email: string;
  password: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface VerifyResetCodeRequest {
  email: string;
  code: string;
}

export interface VerifyResetCodeResponse {
  resetToken: string;
}

export interface ResetPasswordRequest {
  email: string;
  resetToken: string;
  newPassword: string;
  confirmPassword: string;
}

 
export interface RegisterRequest {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  roleId: string;
}

 
export interface AuthResponse {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  roleName: string;
  isAdmin: boolean;
  token: string;
  refreshToken?: string;
}
