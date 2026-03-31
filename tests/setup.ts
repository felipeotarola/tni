import fs from "node:fs";
import path from "node:path";
import { afterAll } from "vitest";

const dbPath = path.join(process.cwd(), "data", "tni.test.sqlite");
process.env.DATABASE_PATH = dbPath;
process.env.PTS_BASE_URL = "https://data.pts.se";

try {
  fs.rmSync(dbPath, { force: true });
} catch {
  // best effort cleanup
}

afterAll(() => {
  try {
    fs.rmSync(dbPath, { force: true });
  } catch {
    // best effort cleanup
  }
});

