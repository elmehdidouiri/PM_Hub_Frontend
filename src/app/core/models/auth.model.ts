 
export interface LoginRequest {
  email: string;
  password: string;
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
