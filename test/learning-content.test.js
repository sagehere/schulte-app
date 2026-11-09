const test=require('node:test'),assert=require('node:assert/strict');
const bank=require('../src/content/learning.json'),checks=require('../src/content/checks.json');
test('expanded content keeps materials and IDs distinct across teaching and checking',()=>{
 const all=[...bank,...checks];assert.equal(new Set(all.map(u=>u.id)).size,108);
 assert.equal(new Set(all.map(u=>u.lines.join('').replace(/\s/g,''))).size,108);
 for(const u of all){assert.ok(u.title&&u.lines.every(s=>typeof s==='string'&&s.trim()));for(const q of u.steps){assert.ok(q.explanation&&q.hints.length===3);if(q.options)assert.equal(new Set(q.options).size,q.options.length);}}
});
test('every accepted arithmetic expression agrees with the authored calculation result',()=>{
 for(const u of [...bank,...checks])for(let i=0;i<u.steps.length;i++){
  const q=u.steps[i];if(q.skill!=='列式'||q.options)continue;
  const calc=u.steps[i+1];assert.equal(calc.skill,'计算');const expected=Number(calc.answers[0].match(/^-?\d+(?:\.\d+)?/)[0]);
  for(const answer of q.answers){const [expression,rhs]=answer.normalize('NFKC').replace(/×/g,'*').replace(/÷/g,'/').replace(/－/g,'-').split('=');assert.match(expression,/^[\d+\-*/().\s]+$/);const actual=Function('"use strict";return ('+expression+');')();assert.equal(actual,expected,u.id+': '+answer);if(rhs)assert.equal(Number(rhs),expected);}
 }
});
