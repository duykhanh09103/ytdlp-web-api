const testFolder = './downloads/';
const fs = require('fs');

fs.readdirSync(testFolder).forEach(file => {
  console.log(file);
});