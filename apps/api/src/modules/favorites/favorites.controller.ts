import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { FavoritesService } from './favorites.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('favorites')
@Controller('favorites')
export class FavoritesController {
  constructor(private readonly favorites: FavoritesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async add(@CurrentUser() user: any, @Body() body: { entityType: 'branch' | 'hall'; entityId: string }) {
    return this.favorites.add(user.id, body.entityType, body.entityId);
  }

  @Delete()
  @HttpCode(HttpStatus.OK)
  async remove(@CurrentUser() user: any, @Body() body: { entityType: 'branch' | 'hall'; entityId: string }) {
    return this.favorites.remove(user.id, body.entityType, body.entityId);
  }

  @Get()
  async list(@CurrentUser() user: any) {
    return this.favorites.list(user.id);
  }
}


