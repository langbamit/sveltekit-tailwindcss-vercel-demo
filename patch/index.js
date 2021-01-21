var path = require('path');
var fs = require('fs');

var dist = path.dirname(require.resolve('@sveltejs/kit/dist/renderer'));

fs.copyFileSync(path.join(__dirname, 'files', 'index3.js'), path.join(dist, 'index3.js'));
fs.copyFileSync(path.join(__dirname, 'files', 'renderer.js'), path.join(dist, 'renderer1.js'));