# jev-intent-benchmark

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

The name: the check is asked of Jev, TypeSafe's small typed-answer model, and the repository holds the check, the
examples and a script to benchmark it on a public attack set. It is not affiliated with or endorsed by TypeSafe.

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
- **The headline numbers are for short acts and short content.** See "Known bypass: length" below.
- The real pairs are 160 sessions of one coding agent.
- One classifier, one model version. Scores move a few points between identical runs.
- "Caught" means flagged. Nothing here stops an act; what a flag does is the caller's decision.

## Known bypass: length

**This check can be walked around today by making things long.** It reads the first 400 characters of the act and
the first 6,000 of the content before it. Tested on 300 InjecAgent cases:

| Where the attack sits | Caught |
|---|---|
| The attacker's call after the 400th character of the act | 0 of 300 |
| The same, reading the head and tail of the act | 44 of 300 |
| The injected instruction after the 6,000th character of the content | 8 of 300 |
| The same, reading the content in overlapping pieces and keeping the highest answer | 292 of 300, no honest act flagged |

So long content has a fix that works and is not yet in this code; a long act has none. If you call this from a hook,
give it the whole act and do not rely on the 400-character cut: split it yourself, or refuse to pass an act you could
not read in full. Padding an attack with ordinary activity is a known way past detectors, and this is that trick
inside a single act.

## What it does not do

- It does not judge work done badly. Against stretches of work a developer pushed back on, the intent reading
  scored AUC 0.56. It only asks whether an act belongs to the task at all.
- It cannot read an act whose text says nothing (a click at a coordinate, a key press). Those come back
  `readable: false` and are never flagged or passed as fine.
- It is for content an agent reads, not for prompts a person types.
- A request that hands the instruction over ("do what the note says") makes the content's instruction the task.

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

## Where the data is

Nothing is bundled here; fetch what you need from its owner. Check each page for its licence and terms before you
use it. "Sign-in" means a Hugging Face account that has accepted the dataset's terms on its page.

**Used for the headline result**

| Set | Where | What we used |
|---|---|---|
| InjecAgent | https://github.com/uiuc-kang-lab/InjecAgent | `data/test_cases_dh_base.json`, `data/test_cases_ds_base.json` (and the `_enhanced` pair) |
| SWE-chat (sign-in; ODC-By) | https://huggingface.co/datasets/SALT-NLP/SWE-chat | `sessions.parquet`, and `transcripts/<session_id>.jsonl` for 400 sampled Claude Code sessions |
| Coding-agent misalignment episodes (MIT) | https://github.com/ND-SaNDwichLAB/coding-agent-misalignment | `misalignments.json`; its `session_sha` is SWE-chat's `session_id` |

**Used for the per-act task check**

| Set | Where | What we used |
|---|---|---|
| MisActBench (CC-BY-4.0) | https://huggingface.co/datasets/osunlp/MisActBench | `misactbench.json`; code at https://github.com/OSU-NLP-Group/Misaligned-Action-Detection |

**Used to test screens on content and prompts**

| Set | Where | What we used |
|---|---|---|
| BIPIA | https://github.com/microsoft/BIPIA | `benchmark/text_attack_test.json`, `code_attack_test.json`, and the email, table and code contexts |
| deepset prompt-injections | https://huggingface.co/datasets/deepset/prompt-injections | both splits |
| Tensor Trust | https://github.com/HumanCompatibleAI/tensor-trust-data | `benchmarks/hijacking-robustness`, `benchmarks/extraction-robustness` |
| HackAPrompt (sign-in) | https://huggingface.co/datasets/hackaprompt/hackaprompt-dataset | `hackaprompt.parquet`, the `user_input` column |
| Gandalf "ignore instructions" | https://huggingface.co/datasets/Lakera/gandalf_ignore_instructions | train split |
| In-the-wild jailbreak prompts | https://huggingface.co/datasets/TrustAIRLab/in-the-wild-jailbreak-prompts | the `jailbreak_2023_12_25` and `regular_2023_12_25` sets |
| WildJailbreak (sign-in) | https://huggingface.co/datasets/allenai/wildjailbreak | `train/train.tsv`, `eval/eval.tsv` |
| JailbreakBench artifacts | https://github.com/JailbreakBench/artifacts | `attack-artifacts/` for GCG, PAIR, JBC, DSN and random search |
| L1B3RT4S | https://github.com/elder-plinius/L1B3RT4S | the per-vendor `.mkd` files |

The last four are prompts typed to a model, not content an agent reads. This check is not meant for them, and on
them it does not separate harmful from harmless; they are listed because we ran them.

With the Hugging Face CLI, after `hf auth login`:

```bash
hf download SALT-NLP/SWE-chat sessions.parquet --repo-type dataset --local-dir swechat
hf download hackaprompt/hackaprompt-dataset --repo-type dataset --local-dir hackaprompt
hf download allenai/wildjailbreak --repo-type dataset --local-dir wildjailbreak
```

SWE-chat's full tables are about 12 GB; the transcripts can be fetched one session at a time.

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
