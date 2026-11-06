import { createDataSource } from './create-data-source.js';

const url = process.env.DATABASE_URL;
if (!url?.trim()) {
  throw new Error('Configura DATABASE_URL para la base de datos de Visit.');
}

export default createDataSource(url);
