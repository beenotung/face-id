import { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable('user'))) {
    await knex.schema.createTable('user', table => {
      table.increments('id')
      table.string('nickname', 32).notNullable()
      table.timestamps(false, true)
    })
  }

  if (!(await knex.schema.hasTable('face'))) {
    await knex.schema.createTable('face', table => {
      table.increments('id')
      table.integer('user_id').unsigned().notNullable().references('user.id')
      table.string('filename', 50).notNullable()
      table.integer('width').notNullable()
      table.integer('height').notNullable()
      table.text('descriptor').notNullable()
      table.timestamps(false, true)
    })
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('face')
  await knex.schema.dropTableIfExists('user')
}
