(() => {
'use strict';
const C=window.AcademyCore,$=id=>document.getElementById(id),params=new URLSearchParams(location.search);
function deny(){
 $('certificateLoading').classList.add('hidden');$('certificateApp').classList.add('hidden');$('certificateDenied').classList.remove('hidden');
}
(async()=>{
 try{
  const {user,profile}=await C.requireStudent();
  const type=params.get('type')||profile.educationType,stage=params.get('stage')||profile.stage,grade=params.get('grade')||String(profile.grade),subject=params.get('subject');
  if(!subject||!['public','azhar'].includes(type)||!['primary','prep','sec'].includes(stage))return deny();
  const [lessonsSnap,subjectsSnap]=await Promise.all([
    C.db.ref('lessons').orderByChild('stage').equalTo(stage).once('value'),
    C.db.ref('customSubjects').once('value')
  ]);
  const lessons=Object.entries(lessonsSnap.val()||{}).map(([id,v])=>({id,...(v||{})})).filter(l=>
    !l.isHidden&&l.type===type&&l.stage===stage&&String(l.grade)===String(grade)&&l.subject===subject
  );
  if(!lessons.length)return deny();
  const progress=profile.learningProgress||{},complete=lessons.every(l=>progress[l.id]?.completed);
  if(!complete)return deny();
  const subjectName=C.subjectName({customSubjects:subjectsSnap.val()||{}},subject,stage,String(grade),type);
  const completedDates=lessons.map(l=>Number(progress[l.id]?.completedAt||0)).filter(Boolean);
  const completedAt=completedDates.length?Math.max(...completedDates):Date.now();
  $('certificateStudent').textContent=profile.name||user.displayName||'طالب الأكاديمية';
  $('certificateSubject').textContent=subjectName;
  $('certificateGrade').textContent=C.gradeLabel(stage,grade)||C.stageLabel(stage);
  $('certificateType').textContent=C.typeLabel(type);
  $('certificateDate').textContent=new Date(completedAt).toLocaleDateString('ar-EG',{day:'numeric',month:'long',year:'numeric'});
  $('certificateCode').textContent='ACA-'+user.uid.slice(0,6).toUpperCase()+'-'+String(subject).replace(/[^a-zA-Z0-9_-]/g,'').toUpperCase().slice(0,16)+'-'+String(completedAt).slice(-6);
  $('certificateLoading').classList.add('hidden');$('certificateApp').classList.remove('hidden');
  $('printCertificate').onclick=()=>window.print();
 }catch(err){
  console.error(err);deny();
 }
})();
})();