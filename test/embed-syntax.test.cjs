const {test}=require('node:test');
const fs=require('node:fs'),vm=require('node:vm'),a=require('node:assert/strict');
const Base=class {};const ctx={module:{exports:{}},require:()=>new Proxy({}, {get:(_,k)=>k==='StateEffect'?{define:()=>({})}:Base})};
vm.runInNewContext(fs.readFileSync('dist/main.js','utf8')+'\nglobalThis.api={parseRef, REF_RE};',ctx);
test('single brackets and local shorthand',()=>{const {parseRef,REF_RE}=ctx.api;const refs=[...'![x] ![<tag>] ![<<tag>>] ![#Title] ![##Title]'.matchAll(REF_RE())];a.equal(refs.length,5);a.equal(parseRef(refs[0].groups.ref).name,'x');a.equal(parseRef(refs[1].groups.ref).name,'.');a.equal(parseRef(refs[4].groups.ref).range,'##Title');a.equal(REF_RE().test('![alt](img.png)'),false);a.equal(REF_RE().test('$#Title'),false);});
