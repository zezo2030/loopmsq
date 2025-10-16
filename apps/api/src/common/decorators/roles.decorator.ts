import { SetMetadata } from '@nestjs/common';

export enum UserRole {
  USER = 'user',
  BRANCH_MANAGER = 'branch_manager',
  STAFF = 'staff',
  ADMIN = 'admin',
}

export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
