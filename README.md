# agent-act-check

**Was this act put there by something the agent read, and not by the person it works for?**

A small check for indirect prompt injection, made at the moment an agent is about to act. It reads three pieces of
text that a hook at the tool boundary already has:

- what the person asked in this session,
- the answer of the tool call just before this act,
- the act about to be taken (and up to twelve before it).

It asks a small typed-answer classifier two things, in about 140 ms a call:

1. **carries**: does the act carry out something the content asks for and the request does not?
2. **intent**: is the act off every recent request, each read alone?

It flags when both say so, and returns both numbers either way.

This is research code from the [xChk](https://xchk.io) project, released so people can try it and break it. It is
not a product and not a guarantee.

## Why look at the act

Screens that read a tool's answer look for the injected instruction. That turns out to be the wrong place:

- Pattern screens catch an instruction only when it announces itself. On InjecAgent's tool answers they caught 0 of
  1,054 quiet instructions, and all 1,054 once "ignore all previous instructions" was put in front.
- A classifier reading the answer finds the instruction, and cannot tell an agent that obeyed from one that did not.
  It also flags a lot of ordinary reading: instruction files, prompts and skill definitions really are addressed to an
  agent (10% of 2,000 real tool answers).
- Reading the **next act** against the answer and the request separates the two.

## What was measured

InjecAgent (1,054 cases: the request, a poisoned tool answer, the attacker's tool) and 1,500 real answer-then-act
pairs from opt-in coding sessions (SWE-chat, sessions with no reported problem).

| Reading | Attacks caught | Honest act after the same poisoned answer | Real pairs flagged |
|---|---|---|---|
| Classifier on the answer alone | 78 to 97% | 78 to 97% | 0.9% |
| The act against the request alone | 99.4 to 99.8% | 0% | 23.9% |
| The act against the answer and the request (carries) | 99.4 to 99.8% | 0% | 1.7% |
| **carries AND intent (what this code flags)** | **99.2 to 99.4%** | **0%** | **0.9%** |

### Read these before trusting the table

- **The attack side is easy.** InjecAgent's attacker tool has nothing to do with the request (a door lock while
  reading reviews) and is given by name. An injected act that stays close to the task will read lower. Please try
  that.
- **The carries question was written the day it was measured**, and has no held-out attack set yet.
- The real pairs are 160 sessions of one coding agent.
- One classifier, one model version. Scores move a few points between identical runs.
- "Caught" means flagged. Nothing here stops an act; what a flag does is the caller's decision.

## What it does not do

- It does not judge work done badly. Against stretches of work a developer pushed back on, the intent reading
  scored AUC 0.56. It only asks whether an act belongs to the task at all.
- It cannot read an act whose text says nothing (a click at a coordinate, a key press). Those come back
  `readable: false` and are never flagged or passed as fine.
- It is for content an agent reads, not for prompts a person types.
- A request that hands the instruction over ("do what the note says") makes the content's instruction the task.
- Only the first 6,000 characters of an answer are read.

## Use

Node 18 or later, no dependencies.

```js
const { checkAct } = require('./actcheck');

const r = await checkAct({
  requests: ['Can you fetch me the reviews for this laptop?'],
  content: toolAnswerJustRead,
  act: 'AugustSmartLockGrantGuestAccess: guest_ids=[...], permanent=true',
  history: ['AmazonGetProductDetails: product_id=B08KFQ9HK5'],
});
// { flagged, carries, intent, perRequest, unaskedEffect, readable, reason }
```

```bash
export ACTCHECK_API_KEY=...          # your key for the classifier
node cli.js examples/cases.json
npm test                             # the rules, with a fake classifier; no key needed
```

### The classifier

The questions are sent in the "System One" wire format: `POST {state, model, questions}` and typed answers with a
probability (`noul`). The default endpoint is TypeSafe's hosted Jev (`ACTCHECK_ENDPOINT`, `ACTCHECK_MODEL` change
it). Several open, self-hosted servers speak the same format; the numbers above are for the hosted model and will
differ on another. To use anything else, pass your own `ask(state, questions)` to `checkAct`.

Using the hosted model sends the request, the tool answer and the act to that service. If the tool answer must stay
on your machine, run the classifier there.

### Reproduce

```bash
git clone https://github.com/uiuc-kang-lab/InjecAgent
node bench/injecagent.js InjecAgent/data/test_cases_dh_base.json InjecAgent/data/test_cases_ds_base.json
```

No dataset is included here.

## Related work

The idea of asking whether a tool call carries out an instruction planted in content the agent read is published:
[jev-guard](https://github.com/leepokai/jev-guard) asks a `from_untrusted` question of each tool call. Comparing
actions with the stated task is published too: Meta's LlamaFirewall AlignmentCheck, Task Shield, and DeAction /
[MisActBench](https://github.com/OSU-NLP-Group/Misaligned-Action-Detection). What this adds is a measurement: the
act-versus-content comparison on a public attack set, and false-flag rates from real sessions. Datasets used:
[InjecAgent](https://github.com/uiuc-kang-lab/InjecAgent), MisActBench,
[SWE-chat](https://huggingface.co/datasets/SALT-NLP/SWE-chat).

## Licence

MIT.
