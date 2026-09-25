import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import vm from 'node:vm';
import * as css from 'css-tree';
const context={window:{},URL,location:{href:'https://example.test/academy/index.html'}};
vm.runInNewContext(readFileSync('assets/academy-utils.js','utf8'),context);
const U=context.window.AcademyUtils;
test('URLs reject blank, script, credential URLs and preserve safe internal routes',()=>{
 for(const url of ['',null,undefined,'  ','javascript:alert(1)','data:text/html,hello','https://user:pass@example.test/'])assert.equal(U.safeUrl(url),'');
 assert.equal(U.safeUrl('./planner.html'),'https://example.test/academy/planner.html');
 assert.equal(U.safeUrl('https://example.test/a.pdf'),'https://example.test/a.pdf');
});
test('YouTube embeds require an exact approved host and an eleven-character video ID',()=>{
 const id='dQw4w9WgXcQ';
 for(const url of ['https://youtu.be/'+id,'https://www.youtube.com/watch?v='+id,'https://youtube.com/live/'+id])assert.match(U.youtubeEmbed(url),/youtube-nocookie\.com\/embed\/dQw4w9WgXcQ/);
 for(const url of ['https://youtube.com.evil.test/embed/'+id,'https://example.test/embed/'+id,'javascript:alert(1)',''])assert.equal(U.youtubeEmbed(url),'');
});
test('Question validation preserves aliases and refuses invalid answer positions without dropping questions',()=>{
 const q={question:'سؤال',options:['أ','ب'],correctAnswer:1};
 assert.equal(U.validateQuestions([q])[0].text,'سؤال');
 for(const correctAnswer of [-1,2,1.2,null,'',true,'abc'])assert.throws(()=>U.validateQuestions([{...q,correctAnswer}]),/رقم 1/);
 assert.throws(()=>U.validateQuestions([q,{...q,options:['']}]),/رقم 2/);
});
test('Student targeting excludes hidden, inactive and mismatched broadcasts',()=>{
 const p={educationType:'public',stage:'prep',grade:2};
 assert.equal(U.matchesStudent({},p),true);
 assert.equal(U.matchesStudent({grade:'2',stage:'prep'},p),true);
 for(const item of [{isHidden:true},{isActive:false},{type:'azhar'},{stage:'sec'},{grade:1}])assert.equal(U.matchesStudent(item,p),false);
});
test('Every stylesheet parses and the final responsive grid declarations are valid',()=>{
 for(const f of readdirSync('assets').filter(f=>f.endsWith('.css')))css.parse(readFileSync('assets/'+f,'utf8'),{onParseError:e=>{throw e}});
 const ast=css.parse(readFileSync('assets/experience.css','utf8'));
 css.walk(ast,n=>{if(n.type==='Declaration'&&n.property==='grid-template-columns')assert.equal(css.lexer.matchProperty(n.property,n.value).error,null,css.generate(n));});
});
test('The authoritative hidden-state selector remains more specific than decorative selectors',()=>{
 assert.match(readFileSync('assets/experience.css','utf8'),/html body \.hidden,html body \[hidden\]\{display:none!important\}/);
});
