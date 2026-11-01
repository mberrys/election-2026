// Merges the researched per-group files in scripts/data/state-links/ into public/data/reference/state-links.json.
import fs from "node:fs";
import path from "node:path";
const dir = "scripts/data/state-links";
const all = fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort().flatMap((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")));
const byAbbr = Object.fromEntries(all.map((s) => [s.abbr, s]));
fs.writeFileSync("public/data/reference/state-links.json", JSON.stringify({ builtAt: new Date().toISOString(), states: byAbbr }, null, 1));
console.log(Object.keys(byAbbr).length, "states");
