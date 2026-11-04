const { app, nativeImage } = require('electron');
const fs = require('fs');
const path = require('path');

const outPath = path.join(__dirname, '../icon_result.txt');
let lines = ['Immediate execution:'];

try {
  const icoPath = path.join(__dirname, '../electron/logo.ico');
  const img1 = nativeImage.createFromPath(icoPath);
  lines.push('unpacked logo.ico: exists=' + fs.existsSync(icoPath) + ' isEmpty=' + img1.isEmpty() + ' size=' + JSON.stringify(img1.getSize()));

  const pngPath = path.join(__dirname, '../electron/logo.png');
  const img2 = nativeImage.createFromPath(pngPath);
  lines.push('unpacked logo.png: exists=' + fs.existsSync(pngPath) + ' isEmpty=' + img2.isEmpty() + ' size=' + JSON.stringify(img2.getSize()));

  const asarIco = path.join(__dirname, '../dist-electron/win-unpacked/resources/app.asar/electron/logo.ico');
  const img3 = nativeImage.createFromPath(asarIco);
  lines.push('asar logo.ico: exists=' + fs.existsSync(asarIco) + ' isEmpty=' + img3.isEmpty() + ' size=' + JSON.stringify(img3.getSize()));

  const asarPng = path.join(__dirname, '../dist-electron/win-unpacked/resources/app.asar/electron/logo.png');
  const img4 = nativeImage.createFromPath(asarPng);
  lines.push('asar logo.png: exists=' + fs.existsSync(asarPng) + ' isEmpty=' + img4.isEmpty() + ' size=' + JSON.stringify(img4.getSize()));
} catch (err) {
  lines.push('Error: ' + err.stack);
}

fs.writeFileSync(outPath, lines.join('\n'));
if (app) app.quit();
