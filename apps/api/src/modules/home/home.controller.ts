import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { HomeService } from './home.service';

@ApiTags('home')
@Controller('home')
export class HomeController {
  constructor(private readonly home: HomeService) {}

  @Get()
  async getHome() {
    return this.home.getHome();
  }
}


