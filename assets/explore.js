(() => {
'use strict';

const firebaseConfig = window.ACADEMY_FIREBASE_CONFIG || JSON.parse(localStorage.getItem('academyFirebaseConfig') || 'null');
if(!firebaseConfig){location.replace('./index.html');return}
if(!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const db=firebase.database();
const $=id=>document.getElementById(id), $$=(s,r=document)=>[...r.querySelectorAll(s)];

const state={type:'public',stage:'primary',grade:null,data:{},search:''};
const grades={primary:[1,2,3,4,5,6],prep:[1,2,3],sec:[1,2,3]};
const gradeNames={
 primary:{1:'الأول الابتدائي',2:'الثاني الابتدائي',3:'الثالث الابتدائي',4:'الرابع الابتدائي',5:'الخامس الابتدائي',6:'السادس الابتدائي'},
 prep:{1:'الأول الإعدادي',2:'الثاني الإعدادي',3:'الثالث الإعدادي'},
 sec:{1:'الأول الثانوي',2:'الثاني الثانوي',3:'الثالث الثانوي'}
};
const defaults={
 primary:[{id:'arabic',name:'اللغة العربية',emoji:'📖'},{id:'math',name:'الرياضيات',emoji:'🧮'},{id:'science',name:'العلوم',emoji:'🔬'},{id:'english',name:'اللغة الإنجليزية',emoji:'🇬🇧'},{id:'social',name:'الدراسات الاجتماعية',emoji:'🌍'},{id:'religion',name:'التربية الدينية',emoji:'🕌'}],
 prep:[{id:'arabic',name:'اللغة العربية',emoji:'📖'},{id:'math',name:'الرياضيات',emoji:'🧮'},{id:'science',name:'العلوم',emoji:'🔬'},{id:'english',name:'اللغة الإنجليزية',emoji:'🇬🇧'},{id:'social',name:'الدراسات الاجتماعية',emoji:'🌍'},{id:'computer',name:'الحاسب الآلي',emoji:'💻'}],
 sec:[{id:'arabic',name:'اللغة العربية',emoji:'📖'},{id:'english',name:'اللغة الإنجليزية',emoji:'🇬🇧'},{id:'math',name:'الرياضيات',emoji:'🧮'},{id:'physics',name:'الفيزياء',emoji:'⚛️'},{id:'chemistry',name:'الكيمياء',emoji:'🧪'},{id:'biology',name:'الأحياء',emoji:'🧬'},{id:'history',name:'التاريخ',emoji:'🏛️'},{id:'geography',name:'الجغرافيا',emoji:'🌍'}]
};

function getSubjects(stage,grade,type){
 const list=[...(defaults[stage]||[])], custom=state.data.customSubjects?.[stage]?.[grade];
 if(Array.isArray(custom))custom.forEach(s=>{
   if(!s?.id||!s?.name||(s.type&&s.type!==type))return;
   const item={id:s.id,name:s.name,emoji:s.emoji||'⭐'},i=list.findIndex(x=>x.id===s.id);
   if(i>=0)list[i]={...list[i],...item};else list.push(item);
 });
 return list;
}
function countContent(subjectId){
 const lessons=Object.values(state.data.lessons||{}).filter(l=>l.type===state.type&&l.stage===state.stage&&String(l.grade)===String(state.grade)&&l.subject===subjectId&&!l.isHidden).length;
 const quizzes=Object.values(state.data.quizzes||{}).filter(q=>q.type===state.type&&q.stage===state.stage&&String(q.grade)===String(state.grade)&&q.subject===subjectId&&!q.isHidden).length;
 return {lessons,quizzes};
}
function subjectUrl(id){
 const q=new URLSearchParams({type:state.type,stage:state.stage,grade:String(state.grade),subject:id});
 return './subject.html?'+q.toString();
}
function renderGrades(){
 $('exploreGradeGrid').innerHTML=grades[state.stage].map(g=>`<button class="${state.grade===g?'active':''}" data-grade="${g}"><strong>${g}</strong><span>${gradeNames[state.stage][g]}</span></button>`).join('');
 $$('[data-grade]').forEach(b=>b.onclick=()=>{state.grade=Number(b.dataset.grade);$$('[data-grade]').forEach(x=>x.classList.toggle('active',x===b));renderSubjects()});
 if(!state.grade){$('exploreSubjectBlock').classList.add('hidden');$('gradeHint').textContent='اختر الصف لعرض مواده'}
}
function renderSubjects(){
 const subjects=getSubjects(state.stage,String(state.grade),state.type).filter(s=>!state.search||s.name.includes(state.search));
 $('exploreSubjectBlock').classList.remove('hidden');
 $('gradeHint').textContent=gradeNames[state.stage][state.grade];
 $('exploreSubjectsTitle').textContent='مواد '+gradeNames[state.stage][state.grade];
 $('exploreSubjectCount').textContent=subjects.length+' مادة';
 $('exploreSubjectGrid').innerHTML=subjects.map(s=>{
   const c=countContent(s.id);
   return `<a class="explore-subject-card" href="${subjectUrl(s.id)}"><span class="explore-subject-emoji">${s.emoji||'📚'}</span><div><h3>${s.name}</h3><p>${c.lessons} درس • ${c.quizzes} اختبار</p></div><span class="explore-open"><i class="fa-solid fa-arrow-left"></i></span></a>`;
 }).join('')||'<div class="empty-state"><span>🔎</span><h3>لا توجد مادة مطابقة</h3></div>';
}
function selectType(type){
 state.type=type;state.grade=null;
 $$('[data-type]').forEach(b=>b.classList.toggle('active',b.dataset.type===type));
 $('activeTypeLabel').textContent=type==='azhar'?'التعليم الأزهري':'التعليم العام';
 renderGrades();
}
function selectStage(stage){
 state.stage=stage;state.grade=null;
 $$('[data-stage]').forEach(b=>b.classList.toggle('active',b.dataset.stage===stage));
 renderGrades();
}

$$('[data-type]').forEach(b=>b.onclick=()=>selectType(b.dataset.type));
$$('[data-stage]').forEach(b=>b.onclick=()=>selectStage(b.dataset.stage));
$('explorePageSearch').addEventListener('input',e=>{state.search=e.target.value.trim();if(state.grade)renderSubjects()});

Promise.all([
  db.ref('customSubjects').once('value'),
  db.ref('lessons').once('value'),
  db.ref('quizzes').once('value')
]).then(([subjectsSnap,lessonsSnap,quizzesSnap])=>{
  state.data={customSubjects:subjectsSnap.val()||{},lessons:lessonsSnap.val()||{},quizzes:quizzesSnap.val()||{}};
  renderGrades();
}).catch(()=>renderGrades());
})();