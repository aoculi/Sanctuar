import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import { db } from './db'

console.log('Migrating database...')
migrate(db, { migrationsFolder: './drizzle' })
