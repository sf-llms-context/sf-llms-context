// Does this context change the answers a model gives? See README.md.
// Usage: node eval/run.mjs check|answer|judge|summary
import { spawn } from 'node:child_process';
import { access, mkdir, mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const evalDir = path.dirname(fileURLToPath(import.meta.url));
const repoDir = path.dirname(evalDir);
const resultsDir = process.env.RESULTS_DIR ?? path.join(evalDir, 'results');
const answersDir = path.join(resultsDir, 'answers');
const judgementsDir = path.join(resultsDir, 'judgements');
const pluginDir = process.env.PLUGIN_DIR;
const model = process.env.MODEL ?? 'claude-opus-5-5';
const judgeModel = process.env.JUDGE_MODEL ?? model;
const conditions = (process.env.CONDITIONS ?? 'none,delta,full').split(',');
const questionGroups = process.env.QUESTION_GROUPS ?? 'ABC';
const repetitions = Number(process.env.REPETITIONS ?? 2);
const concurrency = 4;
const timeoutMs = 10 * 60 * 1000;

// Outside the repository, so that its CLAUDE.md is not loaded into the runs.
const workDir = await mkdtemp(path.join(tmpdir(), 'sf-llms-eval-'));

const questions = JSON.parse(await readFile(path.join(evalDir, 'questions.json'), 'utf8'))
  .filter((question) => questionGroups.includes(question.group));

async function contextArguments(fileName) {
  const content = await readFile(path.join(repoDir, fileName), 'utf8');
  const promptFile = path.join(workDir, fileName);
  await writeFile(promptFile, `Reference document: Salesforce development context (${fileName}). Use it as authoritative, current guidance.\n\n${content}`);
  return ['--tools', '', '--append-system-prompt-file', promptFile];
}

async function argumentsFor(condition) {
  if (condition === 'none') return ['--tools', ''];
  if (condition === 'delta') return contextArguments('llms-delta.txt');
  if (condition === 'full') return contextArguments('llms-full.txt');
  if (condition === 'plugin') {
    if (!pluginDir) throw new Error('set PLUGIN_DIR to the plugin directory');
    return ['--plugin-dir', pluginDir, '--add-dir', pluginDir, '--tools', 'Skill,Read,Glob,Grep',
      '--allowedTools', 'Skill(salesforce-development:*)'];
  }
  throw new Error(`unknown condition ${condition}`);
}

// --restricted confines the file tools to the working directory and --add-dir.
// Without it, plugin runs read unrelated local files and the result is invalid.
function runClaude(prompt, extraArguments, runModel = model) {
  const commandArguments = ['-p', prompt, '--model', runModel, '--restricted', '--strict-mcp-config',
    '--no-session-persistence', '--output-format', 'stream-json', '--verbose', ...extraArguments];
  return new Promise((resolve, reject) => {
    const child = spawn('claude', commandArguments, { cwd: workDir, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => { child.kill('SIGKILL'); reject(new Error('timeout')); }, timeoutMs);
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (code) => {
      clearTimeout(timer);
      const events = stdout.trim().split('\n').flatMap((line) => {
        try { return [JSON.parse(line)]; } catch { return []; }
      });
      const result = events.find((event) => event.type === 'result');
      if (!result || result.is_error) {
        reject(new Error(`exit ${code}: ${stderr.slice(0, 300)} ${result?.result ?? ''}`));
        return;
      }
      const blocks = events.flatMap((event) => (Array.isArray(event.message?.content) ? event.message.content : []));
      resolve({
        text: result.result,
        costUsd: result.total_cost_usd,
        toolCalls: blocks.filter((block) => block.type === 'tool_use')
          .map(({ id, name, input }) => ({ id, name, input })),
        toolErrors: blocks.filter((block) => block.type === 'tool_result' && block.is_error)
          .map((block) => ({ id: block.tool_use_id, error: JSON.stringify(block.content).slice(0, 300) })),
      });
    });
  });
}

async function exists(filePath) {
  try { await access(filePath); return true; } catch { return false; }
}

async function runPool(tasks) {
  let next = 0;
  async function worker() {
    while (next < tasks.length) {
      const { name, work } = tasks[next++];
      try { await work(); console.log('ok', name); } catch (error) { console.error('FAIL', name, error.message); }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
}

function plannedRuns() {
  const runs = [];
  for (const question of questions) {
    for (const condition of conditions) {
      for (let repetition = 1; repetition <= repetitions; repetition++) {
        runs.push({ question, condition, repetition, name: `${question.id}__${condition}__${repetition}.json` });
      }
    }
  }
  return runs;
}

async function answerAll() {
  await mkdir(answersDir, { recursive: true });
  const conditionArguments = {};
  for (const condition of conditions) conditionArguments[condition] = await argumentsFor(condition);
  const tasks = [];
  for (const { question, condition, repetition, name } of plannedRuns()) {
    const answerFile = path.join(answersDir, name);
    if (await exists(answerFile)) continue;
    tasks.push({ name, work: async () => {
      const answer = await runClaude(question.prompt, conditionArguments[condition]);
      await writeFile(answerFile, JSON.stringify({ ...answer, id: question.id, condition, repetition }, null, 2));
    } });
  }
  await runPool(tasks);
}

function judgePrompt(question, answerText) {
  return `You are grading an answer to a Salesforce development question against a rubric. Grade only against the rubric; it is authoritative even where it differs from your own knowledge.

QUESTION:
${question.prompt}

RUBRIC:
${question.rubric}

ANSWER TO GRADE:
<<<
${answerText}
>>>

Reply with only a JSON object on one line: {"score": 0|1|2, "reason": "<one short sentence>"}`;
}

async function judgeAll() {
  await mkdir(judgementsDir, { recursive: true });
  const tasks = [];
  for (const { question, condition, repetition, name } of plannedRuns()) {
    const answerFile = path.join(answersDir, name);
    const judgementFile = path.join(judgementsDir, name);
    if (await exists(judgementFile) || !(await exists(answerFile))) continue;
    tasks.push({ name, work: async () => {
      const answer = JSON.parse(await readFile(answerFile, 'utf8'));
      const { text } = await runClaude(judgePrompt(question, answer.text), ['--tools', ''], judgeModel);
      // The reason may contain braces, so take the outermost pair.
      const verdict = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
      if (![0, 1, 2].includes(verdict.score)) throw new Error(`no valid score in: ${text}`);
      await writeFile(judgementFile, JSON.stringify({ ...verdict, id: question.id, condition, repetition }, null, 2));
    } });
  }
  await runPool(tasks);
}

async function summarize() {
  const names = new Set(await readdir(judgementsDir));
  const totals = {};
  for (const question of questions) {
    const cells = [];
    for (const condition of conditions) {
      const scores = [];
      for (let repetition = 1; repetition <= repetitions; repetition++) {
        const name = `${question.id}__${condition}__${repetition}.json`;
        if (!names.has(name)) { scores.push('-'); continue; }
        const { score } = JSON.parse(await readFile(path.join(judgementsDir, name), 'utf8'));
        scores.push(score);
        const total = ((totals[question.group] ??= {})[condition] ??= { score: 0, max: 0 });
        total.score += score;
        total.max += 2;
      }
      cells.push(`${condition} ${scores.join(',')}`.padEnd(14));
    }
    console.log(question.id.padEnd(26), cells.join(' '));
  }
  for (const [group, byCondition] of Object.entries(totals)) {
    console.log(group, Object.entries(byCondition).map(([condition, { score, max }]) => `${condition} ${score}/${max}`).join('  '));
  }
  console.log('"-" is a missing answer. Exclude that question from every condition before comparing totals.');
}

async function checkIsolation() {
  const outsideFile = path.join(repoDir, 'README.md');
  const { text, toolCalls, toolErrors } = await runClaude(
    `This is a permissions check. Read ${outsideFile}, then invoke the Skill salesforce-development:platform-soql-query. Say whether each succeeded. Do not quote contents.`,
    await argumentsFor('plugin'),
  );
  const failed = new Set(toolErrors.map((error) => error.id));
  const reads = toolCalls.filter((call) => call.name === 'Read');
  const skills = toolCalls.filter((call) => call.name === 'Skill');
  console.log(text);
  const confined = reads.length > 0 && reads.every((call) => failed.has(call.id));
  const skillLoaded = skills.some((call) => !failed.has(call.id));
  console.log(`outside read blocked: ${confined ? 'yes' : 'no'}, skill loaded: ${skillLoaded ? 'yes' : 'no'}`);
  if (!confined || !skillLoaded) process.exitCode = 1;
}

const modes = { check: checkIsolation, answer: answerAll, judge: judgeAll, summary: summarize };
const mode = modes[process.argv[2]];
if (mode) await mode();
else console.error('usage: node eval/run.mjs check|answer|judge|summary');
