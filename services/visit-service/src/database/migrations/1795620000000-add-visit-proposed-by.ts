import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Quién propuso el horario de una visita pendiente: el cliente al pedirla, o el agente al sugerir otro. */
export class AddVisitProposedBy1795620000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE visits
        ADD COLUMN proposed_by varchar(10) NOT NULL DEFAULT 'CLIENT'
          CHECK (proposed_by IN ('CLIENT', 'AGENT'));
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE visits DROP COLUMN proposed_by;');
  }
}
