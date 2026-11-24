import { DataSource } from 'typeorm';
import { CreateVisitSchema1793898000000 } from './migrations/1793898000000-create-visit-schema.js';
import { AddInquiryReply1795540000000 } from './migrations/1795540000000-add-inquiry-reply.js';
import { AddVisitProposedBy1795620000000 } from './migrations/1795620000000-add-visit-proposed-by.js';

export function createDataSource(url: string): DataSource {
  return new DataSource({
    type: 'postgres',
    url,
    synchronize: false,
    installExtensions: false,
    connectTimeoutMS: 2000,
    extra: { statement_timeout: 5000 },
    migrations: [
      CreateVisitSchema1793898000000,
      AddInquiryReply1795540000000,
      AddVisitProposedBy1795620000000,
    ],
  });
}
