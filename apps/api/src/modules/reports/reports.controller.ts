import { Controller, Get, Query, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import type { Response } from 'express';

@ApiTags('reports')
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('overview')
  async overview(@Query('from') from?: string, @Query('to') to?: string, @Query('branchId') branchId?: string) {
    return this.reports.overview({ from, to, branchId });
  }

  @Get('export')
  async export(@Res() res: Response, @Query('type') type: string, @Query('from') from?: string, @Query('to') to?: string, @Query('branchId') branchId?: string) {
    const data = await this.reports.overview({ from, to, branchId });
    const csv = this.toCSV(type || 'overview', data);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${type || 'overview'}.csv"`);
    res.send(csv);
  }

  private toCSV(name: string, data: any) {
    if (name === 'overview') {
      const rows = [
        ['metric', 'value'],
        ['bookings_total', data.bookings.total],
        ['bookings_confirmed', data.bookings.confirmed],
        ['bookings_cancelled', data.bookings.cancelled],
        ['scans', data.scans],
        ...Object.entries(data.revenueByMethod).map(([k, v]) => [`revenue_${k}`, v]),
      ];
      return rows.map((r) => r.join(',')).join('\n');
    }
    return 'metric,value\n';
  }
}


