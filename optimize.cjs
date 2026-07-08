const sharp = require('sharp');
const path = require('path');

const inputJpg = path.join(__dirname, 'src', 'assets', 'dashboard-backgrounds', 'elephant-log.jpg');
const outputWebp = path.join(__dirname, 'src', 'assets', 'dashboard-backgrounds', 'elephant-log-opt.webp');

console.log('Optimizing image...');
sharp(inputJpg)
  .webp({ quality: 80, effort: 6 })
  .toFile(outputWebp)
  .then(info => {
    console.log('Success!', info);
  })
  .catch(err => {
    console.error('Error optimizing image:', err);
  });
