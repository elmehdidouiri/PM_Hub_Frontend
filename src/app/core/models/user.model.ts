export enum MemberType {
  Employee = 1,
  Subcontractor = 2
}

export interface User {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  roleName: string;
  isAdmin: boolean;
  memberType?: MemberType;
}

export interface UserDto {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  roleId?: string;
  roleName?: string;
  isAdmin: boolean;
  isApproved: boolean;
  isActive: boolean;
  memberType?: MemberType; 
  createdAt: string;
  updatedAt?: string;
}

export interface UpdateUserDto {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  roleId?: string;
  isActive?: boolean;
  memberType?: MemberType;
}
 
export function getUserFullName(user: User | UserDto): string {
  return `${user.firstName} ${user.lastName}`;
}