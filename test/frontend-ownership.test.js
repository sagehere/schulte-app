const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const source=fs.readFileSync('public/index.html','utf8');
function extract(name){const start=source.indexOf('      function '+name+'(');const rest=source.slice(start);const end=rest.slice(7).search(/\n      (?:async )?function /);return rest.slice(0,end+7);}
test('date records isolate owners and cloud refresh updates existing IDs',()=>{
 const records=[{id:'a',ownerIdentifier:'A',date:'today',status:'unfinished'},{id:'b',ownerIdentifier:'B',date:'today'},{id:'guest',date:'today'}];
 const scope=new Function('records','activeUserIdentifier','recordDateKey','saveRecords','refreshScorePanel',extract('ownedRecords')+extract('recordsForDate')+extract('mergeSyncedRecords')+';return {recordsForDate,mergeSyncedRecords};')(records,()=> 'A',r=>r.date,()=>{},()=>{});
 assert.deepEqual(scope.recordsForDate('today').map(r=>r.id),['a']);
 scope.mergeSyncedRecords([{id:'a',status:'completed',date:'today'}]);assert.equal(records[0].status,'completed');assert.equal(records[0].ownerIdentifier,'A');
});
