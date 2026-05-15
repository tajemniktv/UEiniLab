const fs = require('node:fs');
const path = require('node:path');
const { parseEpicCvarReferenceHtml } = require('../dist/importers/epicCvarReferenceHtmlParser.js');

const sourceDir =
  process.argv[2] ||
  path.join(process.cwd(), 'SchemaSource', 'Epic');
const outputDir = process.argv[3] || path.join(process.cwd(), 'schemas');
const versions = ['5.4', '5.5', '5.6', '5.7'];

fs.mkdirSync(outputDir, { recursive: true });

for (const version of versions) {
  const sourcePath = findHtmlForVersion(sourceDir, version);
  if (!sourcePath) {
    console.warn(`No Epic CVar reference HTML found for Unreal Engine ${version} in ${sourceDir}`);
    continue;
  }

  const html = fs.readFileSync(sourcePath, 'utf8');
  const pack = parseEpicCvarReferenceHtml(html, {
    engineVersion: version,
    id: `ue${version}-base`,
    displayName: `Unreal Engine ${version} Base CVars`,
    sourcePath
  });
  const count = Object.keys(pack.cvars).length;
  if (count === 0) {
    console.warn(
      `Skipped Unreal Engine ${version}: ${sourcePath} did not contain rendered CVar table rows.`
    );
    continue;
  }
  const targetPath = path.join(outputDir, `ue${version}-base.cvars.jsonc`);
  fs.writeFileSync(targetPath, toJsonc(pack), 'utf8');
  console.log(`Wrote ${targetPath} (${count} CVars)`);
}

function findHtmlForVersion(directory, version) {
  const expected = `Unreal Engine ${version} Documentation`;
  return walkFiles(directory)
    .find((filePath) => {
      const name = path.basename(filePath);
      return (
        name.toLowerCase().endsWith('.html') &&
        name.includes('Unreal Engine Console Variables Reference') &&
        name.includes(expected)
      );
    });
}

function walkFiles(directory) {
  if (!fs.existsSync(directory)) {
    return [];
  }
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? walkFiles(fullPath) : [fullPath];
  });
}

function toJsonc(pack) {
  return [
    `// Generated from Epic Developer Community HTML export for Unreal Engine ${pack.target.engineVersion}.`,
    '// Re-run: npm run generate:epic-schemas',
    JSON.stringify(pack, null, 2)
  ].join('\n');
}
