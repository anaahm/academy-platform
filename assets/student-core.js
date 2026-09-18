(() => {
'use strict';
const cfg=window.ACADEMY_FIREBASE_CONFIG;
if(!cfg) throw new Error('Firebase config missing');
if(!firebase.apps.length) firebase.initializeApp(cfg);
const auth=firebase.auth(),db=firebase.database();

const stageNames={primary:'المرحلة الابتدائية',prep:'المرحلة الإعدادية',sec:'المرحلة الثانوية'};
const gradeNames={
 primary:{1:'الصف الأول الابتدائي',2:'الصف الثاني الابتدائي',3:'الصف الثالث الابتدائي',4:'الصف الرابع الابتدائي',5:'الصف الخامس الابتدائي',6:'الصف السادس الابتدائي'},
 prep:{1:'الصف الأول الإعدادي',2:'الصف الثاني الإعدادي',3:'الصف الثالث الإعدادي'},
 sec:{1:'الصف الأول الثانوي',2:'الصف الثاني الثانوي',3:'الصف الثالث الثانوي'}
};
const defaultSubjects={
 primary:[{id:'arabic',name:'اللغة العربية',emoji:'📖'},{id:'math',name:'الرياضيات',emoji:'🧮'},{id:'science',name:'العلوم',emoji:'🔬'},{id:'english',name:'اللغة الإنجليزية',emoji:'🇬🇧'},{id:'social',name:'الدراسات الاجتماعية',emoji:'🌍'},{id:'religion',name:'التربية الدينية',emoji:'🕌'}],
 prep:[{id:'arabic',name:'اللغة العربية',emoji:'📖'},{id:'math',name:'الرياضيات',emoji:'🧮'},{id:'science',name:'العلوم',emoji:'🔬'},{id:'english',name:'اللغة الإنجليزية',emoji:'🇬🇧'},{id:'social',name:'الدراسات الاجتماعية',emoji:'🌍'},{id:'computer',name:'الحاسب الآلي',emoji:'💻'}],
 sec:[{id:'arabic',name:'اللغة العربية',emoji:'📖'},{id:'english',name:'اللغة الإنجليزية',emoji:'🇬🇧'},{id:'math',name:'الرياضيات',emoji:'🧮'},{id:'physics',name:'الفيزياء',emoji:'⚛️'},{id:'chemistry',name:'الكيمياء',emoji:'🧪'},{id:'biology',name:'الأحياء',emoji:'🧬'},{id:'history',name:'التاريخ',emoji:'🏛️'},{id:'geography',name:'الجغرافيا',emoji:'🌍'}]
};

const esc=(v='')=>String(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const safeUrl=(u='')=>{try{const x=new URL(u);return ['http:','https:'].includes(x.protocol)?x.href:'#'}catch{return'#'}};
const initials=(n='طالب')=>(n.trim()[0]||'ط').toUpperCase();
const typeLabel=t=>t==='azhar'?'التعليم الأزهري':'التعليم العام';
const stageLabel=s=>stageNames[s]||s||'';
const gradeLabel=(s,g)=>gradeNames[s]?.[g]||'';
const lessonUrl=(ctx,id)=>'./lesson.html?'+new URLSearchParams({type:ctx.type,stage:ctx.stage,grade:String(ctx.grade),subject:ctx.subject,id}).toString();
const quizUrl=(ctx,id)=>'./lesson.html?'+new URLSearchParams({type:ctx.type,stage:ctx.stage,grade:String(ctx.grade),subject:ctx.subject,quiz:id}).toString();
const subjectUrl=ctx=>'./subject.html?'+new URLSearchParams({type:ctx.type,stage:ctx.stage,grade:String(ctx.grade),subject:ctx.subject}).toString();

function toast(msg,type='success'){
 let el=document.getElementById('toast');
 if(!el){el=document.createElement('div');el.id='toast';document.body.appendChild(el)}
 el.textContent=msg;el.className='toast show '+type;clearTimeout(toast.t);toast.t=setTimeout(()=>el.className='toast',3000);
}
async function getProfile(uid){
 const s=await db.ref('studentProfilesV3/'+uid).once('value');return s.val()||{};
}
function subjectsFor(data,stage,grade,type){
 const list=[...(defaultSubjects[stage]||[])],custom=data?.customSubjects?.[stage]?.[grade],arr=Array.isArray(custom)?custom:Object.values(custom||{});
 arr.forEach(s=>{
   if(!s?.id||!s?.name||(s.type&&s.type!==type))return;
   const i=list.findIndex(x=>x.id===s.id),item={id:s.id,name:s.name,emoji:s.emoji||'📚',units:s.units||[]};
   if(i>=0)list[i]={...list[i],...item};else list.push(item);
 });
 return list;
}
function subjectName(data,id,stage,grade,type){
 return subjectsFor(data,stage,String(grade),type).find(s=>s.id===id)?.name||id||'مادة';
}
async function requireStudent(){
 return new Promise(resolve=>{
   auth.onAuthStateChanged(async user=>{
     if(!user){location.replace('./index.html');return}
     const profile=await getProfile(user.uid);
     if(!profile?.stage||!profile?.grade){location.replace('./index.html');return}
     resolve({user,profile});
   });
 });
}
async function updateProfile(uid,patch){await db.ref('studentProfilesV3/'+uid).update(patch)}
function currentCtx(profile,subject=''){return{type:profile.educationType||'public',stage:profile.stage||'prep',grade:String(profile.grade||1),subject}}

window.AcademyCore={auth,db,esc,safeUrl,initials,typeLabel,stageLabel,gradeLabel,lessonUrl,quizUrl,subjectUrl,toast,getProfile,subjectsFor,subjectName,requireStudent,updateProfile,currentCtx,stageNames,gradeNames,defaultSubjects};
})();