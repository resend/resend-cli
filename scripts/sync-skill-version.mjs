import { readFileSync, writeFileSync } from "fs";

const version = JSON.parse(readFileSync("package.json", "utf8")).version;
const path = "skills/resend-cli/SKILL.md";
const content = readFileSync(path, "utf8");
const pattern = /version: ".*?"/;

if (!pattern.test(content)) {
  console.error(`Error: could not find version pattern in ${path}`);
  process.exit(1);
}

const updated = content.replace(pattern, `version: "${version}"`);
writeFileSync(path, updated);
