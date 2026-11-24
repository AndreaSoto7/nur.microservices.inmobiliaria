import type { MigrationInterface, QueryRunner } from 'typeorm';

/** La respuesta del agente a una consulta: una por consulta, las dos columnas juntas o ninguna. */
export class AddInquiryReply1795540000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE inquiries
        ADD COLUMN reply       varchar(2000) CHECK (reply IS NULL OR length(trim(reply)) > 0),
        ADD COLUMN replied_at  timestamptz,
        ADD CONSTRAINT inquiries_reply_together CHECK ((reply IS NULL) = (replied_at IS NULL));
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE inquiries
        DROP CONSTRAINT inquiries_reply_together,
        DROP COLUMN replied_at,
        DROP COLUMN reply;
    `);
  }
}
