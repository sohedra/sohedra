// The test's probe: a line in `compiled.log` each time the bundler compiles the page's component,
// which a build restored from the cache does not.
const fs = require("node:fs");
const path = require("node:path");

module.exports = function compiled(source) {
	fs.appendFileSync(path.join(__dirname, "compiled.log"), `${path.basename(this.resourcePath)}\n`);
	return source;
};
