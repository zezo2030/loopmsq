import { SetMetadata } from '@nestjs/common';

export enum UserRole {
  USER = 'user',
  STAFF = 'staff',
  ADMIN = 'admin',
}

export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
