import { createRequestHandler } from "@react-router/express";
import express from "express";
import * as build from "./build/server/index.js";

const app = express();
const port = process.env.PORT || 3001;

app.use(express.static("build/client"));

app.all("*", createRequestHandler({ build }));

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
