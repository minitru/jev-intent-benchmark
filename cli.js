#!/usr/bin/env node
'use strict';
// node cli.js examples/poisoned-review.json     (or pipe a case on stdin)
// A case is { "requests": [...], "content": "...", "act": "...", "history": [...] }.
const fs = require('fs');
const { checkAct } = require('./actcheck');

(async () => {
    const text = process.argv[2] ? fs.readFileSync(process.argv[2], 'utf8') : fs.readFileSync(0, 'utf8');
    const cases = [].concat(JSON.parse(text));
    for (const c of cases) {
        const r = await checkAct(c);
        console.log(JSON.stringify({ name: c.name, ...r }, null, 1));
    }
})().catch((e) => { console.error(e.message); process.exit(1); });
