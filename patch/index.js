var path = require('path');
var fs = require('fs');

var dist = path.dirname(require.resolve('@sveltejs/kit/dist/renderer'));

fs.copyFileSync(path.join(__dirname, 'patch', 'index3.js'), path.join(dist, 'index3.js'));
fs.copyFileSync(path.join(__dirname, 'patch', 'renderer1.js'), path.join(dist, 'renderer1.js'));