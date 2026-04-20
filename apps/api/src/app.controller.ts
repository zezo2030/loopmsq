import { Controller, Get, Header, Query, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { AppService } from './app.service';

@ApiTags('health')
@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly configService: ConfigService,
  ) {}

  private getAppBaseUrl(): string {
    return (
      this.configService.get<string>('GIFT_APP_BASE_URL') ||
      this.configService.get<string>('APP_BASE_URL') ||
      'https://kinetic-app-sa.org'
    ).replace(/\/+$/, '');
  }

  private getAndroidPackageName(): string {
    return (
      this.configService.get<string>('ANDROID_APP_PACKAGE') ||
      'com.company.kinetic'
    ).trim();
  }

  private getIosAppId(): string {
    const bundleId =
      this.configService.get<string>('IOS_APP_BUNDLE_ID') ||
      'com.example.userApp';
    const teamId = this.configService.get<string>('IOS_TEAM_ID') || 'TEAMID';
    return `${teamId}.${bundleId}`;
  }

  private getAndroidStoreUrl(): string {
    return (
      this.configService.get<string>('ANDROID_STORE_URL') ||
      `https://play.google.com/store/apps/details?id=${this.getAndroidPackageName()}`
    );
  }

  private getIosStoreUrl(): string {
    return (
      this.configService.get<string>('IOS_STORE_URL') ||
      'https://apps.apple.com/'
    );
  }

  @Get()
  @ApiOperation({ summary: 'Application health check' })
  @ApiResponse({ status: 200, description: 'Application is healthy' })
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  @ApiOperation({ summary: 'Detailed health check' })
  @ApiResponse({ status: 200, description: 'Health status' })
  getHealth() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
    };
  }

  @Get('.well-known/assetlinks.json')
  @Header('Content-Type', 'application/json')
  getAssetLinks() {
    const fingerprints = (
      this.configService.get<string>('ANDROID_SHA256_FINGERPRINTS') || ''
    )
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

    return [
      {
        relation: ['delegate_permission/common.handle_all_urls'],
        target: {
          namespace: 'android_app',
          package_name: this.getAndroidPackageName(),
          sha256_cert_fingerprints: fingerprints,
        },
      },
    ];
  }

  @Get('.well-known/apple-app-site-association')
  @Header('Content-Type', 'application/json')
  getAppleAppSiteAssociation() {
    return {
      applinks: {
        apps: [],
        details: [
          {
            appID: this.getIosAppId(),
            paths: ['/gift/claim/*', '/gift/claim'],
          },
        ],
      },
    };
  }

  @Get('gift/claim')
  async getGiftClaimLanding(
    @Query('token') token: string,
    @Res() res: Response,
  ) {
    const safeToken = encodeURIComponent(token || '');
    const schemeUrl = `loopmsq://gift/claim?token=${safeToken}`;
    const androidStoreUrl = this.getAndroidStoreUrl();
    const iosStoreUrl = this.getIosStoreUrl();
    const html = `<!doctype html>
<html lang="ar">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>استلام الهدية</title>
    <style>
      body { font-family: Arial, sans-serif; background: #fff7f7; color: #1f2937; margin: 0; display: grid; place-items: center; min-height: 100vh; }
      .card { width: min(92vw, 420px); background: #ffffff; border-radius: 24px; padding: 28px; box-shadow: 0 16px 40px rgba(239,68,68,.12); text-align: center; }
      .button { display: inline-block; margin-top: 16px; background: #d62828; color: white; text-decoration: none; padding: 14px 18px; border-radius: 14px; font-weight: 700; }
      .muted { color: #6b7280; font-size: 14px; line-height: 1.6; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>لحظة واحدة...</h1>
      <p class="muted">نحاول فتح التطبيق لاستلام الهدية. إذا لم يُفتح التطبيق، ستنتقل إلى المتجر.</p>
      <a class="button" href="${schemeUrl}">فتح التطبيق</a>
    </div>
    <script>
      const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
      const fallback = isIOS ? '${iosStoreUrl}' : '${androidStoreUrl}';
      setTimeout(() => { window.location.href = fallback; }, 1400);
      window.location.href = '${schemeUrl}';
    </script>
  </body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  }
}
