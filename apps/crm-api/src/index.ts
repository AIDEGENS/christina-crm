import { serve } from "@hono/node-server";
import { Hono } from "hono";

const app = new Hono();

app.get("/health", (c) =>
  c.json({ status: "ok", service: "crm-api", env: process.env.NODE_ENV ?? "development" }),
);

app.get("/", (c) => c.text("christina-crm api (step 0.1 scaffold) — see /health"));

const port = Number(process.env.PORT ?? 3001);
console.log(`[crm-api] listening on :${port}`);

serve({ fetch: app.fetch, port });
