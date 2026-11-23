# Eval

Measures whether this context changes the answers a model gives. Each question in `questions.json` is answered under several conditions, and a separate model call that does not know the condition grades each answer against a rubric.

Question groups: A is Winter '27, B is Summer '26, C is stable core used as a control.

## Run

Requires the `claude` CLI, logged in. Every answer and every grade is one model call, so `none,delta,full` with two repetitions is about 250 calls.

```bash
node eval/run.mjs answer
node eval/run.mjs judge
node eval/run.mjs summary
```

Finished runs are skipped, so repeat a command to fill in failures. Settings are environment variables, which must be the same for all three commands: `CONDITIONS` (`none`, `delta`, `full`, `plugin`), `QUESTION_GROUPS`, `REPETITIONS`, `MODEL`, `JUDGE_MODEL`, `RESULTS_DIR`, `PLUGIN_DIR`.

For the `plugin` condition, set `PLUGIN_DIR` and confirm first that file access is confined and skills load:

```bash
PLUGIN_DIR=/path/to/salesforce-development node eval/run.mjs check
```

## Known limits

- The rubrics come from this repository, so scores measure agreement with it, not independent correctness. Update the rubrics and add questions with each release.
- Without tools, a model asked to write code sometimes prints an invented tool call or never finishes. Exclude such a question from every condition.
- Two repetitions are few. Treat differences of a point or two as noise.
- Results are not committed. Read them before sharing: answers can quote local context.
