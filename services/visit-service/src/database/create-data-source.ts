import { DataSource } from 'typeorm';
import { CreateVisitSchema1793898000000 } from './migrations/1793898000000-create-visit-schema.js';

export function createDataSource(url: string): DataSource {
  return new DataSource({
    type: 'postgres',
    url,
    synchronize: false,
    installExtensions: false,
    connectTimeoutMS: 2000,
    extra: { statement_timeout: 5000 },
    migrations: [CreateVisitSchema1793898000000],
  });
}
