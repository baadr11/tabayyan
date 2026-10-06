// Release gate: refuses to ship if any test fails or the gold set shows a wrong verdict.
import { execSync } from "node:child_process";
const run = c => execSync(c, { stdio: "pipe", encoding: "utf8" });
try { run("npm test"); console.log("✓ unit & integration tests"); } catch (e) { console.error(e.stdout || e.message); console.error("✗ tests failed"); process.exit(1); }
const out = run("node tools/eval.mjs" + (process.argv.includes("--ai") ? " --ai" : ""));
const last = out.trim().split("\n").filter(l => l.startsWith("نجح")).pop() || "";
const n = re => +(last.match(re)?.[1] ?? NaN);
const wrong = n(/حكم مختلف عن المتوقع (\d+)/), falsePos = n(/وجد ما لا يجب (\d+)/), [ok, total] = (last.match(/نجح (\d+)\/(\d+)/) || []).slice(1).map(Number);
console.log("✓ gold set:", last);
if (wrong !== 0 || falsePos !== 0) { console.error("✗ gold set has wrong verdicts or false matches — do not release"); process.exit(1); }
const sug = out.match(/اقتراح صحيح أولًا (\d+) · اقتراح خاطئ (\d+)/); const sugOK = sug ? +sug[1] : 0, sugBad = sug ? +sug[2] : 0;
if (sug) console.log(`✓ AI «هل تقصد؟»: ${sugOK} correct first suggestions, ${sugBad} wrong`);
if (sugBad > 0) { console.error("✗ an AI suggestion ranked a wrong hadith first"); process.exit(1); }
if ((ok + sugOK) / total < 0.9) { console.error("✗ resolution below 90% on the gold set (direct verdicts + confirmed suggestions)"); process.exit(1); }
console.log("✓ release gate passed");
