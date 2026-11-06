import { Injectable, type OnApplicationShutdown } from '@nestjs/common';
import type { DataSource } from 'typeorm';
import { createDataSource } from './create-data-source.js';

@Injectable()
export class VisitDatabase implements OnApplicationShutdown {
  private connection?: Promise<DataSource>;

  async connect(): Promise<DataSource> {
    const url = process.env.DATABASE_URL;
    if (!url?.trim()) throw new Error('DATABASE_URL no está configurada.');

    this.connection ??= createDataSource(url)
      .initialize()
      .catch((error: unknown) => {
        this.connection = undefined;
        throw error;
      });
    return this.connection;
  }

  async onApplicationShutdown(): Promise<void> {
    const connection = await this.connection?.catch(() => undefined);
    await connection?.destroy();
  }
}
