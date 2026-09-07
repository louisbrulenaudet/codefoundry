#!/usr/bin/env node
const { run } = await import("../lib/cli/main.js");
process.exitCode = await run(process.argv.slice(2));
