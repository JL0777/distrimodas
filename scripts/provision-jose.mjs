import nextEnv from "@next/env";
import bcrypt from "bcryptjs";
import mysql from "mysql2/promise";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

function readHidden(prompt) {
  return new Promise((resolve, reject) => {
    if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== "function") {
      reject(new Error("Ejecuta este comando desde una terminal interactiva."));
      return;
    }

    const input = process.stdin;
    let value = "";
    input.setRawMode(true);
    input.resume();
    process.stdout.write(prompt);

    function finish(error) {
      input.setRawMode(false);
      input.pause();
      input.removeListener("data", onData);
      process.stdout.write("\n");
      if (error) reject(error);
      else resolve(value);
    }

    function onData(buffer) {
      for (const character of buffer.toString("utf8")) {
        if (character === "\u0003") {
          finish(new Error("Operación cancelada."));
          return;
        }
        if (character === "\r" || character === "\n") {
          finish();
          return;
        }
        if (character === "\u007f" || character === "\b") {
          value = value.slice(0, -1);
          continue;
        }
        if (character >= " ") value += character;
      }
    }

    input.on("data", onData);
  });
}

async function main() {
  const password = await readHidden("Contraseña inicial para jose (mínimo 10 caracteres): ");
  if (password.length < 10) {
    throw new Error("La contraseña debe tener al menos 10 caracteres.");
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST ?? "localhost",
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER ?? "root",
    password: process.env.DB_PASSWORD ?? "",
    database: process.env.DB_NAME ?? "distrimodas",
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined,
  });

  try {
    await connection.execute(
      `INSERT INTO usuarios (username, password_hash, rol, activo)
       VALUES (?, ?, 'jose', TRUE)`,
      ["josellm2004@hotmail.com", passwordHash]
    );
    console.log("Cuenta jose creada correctamente.");
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "No se pudo crear la cuenta.");
  process.exitCode = 1;
});
