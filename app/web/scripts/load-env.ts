// Imported first by every script: loads .env.local (or $ENV_FILE) the way
// `next dev` does for the app.
import { config } from "dotenv";

config({ path: process.env.ENV_FILE ?? ".env.local", quiet: true });
