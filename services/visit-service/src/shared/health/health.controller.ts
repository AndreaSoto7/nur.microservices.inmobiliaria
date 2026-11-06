import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { VisitDatabase } from '../../database/visit-database.js';

@Controller('health')
export class HealthController {
  constructor(private readonly database: VisitDatabase) {}

  @Get()
  liveness(): { status: 'UP' } {
    return { status: 'UP' };
  }

  @Get('ready')
  async readiness(@Res({ passthrough: true }) response: Response) {
    try {
      const database = await this.database.connect();
      await database.query('SELECT 1 FROM visits LIMIT 0');
      return { status: 'UP' };
    } catch {
      response.status(503);
      return { status: 'DOWN' };
    }
  }
}
