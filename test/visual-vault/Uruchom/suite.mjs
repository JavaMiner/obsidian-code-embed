import {spawnSync} from "node:child_process";
import {readdirSync} from "node:fs";
const tests = readdirSync("test").filter(name=>name.endsWith(".test.ts")).map(name=>"test/"+name);
const run = spawnSync(process.execPath, ["--import","tsx","--test","--test-reporter=tap",...tests], {encoding:"utf8"});
if(run.error) throw run.error;
let passed=0, failed=0;
for(const line of run.stdout.split(/\r?\n/)){
 const match=/^(not ok|ok) \d+ - (.*)$/.exec(line);
 if(!match) continue;
 const success=match[1]==="ok";
 console.log((success?"PASS ":"FAIL ")+match[2]);
 if(success) passed++; else failed++;
}
console.log("PASS "+passed+" | FAIL "+failed);
if(run.status!==0 || !passed || failed){console.error(run.stderr,run.stdout);process.exitCode=1;}
