import { Controller, Get } from '@nestjs/common';
import { IsPublic } from './guards';

@Controller()
export class AppController {
  @IsPublic()
  @Get('health')
  health() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      message: 'Service is Healthy!',
    };
  }
}
