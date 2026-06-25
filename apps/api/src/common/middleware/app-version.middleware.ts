import { Injectable, NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response, NextFunction } from 'express';
import { AdminConfigService } from '../../modules/admin-config/admin-config.service';

/**
 * Server-side minimum app-version gate for the customer app (`kantic`).
 *
 * Runs before any guard on every route and rejects requests coming from
 * too-old customer builds with HTTP 426 (Upgrade Required). Unlike the
 * client-side `/app/version` check, this works even for "pre-gate" builds that
 * never shipped with the force-update code — they simply send no app-version
 * header and are caught by the `blockLegacy` branch.
 *
 * Client identification (see plan):
 *   - `X-App-Name: customer` + `X-App-Version` -> compared against min required.
 *   - `X-App-Name: staff`                       -> ignored (out of scope).
 *   - browser (has Origin/Referer)              -> ignored (admin/branch web).
 *   - non-Dart User-Agent                       -> ignored (webhooks, S2S).
 *   - native Dart client with no app-name       -> legacy customer -> blocked
 *                                                  when `blockLegacy` is on.
 */
@Injectable()
export class AppVersionMiddleware implements NestMiddleware {
  // Paths (after the global API prefix is stripped) that must always pass —
  // system, public callbacks, and the browser-based dashboards.
  private static readonly EXCLUDED_PREFIXES = [
    '/app/version', // mobile must reach this to read the config
    '/payments/webhook', // payment gateway -> server, no auth
    '/payments/success', // payment redirect landing
    '/admin', // admin dashboard (browser)
    '/uploads', // static files
    '/queues', // bull-board dashboard
    '/docs', // swagger
  ];

  constructor(
    private readonly adminConfig: AdminConfigService,
    private readonly config: ConfigService,
  ) {}

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    let cfg: Awaited<ReturnType<AdminConfigService['getAppVersionConfig']>>;
    try {
      cfg = await this.adminConfig.getAppVersionConfig();
    } catch {
      // Fail open — never take the API down because the config store is flaky.
      return next();
    }

    if (!cfg.serverEnforced) return next();
    if (this.isExcluded(this.normalizedPath(req))) return next();

    const appName = this.header(req, 'x-app-name');
    if (appName === 'staff') return next();

    const platform =
      this.header(req, 'x-app-platform') === 'ios' ||
      /iphone|ipad|ios/i.test(this.header(req, 'user-agent'))
        ? 'ios'
        : 'android';

    if (appName === 'customer') {
      const current = this.header(req, 'x-app-version') || '0.0.0';
      const min = this.minVersion(cfg, platform);
      if (AppVersionMiddleware.isVersionBelow(current, min)) {
        return this.block(res, cfg, platform);
      }
      return next();
    }

    // No app-name header: distinguish a legacy native customer build from
    // browsers and server-to-server callers.
    const isBrowser =
      !!this.header(req, 'origin') || !!this.header(req, 'referer');
    if (isBrowser) return next();

    const isNativeDart = /dart|flutter/i.test(this.header(req, 'user-agent'));
    if (!isNativeDart) return next();

    if (cfg.blockLegacy) return this.block(res, cfg, platform);
    return next();
  }

  private block(
    res: Response,
    cfg: Awaited<ReturnType<AdminConfigService['getAppVersionConfig']>>,
    platform: 'ios' | 'android',
  ): void {
    res.status(426).json({
      statusCode: 426,
      code: 'UPGRADE_REQUIRED',
      minRequiredVersion: this.minVersion(cfg, platform) || '0.0.0',
      storeUrl: (platform === 'ios' ? cfg.iosStoreUrl : cfg.androidStoreUrl) || '',
      message: cfg.message || '',
    });
  }

  private minVersion(
    cfg: Awaited<ReturnType<AdminConfigService['getAppVersionConfig']>>,
    platform: 'ios' | 'android',
  ): string {
    return platform === 'ios'
      ? cfg.minRequiredVersionIos
      : cfg.minRequiredVersionAndroid;
  }

  private header(req: Request, name: string): string {
    const raw = req.headers[name];
    const value = Array.isArray(raw) ? raw[0] : raw;
    return (value || '').toString().trim().toLowerCase();
  }

  /** Request path without query string and without the global API prefix. */
  private normalizedPath(req: Request): string {
    const prefix =
      '/' +
      (this.config.get<string>('API_PREFIX') || 'api/v1').replace(
        /^\/+|\/+$/g,
        '',
      );
    let path = (req.originalUrl || req.url || '').split('?')[0];
    if (path === prefix) return '/';
    if (path.startsWith(prefix + '/')) path = path.slice(prefix.length);
    return path || '/';
  }

  private isExcluded(path: string): boolean {
    return AppVersionMiddleware.EXCLUDED_PREFIXES.some(
      (p) => path === p || path.startsWith(p + '/'),
    );
  }

  /**
   * Returns true if `current` is strictly older than `minimum`, using a
   * 3-segment semantic comparison (major.minor.patch). Build suffixes (`+N`)
   * are ignored. Mirrors the Flutter `ForceUpdateService._isBelow`.
   */
  static isVersionBelow(current: string, minimum: string): boolean {
    const c = AppVersionMiddleware.parse(current);
    const m = AppVersionMiddleware.parse(minimum);
    for (let i = 0; i < 3; i++) {
      if (c[i] < m[i]) return true;
      if (c[i] > m[i]) return false;
    }
    return false;
  }

  private static parse(version: string): number[] {
    const clean = String(version || '').split('+')[0].trim();
    const parts = clean.split('.');
    return [0, 1, 2].map((i) => {
      const n = parseInt((parts[i] || '').trim(), 10);
      return Number.isFinite(n) ? n : 0;
    });
  }
}
