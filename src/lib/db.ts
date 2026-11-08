import mysql from "mysql2/promise";

// Pool de conexiones reutilizable para toda la aplicacion.
// Las credenciales se leen de variables de entorno (ver .env.local).
let pool: mysql.Pool | null = null;

export function getPool(): mysql.Pool {
  if (!pool) {
    const newPool = mysql.createPool({
      host: process.env.DB_HOST ?? "localhost",
      port: Number(process.env.DB_PORT ?? 3306),
      user: process.env.DB_USER ?? "root",
      password: process.env.DB_PASSWORD ?? "",
      database: process.env.DB_NAME ?? "distrimodas",
      timezone: "-05:00",
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      decimalNumbers: true,
      ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined,
    });
    newPool.pool.on("connection", (connection) => {
      connection.query("SET time_zone = '-05:00'", (error) => {
        if (error) {
          console.error("No se pudo configurar la sesión MySQL en hora de Colombia.", error);
          connection.destroy();
        }
      });
    });
    pool = newPool;
  }
  return pool;
}