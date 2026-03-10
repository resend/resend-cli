import fs from 'node:fs';

const eventPath = process.env.GITHUB_EVENT_PATH;
if (!eventPath) {
  console.error(
    'GITHUB_EVENT_PATH is not set. This script must run inside GitHub Actions.',
  );
  process.exit(1);
}

const eventJson = JSON.parse(fs.readFileSync(eventPath, 'utf8'));
const prTitle = eventJson.pull_request?.title;
if (!prTitle) {
  console.error('Could not read pull_request.title from event payload.');
  process.exit(1);
}

const isValidType = (title) =>
  /^(feat|fix|chore|refactor)(\([a-zA-Z0-9-]+\))?:\s[a-z0-9].*$/.test(title);

const validateTitle = (title) => {
  if (!isValidType(title)) {
    console.error(
      `PR title does not follow the required format "[type]: [description]"
  Examples: "feat: add --cc flag"  |  "fix: domain fetch timeout"
  Types:    feat · fix · chore · refactor
  Rules:    lowercase after the colon`,
    );
    process.exit(1);
  }
  console.info(`PR title valid: "${title}"`);
};

validateTitle(prTitle);
