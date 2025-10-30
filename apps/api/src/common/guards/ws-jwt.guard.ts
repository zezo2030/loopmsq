import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class WsJwtGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService, private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean | Promise<boolean> {
    const client = context.switchToWs().getClient();
    const handshake = client?.handshake || {};

    // Try headers.authorization or query.token
    const headerAuth: string | undefined = handshake.headers?.authorization;
    const queryToken: string | undefined = handshake.query?.token as string | undefined;
    const token = this.extractToken(headerAuth) || queryToken;

    if (!token) return false;

    try {
      const secret = this.config.get<string>('JWT_SECRET');
      const payload = this.jwtService.verify(token, secret ? { secret } : undefined);
      // attach user to socket for downstream usage
      client.user = payload;
      return true;
    } catch {
      return false;
    }
  }

  private extractToken(authHeader?: string): string | null {
    if (!authHeader) return null;
    const [type, token] = authHeader.split(' ');
    if (type?.toLowerCase() === 'bearer' && token) return token;
    return null;
  }
}


