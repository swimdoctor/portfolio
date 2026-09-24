// Local entry point for onPush.js (the GitHub workflow calls it via actions/github-script).
const path = require('path');

process.chdir(path.resolve(__dirname, '..'));
require('../onPush.js')({ github: null, context: null });
