import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

let dbInstance: Database.Database | null = null;

function ensureDatabaseDirectory(filePath: string): void {
  const directory = path.dirname(filePath);
  fs.mkdirSync(directory, { recursive: true });
}

function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const migrationsDir = path.join(process.cwd(), "migrations");
  const files = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort((a, b) => a.localeCompare(b));

  const hasMigrationStmt = db.prepare("SELECT 1 FROM _migrations WHERE name = ?");
  const markMigrationStmt = db.prepare("INSERT INTO _migrations (name) VALUES (?)");

  for (const file of files) {
    const alreadyApplied = hasMigrationStmt.get(file);
    if (alreadyApplied) {
      continue;
    }

    const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
    const applyMigration = db.transaction(() => {
      db.exec(sql);
      markMigrationStmt.run(file);
    });
    applyMigration();
  }
}

export function getDb(): Database.Database {
  if (dbInstance) {
    return dbInstance;
  }

  const dbPath = process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "tni.sqlite");
  ensureDatabaseDirectory(dbPath);

  dbInstance = new Database(dbPath);
  dbInstance.pragma("journal_mode = WAL");
  dbInstance.pragma("foreign_keys = ON");
  runMigrations(dbInstance);

  return dbInstance;
}

