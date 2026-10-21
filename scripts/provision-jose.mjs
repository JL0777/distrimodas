import { readFileSync } from "node:fs";
import nextEnv from "@next/env";
import { createInterface } from "node:readline/promises";
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

async function confirmTarget(target) {
  const terminal = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await terminal.question(
      `Destino de aprovisionamiento: ${target.host}:${target.port}/${target.database}\nEscribe el host exacto para confirmar: `
    );
    if (answer.trim() !== target.host) {
      throw new Error("El host no coincide; no se creó la cuenta.");
    }
  } finally {
    terminal.close();
  }
}

async function main() {
  const host = process.env.DB_HOST ?? "localhost";
  const port = Number(process.env.DB_PORT ?? 3306);
  const database = process.env.DB_NAME ?? "distrimodas";
  const user = process.env.DB_USER ?? "root";
  const localHost = ["localhost", "127.0.0.1", "::1"].includes(host.toLowerCase());
  const caPath = process.env.DB_SSL_CA;

  if (!localHost && !caPath) {
    throw new Error("Para un servidor remoto, configura DB_SSL_CA con la ruta al certificado CA de Aiven.");
  }

  const ssl = caPath
    ? { ca: readFileSync(caPath, "utf8"), rejectUnauthorized: true }
    : undefined;
  const target = { host, port, database };
  await confirmTarget(target);

  const josePassword = await readHidden("Contraseña inicial para jose (mínimo 10 caracteres): ");
  if (josePassword.length < 10) {
    throw new Error("La contraseña debe tener al menos 10 caracteres.");
  }

  const databasePassword = localHost
    ? (process.env.DB_PASSWORD ?? "")
    : await readHidden("Contraseña de conexión MySQL de Aiven: ");
  const passwordHash = await bcrypt.hash(josePassword, 12);
  const connection = await mysql.createConnection({
    host,
    port,
    user,
    password: databasePassword,
    database,
    ssl,
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
