import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  liveness(): { status: 'UP' } {
    return { status: 'UP' };
  }

  @Get('ready')
  readiness(): { status: 'UP' } {
    return { status: 'UP' };
  }
}
