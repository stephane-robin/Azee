import * as SQLite from 'expo-sqlite';

let dbInstance = null;

export const initDatabase = async () => {
  if (!dbInstance) {
    dbInstance = await SQLite.openDatabaseAsync('medications.db');

    // Création des tables
    await dbInstance.execAsync(`
      CREATE TABLE IF NOT EXISTS medications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        duration_days INTEGER NOT NULL,
        start_date TEXT NOT NULL,
        take_morning INTEGER DEFAULT 0,
        take_noon INTEGER DEFAULT 0,
        take_evening INTEGER DEFAULT 0,
        posologie TEXT
      );
    `);

    await dbInstance.execAsync(`
      CREATE TABLE IF NOT EXISTS daily_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        medication_id INTEGER NOT NULL,
        date TEXT NOT NULL,
        slot TEXT NOT NULL,
        taken INTEGER DEFAULT 0,
        UNIQUE(medication_id, date, slot)
      );
    `);
  }
  return dbInstance;
};

export const getDatabase = () => {
  if (!dbInstance) {
    throw new Error("La base de données n'a pas été initialisée. Appelez initDatabase() d'abord.");
  }
  return dbInstance;
};