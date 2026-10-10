import { config } from "dotenv";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { createDb } from "./client";

config({ path: "../../.env" });

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");

const db = createDb(url, { max: 1 });
await migrate(db, { migrationsFolder: new URL("../migrations", import.meta.url).pathname });
await db.$sql.end();
console.log("Migrations applied");
