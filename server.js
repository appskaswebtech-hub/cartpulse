import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequestHandler } from "@react-router/express";
import express from "express";
import * as build from "./build/server/index.js";

const app = express();
const port = process.env.PORT || 3001;

// Resolve against this file, not the working directory. A relative path breaks
// every asset when the process is started from anywhere other than the project
// root, which sends /assets/* into the React Router handler as a 404.
const rootDir = path.dirname(fileURLToPath(import.meta.url));

app.use(
  express.static(path.join(rootDir, "build/client"), {
    // Hashed filenames are immutable; the entry HTML must never be cached.
    maxAge: "1y",
    index: false,
  })
);
app.use("/uploads", express.static(path.join(rootDir, "public/uploads")));

app.all("*", createRequestHandler({ build }));

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log(`Serving static files from ${path.join(rootDir, "build/client")}`);
});
