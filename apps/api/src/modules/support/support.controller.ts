import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SupportService } from './support.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthGuard } from '@nestjs/passport';

@ApiTags('support')
@Controller('support')
export class SupportController {
  constructor(private readonly support: SupportService) {}

  @Post()
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  async create(@CurrentUser() user: any, @Body() body: { subject: string; description: string; category: string; priority?: 'low' | 'medium' | 'high' | 'urgent' }) {
    return this.support.create(user.id, body as any);
  }

  @Get(':id')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  async get(@CurrentUser() user: any, @Param('id') id: string) {
    return this.support.get(user, id);
  }

  @Post(':id/reply')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  async reply(@CurrentUser() user: any, @Param('id') id: string, @Body() body: { message: string; attachments?: string[] }) {
    return this.support.reply(user, id, body.message, body.attachments);
  }

  @Patch(':id')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  async update(@CurrentUser() staff: any, @Param('id') id: string, @Body() body: { status?: string; priority?: string; assignTo?: string }) {
    return this.support.updateStatus(staff, id, body as any);
  }

  @Get()
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  async list(@CurrentUser() user: any, @Query('page') page = '1', @Query('limit') limit = '10') {
    return this.support.list(user, Number(page), Number(limit));
  }
}


