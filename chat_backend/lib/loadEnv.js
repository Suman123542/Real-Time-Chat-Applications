import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure `.env` is loaded from the backend folder even if the server is started from another CWD.
dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

