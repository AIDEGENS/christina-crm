import type { Config } from "drizzle-kit";

export default {
  schema: "./src/schema/*",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://local:local@localhost:5432/crm",
  },
  schemaFilter: ["crm"],
  verbose: true,
  strict: true,
} satisfies Config;
