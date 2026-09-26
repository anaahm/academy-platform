import {JSDOM,VirtualConsole} from 'jsdom';
import {readFileSync,readdirSync} from 'node:fs';
import assert from 'node:assert/strict';
const files=readdirSync('.').filter(f=>f.endsWith('.html'));
const question={text:'ما ناتج 1 + 1؟',opts:['1','2'],correctAnswer:1};
const today=new Date(),date=today.getFullYear()+'-'+String(today.getMonth()+1).padStart(2,'0')+'-'+String(today.getDate()).padStart(2,'0');
function fixtures(){return {
 studentProfilesV3:{tester:{name:'طالب الاختبار',educationType:'public',stage:'prep',grade:1,onboardingCompleted:true,stats:{totalXP:50,completedLessons:0,completedQuizzes:0,streak:1,level:1},studyPlanner:{task:{title:'مراجعة الدرس',date,done:false}},learningProgress:{}}},
 adminProfiles:{tester:{isAdmin:true,name:'مدير الاختبار'}},teacherProfiles:{tester:{name:'مدرس الاختبار',isActive:true,subjects:[{type:'public',stage:'prep',grade:'1',subject:'arabic'}]}},
 customSubjects:{prep:{1:[{id:'arabic',name:'اللغة العربية',emoji:'📘',type:'public',imageUrl:'https://example.test/broken.jpg',units:[{name:'النحو'}]}]}},
 lessons:{lesson1:{title:'المبتدأ والخبر',content:'شرح تجريبي',type:'public',stage:'prep',grade:'1',subject:'arabic',unit:1,teacherId:'tester',videos:[],questions:[question]}},
 quizzes:{quiz1:{name:'اختبار النحو',type:'public',stage:'prep',grade:'1',subject:'arabic',unit:0,questions:[question]}},
 files:{file1:{title:'ملف بلا رابط',type:'public',stage:'prep',grade:'1',subject:'arabic',url:''}},
 assignments:{hw1:{title:'واجب النحو',instructions:'أجب',type:'public',stage:'prep',grade:'1',subject:'arabic',teacherId:'tester',maxScore:10,dueAt:Date.now()+86400000}},
 assignmentSubmissions:{hw1:{student2:{studentName:'طالب تجريبي',status:'submitted',text:'إجابة',submittedAt:Date.now()}}},
 liveSessions:{live1:{title:'بث مناسب',type:'public',stage:'prep',grade:'1',status:'live'},live2:{title:'بث لا يخص الطالب',stage:'sec',status:'live'}},
 community:{forums:{post1:{title:'مراجعة',content:'أهلًا',authorId:'tester',authorName:'طالب الاختبار',createdAt:Date.now()}},studyGroups:{}},
 settings:{},posts:{},announcements:{},scheduleEvents:{},notificationBroadcasts:{},simulations:{},contentAnalytics:{},leaderboardV3:{},teacherSubmissions:{}
}}
let failures=0,scenarios=0;
async function check(file,role='student',failurePath=''){
 const errors=[],writes=[],database=fixtures(),callbacks=[];
 const v=new VirtualConsole();v.on('jsdomError',e=>{if(!/navigation|scrollTo|Not implemented/.test(e.message))errors.push(e.message)});
 v.on('error',(...args)=>{if(!failurePath)errors.push(args.map(x=>x?.stack||String(x)).join(' '))});
 const dom=new JSDOM(readFileSync(file,'utf8').replace(/<link[^>]*>/g,''),{url:'https://example.test/academy/'+file+'?type=public&stage=prep&grade=1&subject=arabic&id=lesson1',runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:v});
 const w=dom.window;w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};
 w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});
 w.requestAnimationFrame=fn=>w.setTimeout(()=>fn(Date.now()),0);
 w.fetch=()=>Promise.reject(new Error('No external requests in smoke tests'));
 const clone=x=>x==null?null:JSON.parse(JSON.stringify(x));
 const get=path=>path.split('/').filter(Boolean).reduce((a,k)=>a?.[k],database)??null;
 const set=(path,value)=>{const parts=path.split('/').filter(Boolean),last=parts.pop();let node=database;for(const k of parts)node=node[k]??={};if(value===null)delete node[last];else node[last]=clone(value);writes.push(path)};
 const snap=value=>({val:()=>clone(value),exists:()=>value!=null,forEach:fn=>Object.entries(value||{}).some(([key,value])=>fn({...snap(value),key})),numChildren:()=>Object.keys(value||{}).length});
 let pushed=0;
 function ref(path='',query={}){
  const value=()=>{let x=get(path);if(query.order&&query.equal!==undefined)x=Object.fromEntries(Object.entries(x||{}).filter(([,v])=>v?.[query.order]===query.equal));return x};
  const r={key:path.split('/').pop(),child:k=>ref(path+'/'+k),orderByChild:k=>ref(path,{...query,order:k}),equalTo:v=>ref(path,{...query,equal:v}),limitToLast:()=>r,
   once:async()=>{if(failurePath&&path.startsWith(failurePath))throw new Error('PERMISSION_DENIED fixture');return snap(value())},
   on:(event,fn,onError)=>{Promise.resolve().then(()=>{if(failurePath&&path.startsWith(failurePath))onError?.(new Error('PERMISSION_DENIED fixture'));else fn(snap(value()))});return fn},off(){},
   set:async v=>set(path,v),update:async v=>{for(const [key,val] of Object.entries(v))set(path+'/'+key,val)},remove:async()=>set(path,null),
   push:(value)=>{const child=ref(path+'/new'+(++pushed));if(value!==undefined)child.set(value);return child},transaction:async fn=>{const next=fn(clone(get(path)));if(next===undefined)return {committed:false,snapshot:snap(get(path))};set(path,next);return {committed:true,snapshot:snap(next)}}};return r;
 }
 const user=role==='guest'?null:{uid:'tester',displayName:'اختبار',email:'test@example.test',updateProfile:async()=>{},reload:async()=>{}};
 let createdEmail='',signedInEmail='';
 const auth={currentUser:user,onAuthStateChanged:fn=>{callbacks.push(fn);return ()=>{}},setPersistence:async()=>{},signInWithEmailAndPassword:async email=>{signedInEmail=email;auth.currentUser={uid:'tester',email:'test@example.test'};for(const fn of callbacks)await fn(auth.currentUser);return {user:auth.currentUser}},createUserWithEmailAndPassword:async email=>{createdEmail=email;auth.currentUser={uid:'newStudent',email,updateProfile:async()=>{}};for(const fn of callbacks)await fn(auth.currentUser);return {user:auth.currentUser}},sendPasswordResetEmail:async()=>{},signOut:async()=>{auth.currentUser=null;for(const fn of callbacks)await fn(null)}};
 const secondaryApps=[];
 w.firebase={apps:[],initializeApp:(_config,name)=>{if(name==='teacher-portal'){const app={name,auth:()=>auth,database:()=>({ref})};w.firebase.apps.push(app);return app}if(name){const secondaryAuth={setPersistence:async()=>{},createUserWithEmailAndPassword:async(email,password)=>{assert.ok(password.length>=8);return {user:{uid:'newTeacher',email,delete:async()=>{}}}},signOut:async()=>{}};const app={name,auth:()=>secondaryAuth,delete:async()=>{}};secondaryApps.push(app);return app}w.firebase.apps.push({name:'[DEFAULT]'});return {auth:()=>auth}},auth:Object.assign(()=>auth,{Auth:{Persistence:{LOCAL:'local',NONE:'none'}},EmailAuthProvider:{credential:()=>({})}}),database:Object.assign(()=>({ref}),{ServerValue:{TIMESTAMP:Date.now(),increment:n=>n}})};
 const unhandled=e=>errors.push(String(e?.stack||e));process.on('unhandledRejection',unhandled);
 try{
  for(const script of w.document.querySelectorAll('script[src]')){
   const src=script.getAttribute('src');if(src.startsWith('http')||src.includes('pwa.js'))continue;
   try{w.eval(readFileSync(src.replace('./','').split('?')[0],'utf8')+'\n//# sourceURL='+src)}catch(e){errors.push(src+': '+e.stack)}
  }
  await new Promise(r=>setTimeout(r,15));
  for(const cb of [...callbacks]){try{await cb(user)}catch(e){errors.push('auth: '+e.stack)}}
  await new Promise(r=>setTimeout(r,40));
  if(file==='index.html'){
    assert.equal(w.document.getElementById('studentDashboard').classList.contains('hidden'),role==='guest');
    if(role!=='guest')assert.equal(w.document.querySelectorAll('#dashboardSubjects a').length,6,'all default subjects render');
  }
  if(file==='index.html'&&role==='guest'){
   const field=id=>w.document.getElementById(id);
   field('registerName').value='طالب جديد';field('registerPhone').value='٠١٠١٢٣٤٥٦٧٨';field('registerPassword').value='12345678';
   field('registerEducationType').value='azhar';field('registerStage').value='prep';field('registerStage').dispatchEvent(new w.Event('change'));
   assert.equal(field('registerGrade').disabled,false,'stage selection enables grade');field('registerGrade').value='2';
   field('registerForm').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
   await new Promise(r=>setTimeout(r,25));
   assert.equal(createdEmail,'p201012345678@students.academy.invalid','Arabic digits resolve to the same phone login');
   assert.equal(get('studentProfilesV3/newStudent/phone'),'+201012345678');
   assert.equal(get('studentProfilesV3/newStudent/email'),null,'internal identifier is not exposed in student profile');
   assert.equal(get('studentProfilesV3/newStudent/educationType'),'azhar');
   assert.equal(get('studentProfilesV3/newStudent/stage'),'prep');
   assert.equal(get('studentProfilesV3/newStudent/grade'),2);
   assert.equal(get('studentProfilesV3/newStudent/onboardingCompleted'),true);
   assert.equal(field('studentDashboard').classList.contains('hidden'),false,'new account opens its selected curriculum');
   field('loginPhone').value=' +20 101 234 5678 ';field('loginPassword').value='12345678';
   field('loginForm').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
   await new Promise(r=>setTimeout(r,25));
   assert.equal(signedInEmail,createdEmail,'login converts phone formats to the same account');
   field('legacyLoginToggle').click();field('loginEmail').value='old@example.test';
   field('loginForm').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
   await new Promise(r=>setTimeout(r,25));
   assert.equal(signedInEmail,'old@example.test','old email users retain login');
  }
  if(file==='library.html')assert.equal(w.document.querySelectorAll('.library-open[href]').length,0,'empty URL must not be clickable');
  if(file==='planner.html'){
   w.document.getElementById('plannerTitle').value='مراجعة تجريبية';
   w.document.getElementById('plannerForm').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
   await new Promise(r=>setTimeout(r,15));assert.equal(Object.values(get('studentProfilesV3/tester/studyPlanner')).some(t=>t.title==='مراجعة تجريبية'),true);
  }
  if(file==='assignments.html'){
   w.document.querySelector('[data-open-assignment]').click();w.document.getElementById('assignmentAnswer').value='إجابة تجريبية';
   w.document.getElementById('assignmentSubmitForm').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
   await new Promise(r=>setTimeout(r,15));assert.equal(get('assignmentSubmissions/hw1/tester/status'),'submitted');
  }
  if(file==='notifications.html')assert.ok(!w.document.body.textContent.includes('بث لا يخص الطالب'));
  if(file==='live.html'){
   assert.equal(w.document.querySelectorAll('[data-open-session]').length,1,'stage filter');
   w.document.querySelector('[data-open-session]').click();assert.equal(w.document.getElementById('liveViewer').classList.contains('hidden'),false);
   w.document.getElementById('closeLiveViewer').click();assert.equal(w.document.getElementById('liveVideo').children.length,0);
  }
  if(file==='lesson.html'){
   const b=w.document.getElementById('markCompleteBtn');if(b&&!b.disabled){b.click();b.click();await new Promise(r=>setTimeout(r,30));assert.equal(get('studentProfilesV3/tester/stats/totalXP'),100,'double click gives only one award');}
   w.document.getElementById('startQuizBtn').click();assert.ok(w.document.querySelector('[data-a]'),'quiz options');
   w.document.querySelector('[data-a="1"]').click();w.document.getElementById('nextQuestionBtn').click();await new Promise(r=>setTimeout(r,30));
   assert.equal(w.document.getElementById('resultPercent').textContent,'100%');
  }
  if(file==='admin.html'&&role!=='guest'){
   for(const tab of w.document.querySelectorAll('[data-admin-tab]')){tab.click();await new Promise(r=>setTimeout(r,8));}
   const form=w.document.getElementById('createTeacherForm');
   w.document.getElementById('newTeacherName').value='مدرس جديد';w.document.getElementById('newTeacherEmail').value='newteacher@example.test';w.document.getElementById('newTeacherPassword').value='long-secure-password';
   form.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await new Promise(r=>setTimeout(r,20));
   assert.equal(get('teacherProfiles/newTeacher/name'),'مدرس جديد');assert.equal(get('teacherProfiles/newTeacher/email'),'newteacher@example.test');
   assert.equal(JSON.stringify(database).includes('long-secure-password'),false,'teacher password never stored in database');
   assert.equal(auth.currentUser?.uid,'tester','admin session stays active');assert.equal(secondaryApps.length,1);
   auth.currentUser={uid:'newTeacher',email:'newteacher@example.test'};
   for(const cb of [...callbacks])await cb(auth.currentUser);
   assert.equal(auth.currentUser.uid,'newTeacher','admin page must not sign out a teacher in another tab');
   assert.equal(w.document.getElementById('adminApp').classList.contains('hidden'),true,'admin view stays protected');
  }
  if(file==='teacher.html'){
   assert.ok(w.firebase.apps.some(app=>app.name==='teacher-portal'),'teacher portal uses its own Firebase auth session');
   if(role==='guest'){
    assert.equal(w.document.getElementById('teacherLoginForm').classList.contains('hidden'),false);
    w.document.getElementById('teacherLoginEmail').value='test@example.test';w.document.getElementById('teacherLoginPassword').value='correct-password';
    w.document.getElementById('teacherLoginForm').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await new Promise(r=>setTimeout(r,25));
    assert.equal(w.document.getElementById('teacherPortal').classList.contains('hidden'),false);
   }else{
    assert.equal(w.document.getElementById('teacherPortal').classList.contains('hidden'),false);
    for(const tab of w.document.querySelectorAll('[data-teacher-tab]'))tab.click();
    if(failurePath)assert.match(w.document.getElementById('teacherAssignmentSubmissions').textContent,/غير متاحة/);
   }
  }
  if(file==='index.html'&&role==='student'){
   const img=w.document.querySelector('img[data-subject-image]');if(img){img.dispatchEvent(new w.Event('error'));assert.equal(w.document.querySelectorAll('#dashboardSubjects img[data-subject-image]').length,0)}
   const dialog=w.AcademyUI.confirm({message:'اختبار'});await new Promise(r=>setTimeout(r,5));w.document.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Tab'}));w.document.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape'}));assert.equal(await dialog,false);
   await auth.signOut();await new Promise(r=>setTimeout(r,5));assert.equal(w.document.querySelectorAll('.student-mobile-nav').length,0);
  }
 }catch(e){errors.push(e.stack)}
 finally{await new Promise(r=>setTimeout(r,10));dom.window.close();process.removeListener('unhandledRejection',unhandled)}
 scenarios++;if(errors.length){failures++;console.error('FAIL',file,role,failurePath,errors.join('\n'))}else console.log('PASS',file,role,failurePath||'');
}
for(const file of files)await check(file,file==='admin.html'?'admin':file==='teacher.html'?'teacher':'student');
await check('index.html','guest');await check('admin.html','guest');await check('teacher.html','guest');await check('teacher.html','teacher','assignmentSubmissions/');
console.log(`DOM smoke: ${scenarios-failures}/${scenarios} scenarios passed. Uses in-memory Firebase fixtures, not live Firebase or layout rendering.`);
if(failures)process.exit(1);
