const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../node_modules/app-builder-lib/out/util/electronGet.js');
let content = fs.readFileSync(filePath, 'utf8');

const target = `        await fs.rm(dir, { recursive: true, force: true });
        await fs.rename(tmpDir, dir);`;

const replacement = `        await fs.rm(dir, { recursive: true, force: true });
        let renamed = false;
        for (let attempt = 0; attempt < 15; attempt++) {
            try {
                await fs.rename(tmpDir, dir);
                renamed = true;
                break;
            } catch (err) {
                if (attempt === 14) throw err;
                await new Promise(r => setTimeout(r, 600));
            }
        }`;

if (!content.includes(target)) {
  console.error('Target not found in electronGet.js!');
  process.exit(1);
}

content = content.replace(target, replacement);
fs.writeFileSync(filePath, content, 'utf8');
console.log('electronGet.js patched successfully with NTFS rename retry loop!');

