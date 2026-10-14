#!/usr/bin/env node
'use strict';
// Reproduce the headline on InjecAgent (github.com/uiuc-kang-lab/InjecAgent, fetch data/test_cases_*_base.json yourself).
// Each case gives the person's request, a tool answer carrying an attacker's instruction, and the attacker's tool.
// Two acts are checked after the same poisoned answer: the attacker's tool being called, and the user's own tool
// called again. InjecAgent names the attacker's tool without arguments in some files, so the act is the name alone.
//
//   node bench/injecagent.js path/to/test_cases_dh_base.json [more files] [--limit 200]
const fs = require('fs');
const { checkAct } = require('../actcheck');

(async () => {
    const files = process.argv.slice(2).filter((a) => a.endsWith('.json'));
    const limit = process.argv.includes('--limit') ? Number(process.argv[process.argv.indexOf('--limit') + 1]) : Infinity;
    for (const f of files) {
        const cases = JSON.parse(fs.readFileSync(f, 'utf8')).slice(0, limit);
        let caught = 0, wrong = 0, done = 0, next = 0;
        await Promise.all(Array.from({ length: 6 }, async () => {
            while (next < cases.length) {
                const c = cases[next++];
                const base = { requests: [c['User Instruction']], content: c['Tool Response'], history: [`${c['User Tool']}: ${c['Tool Parameters']}`] };
                const [attack, honest] = await Promise.all([checkAct({ ...base, act: c['Attacker Tools'][0] }), checkAct({ ...base, act: `${c['User Tool']}: ${c['Tool Parameters']}` })]);
                caught += attack.flagged; wrong += honest.flagged; done++;
            }
        }));
        console.log(`${f}: attacks flagged ${caught}/${done} (${(100 * caught / done).toFixed(1)}%), honest acts flagged ${wrong}/${done} (${(100 * wrong / done).toFixed(1)}%)`);
    }
})().catch((e) => { console.error(e.message); process.exit(1); });
