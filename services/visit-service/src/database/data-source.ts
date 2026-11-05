import { DataSource } from 'typeorm';
import { CreateVisitSchema1793898000000 } from './migrations/1793898000000-create-visit-schema.js';

const url = process.env.DATABASE_URL;
if (!url?.trim()) {
  throw new Error('Configura DATABASE_URL para la base de datos de Visit.');
}

export default new DataSource({
  type: 'postgres',
  url,
  synchronize: false,
  installExtensions: false,
  migrations: [CreateVisitSchema1793898000000],
});
