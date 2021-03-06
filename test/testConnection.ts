import { createConnection } from "typeorm"
import { SqliteConnectionOptions } from "typeorm/driver/sqlite/SqliteConnectionOptions"

const testConnection = {
    type: "sqlite",
    database: "database.test.sqlite",
    synchronize: true,
    logging: ["errors", "warn"],
    entities: ["src/entity/**/*.ts"],
} as SqliteConnectionOptions

process.env.NODE_ENV = "test"

export const getConnection = createConnection(testConnection)
