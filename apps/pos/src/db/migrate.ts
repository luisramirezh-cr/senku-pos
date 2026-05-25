import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { db } from './index'

await migrate(db, { migrationsFolder: './src/db/migrations' })
console.log('Migraciones aplicadas.')
process.exit(0)
