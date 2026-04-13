import { Controller, Get, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';
import { TripsService } from './trips.service';

@ApiTags('trips-public')
@Controller('trips')
export class TripsPublicController {
  constructor(private readonly tripsService: TripsService) {}

  @Get('config')
  @ApiOperation({ summary: 'Get school trip booking configuration' })
  getTripConfig(
    @Query('branchId') branchId?: string,
    @Query('preferredDate') preferredDate?: string,
  ) {
    return this.tripsService.getPublicConfig(branchId, preferredDate);
  }

  @Get('template/download')
  @ApiOperation({ summary: 'Download Excel template for participants' })
  @ApiProduces(
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
  async downloadTemplate(@Res() res: Response) {
    const buffer = await this.tripsService.getTemplate();
    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition':
        'attachment; filename="participants_template.xlsx"',
    });
    res.send(buffer);
  }
}
