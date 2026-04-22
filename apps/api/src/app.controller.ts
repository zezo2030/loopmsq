import { Controller, Get, Header, Query, Res } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
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

  private buildAndroidGiftIntentUrl(token: string): string {
    const fallbackUrl = encodeURIComponent(this.getAndroidStoreUrl());
    return `intent://gift/claim?token=${token}#Intent;scheme=loopmsq;package=${this.getAndroidPackageName()};S.browser_fallback_url=${fallbackUrl};end`;
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
    const universalUrl = `${this.getAppBaseUrl()}/gift/claim?token=${safeToken}`;
    const schemeUrl = `loopmsq://gift/claim?token=${safeToken}`;
    const androidIntentUrl = this.buildAndroidGiftIntentUrl(safeToken);
    const androidStoreUrl = this.getAndroidStoreUrl();
    const iosStoreUrl = this.getIosStoreUrl();

    const html = `<!doctype html>
<html lang="ar" dir="rtl">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>استلام الهدية</title>
    <style>
      body {
        font-family: Arial, sans-serif;
        background: #fff7f7;
        color: #1f2937;
        margin: 0;
        display: grid;
        place-items: center;
        min-height: 100vh;
        padding: 24px;
        box-sizing: border-box;
      }
      .card {
        width: min(92vw, 420px);
        background: #ffffff;
        border-radius: 24px;
        padding: 28px;
        box-shadow: 0 16px 40px rgba(239, 68, 68, 0.12);
        text-align: center;
      }
      .button {
        display: inline-block;
        margin-top: 16px;
        background: #d62828;
        color: #ffffff;
        text-decoration: none;
        padding: 14px 18px;
        border-radius: 14px;
        font-weight: 700;
        border: 0;
        font-size: 16px;
      }
      .secondary {
        display: inline-block;
        margin-top: 12px;
        color: #d62828;
        text-decoration: none;
        font-size: 14px;
      }
      .muted {
        color: #6b7280;
        font-size: 14px;
        line-height: 1.8;
      }
      .hint {
        margin-top: 16px;
        padding: 12px;
        background: #fef3c7;
        color: #92400e;
        border-radius: 12px;
        font-size: 13px;
        line-height: 1.7;
        display: none;
      }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>استلام الهدية</h1>
      <p class="muted">
        اضغط على الزر لفتح التطبيق. إذا لم يكن التطبيق مثبتاً، سيتم تحويلك إلى
        المتجر.
      </p>
      <a class="button" id="openAppButton" href="#">فتح التطبيق</a>
      <br />
      <a class="secondary" id="storeLink" href="#">تحميل التطبيق من المتجر</a>
      <div class="hint" id="inAppHint">
        يبدو أنك تتصفّح من داخل تطبيق آخر. افتح الرابط في متصفح Chrome أو
        Safari لتجربة أفضل.
      </div>
    </div>
    <script>
      (function () {
        const userAgent = navigator.userAgent || '';
        const isAndroid = /Android/i.test(userAgent);
        const isIOS = /iPhone|iPad|iPod/i.test(userAgent);
        const isInApp = /(FBAN|FBAV|Instagram|WhatsApp|Line|Twitter|MicroMessenger)/i.test(userAgent);
        const schemeUrl = '${schemeUrl}';
        const universalUrl = '${universalUrl}';
        const androidIntentUrl = '${androidIntentUrl}';
        const androidStoreUrl = '${androidStoreUrl}';
        const iosStoreUrl = '${iosStoreUrl}';
        const storeUrl = isIOS ? iosStoreUrl : androidStoreUrl;
        const launchUrl = isAndroid ? androidIntentUrl : (isIOS ? universalUrl : schemeUrl);

        const openAppButton = document.getElementById('openAppButton');
        const storeLink = document.getElementById('storeLink');
        const inAppHint = document.getElementById('inAppHint');

        if (openAppButton) openAppButton.setAttribute('href', launchUrl);
        if (storeLink) storeLink.setAttribute('href', storeUrl);
        if (inAppHint && isInApp) inAppHint.style.display = 'block';

        if (openAppButton) {
          openAppButton.addEventListener('click', function (e) {
            e.preventDefault();
            if (isIOS) {
              const start = Date.now();
              setTimeout(function () {
                if (document.visibilityState === 'visible' && Date.now() - start < 2500) {
                  window.location.replace(iosStoreUrl);
                }
              }, 1500);
            }
            window.location.href = launchUrl;
          });
        }

        if (storeLink) {
          storeLink.addEventListener('click', function (e) {
            e.preventDefault();
            window.location.href = storeUrl;
          });
        }
      })();
    </script>
  </body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:;",
    );
    res.send(html);
  }
}
