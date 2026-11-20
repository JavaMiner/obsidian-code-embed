const fs=require('node:fs');
const read=f=>JSON.parse(fs.readFileSync(f)); const write=(f,v)=>fs.writeFileSync(f,JSON.stringify(v,null,2)+'\n');
const m=read('manifest.json'), p=read('package.json'), versions=read('versions.json');
if(!/^\d+\.\d+\.\d+$/.test(p.version)) throw Error('Expected X.Y.Z');
m.version=p.version;versions[m.version]=m.minAppVersion;write('manifest.json',m);write('versions.json',versions);
