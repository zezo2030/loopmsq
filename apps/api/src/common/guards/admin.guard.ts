import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { UserRole } from '../decorators/roles.decorator';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const roles: UserRole[] = req.user?.roles || [];
    return roles.includes(UserRole.ADMIN) || roles.includes(UserRole.BRANCH_MANAGER);
  }
}


