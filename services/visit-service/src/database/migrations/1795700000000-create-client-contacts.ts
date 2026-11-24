import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Cómo contactar a cada interesado: lo último que le dio a cada agente al consultar o pedir una visita. Es
 * por (cliente, agente): lo que un cliente le dio a un agente no lo ve otro. Se llena con las consultas que
 * ya existen; las visitas anteriores solo tienen contacto si el cliente alguna vez le consultó a ese agente.
 */
export class CreateClientContacts1795700000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE client_contacts (
        client_id   uuid          NOT NULL,              -- sub del JWT
        agent_id    uuid          NOT NULL,              -- el agente al que le dio estos datos
        name        varchar(150),
        email       varchar(254),
        phone       varchar(30),
        updated_at  timestamptz   NOT NULL,
        PRIMARY KEY (client_id, agent_id)
      );
      INSERT INTO client_contacts (client_id, agent_id, name, email, phone, updated_at)
        SELECT DISTINCT ON (client_id, agent_id)
               client_id, agent_id, contact_name, contact_email, contact_phone, created_at
          FROM inquiries
         ORDER BY client_id, agent_id, created_at DESC;
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE client_contacts;');
  }
}
