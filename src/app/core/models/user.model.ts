 
export interface User {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  roleName: string;
  isAdmin: boolean;
}

 
export function getUserFullName(user: User): string {
  return `${user.firstName} ${user.lastName}`;
}