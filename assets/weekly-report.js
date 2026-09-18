(() => {
'use strict';
const C=window.AcademyCore,$=id=>document.getElementById(id);
let user,profile,data={customSubjects:{}};

const DAY=86400000;
function startOfDay(d=new Date()){const x=new Date(d);x.setHours(0,0,0,0);return x}
function mondayOf(date=new Date()){
 const d=startOfDay(date),day=(d.getDay()+6)%7;d.setDate(d.getDate()-day);return d;
}
function rangeLabel(start,end){return start.toLocaleDateString('ar-EG',{day:'numeric',month:'short'})+' — '+end.toLocaleDateString('ar-EG',{day:'numeric',month:'short',year:'numeric'})}
function between(ts,start,end){const n=Number(ts||0);return n>=start.getTime()&&n<end.getTime()}
function values(o){return Object.values(o||{})}
function quizHistory(){return values(profile.quizHistory)}
function simHistory(){return values(profile.simulationHistory)}
function lessonsHistory(){return values(profile.learningProgress).filter(x=>x?.completed&&x.completedAt)}
function activityMinutes(start,end){
 let total=0;Object.entries(profile.activityDaily||{}).forEach(([key,v])=>{const d=new Date(key+'T00:00:00');if(d>=start&&d<end)total+=Number(v?.minutes||0)});return total;
}
function weeklySeries(start){
 const out=[];for(let i=0;i<7;i++){const d=new Date(start.getTime()+i*DAY),key=d.toISOString().slice(0,10);out.push({date:d,key,label:d.toLocaleDateString('ar-EG',{weekday:'short'}),minutes:Number(profile.activityDaily?.[key]?.minutes||0)})}return out;
}
function pctChange(now,prev){
 if(prev<=0)return now>0?100:0;
 return Math.round((now-prev)/prev*100);
}
function scoreClass(v){return v>=80?'good':v>=60?'mid':'low'}

function render(){
 const currentStart=mondayOf(),currentEnd=new Date(currentStart.getTime()+7*DAY),prevStart=new Date(currentStart.getTime()-7*DAY),prevEnd=currentStart;
 const now=new Date();$('weeklyRange').textContent=rangeLabel(currentStart,new Date(Math.min(currentEnd.getTime()-1,now.getTime())));

 const qh=quizHistory(),sh=simHistory(),lh=lessonsHistory();
 const currentQ=qh.filter(x=>between(x.createdAt,currentStart,currentEnd)),prevQ=qh.filter(x=>between(x.createdAt,prevStart,prevEnd));
 const currentS=sh.filter(x=>between(x.createdAt,currentStart,currentEnd)),prevS=sh.filter(x=>between(x.createdAt,prevStart,prevEnd));
 const currentL=lh.filter(x=>between(x.completedAt,currentStart,currentEnd)),prevL=lh.filter(x=>between(x.completedAt,prevStart,prevEnd));
 const minutes=activityMinutes(currentStart,currentEnd),prevMinutes=activityMinutes(prevStart,prevEnd);
 const avg=currentQ.length?Math.round(currentQ.reduce((a,x)=>a+Number(x.score||0),0)/currentQ.length):0;
 const prevAvg=prevQ.length?Math.round(prevQ.reduce((a,x)=>a+Number(x.score||0),0)/prevQ.length):0;

 $('weeklyMinutes').textContent=minutes;$('weeklyLessons').textContent=currentL.length;$('weeklyQuizzes').textContent=currentQ.length;$('weeklyAverage').textContent=currentQ.length?avg+'%':'—';
 const score=currentL.length*2+currentQ.length*2+currentS.length*3+Math.min(10,Math.round(minutes/30));
 $('weeklySummary').textContent=score>=18?'أسبوع قوي جدًا 👏 حافظ على نفس الإيقاع.':score>=9?'أسبوع جيد، ومع تنظيم بسيط تقدر ترفع مستواك أكتر.':'الأسبوع كان هادئ. ابدأ بخطوات صغيرة ومنتظمة بدل ضغط يوم واحد.';

 const series=weeklySeries(currentStart),max=Math.max(1,...series.map(x=>x.minutes));
 $('weeklyBars').innerHTML=series.map(x=>'<div class="weekly-bar-col"><div class="weekly-bar-value">'+x.minutes+'</div><div class="weekly-bar-track"><span style="height:'+Math.max(4,Math.round(x.minutes/max*100))+'%"></span></div><strong>'+C.esc(x.label)+'</strong></div>').join('');

 const metrics=[
   {label:'وقت المذاكرة',now:minutes,prev:prevMinutes,suffix:' د',icon:'⏱️'},
   {label:'الدروس المكتملة',now:currentL.length,prev:prevL.length,suffix:'',icon:'✅'},
   {label:'الاختبارات',now:currentQ.length,prev:prevQ.length,suffix:'',icon:'🎯'},
   {label:'متوسط النتائج',now:avg,prev:prevAvg,suffix:'%',icon:'⭐'}
 ];
 $('weeklyComparison').innerHTML=metrics.map(m=>{
   const ch=pctChange(m.now,m.prev),up=ch>0,flat=ch===0;
   return '<div class="weekly-compare-row"><span>'+m.icon+'</span><div><strong>'+m.label+'</strong><small>السابق: '+m.prev+m.suffix+'</small></div><b>'+m.now+m.suffix+'</b><em class="'+(flat?'flat':up?'up':'down')+'">'+(flat?'—':up?'▲ ':'▼ ')+Math.abs(ch)+'%</em></div>';
 }).join('');

 const subjects=C.subjectsFor(data,profile.stage,String(profile.grade),profile.educationType),sp=profile.subjectProgress||{};
 const ranked=subjects.map(s=>({...s,p:Number(sp[s.id]||0)})).sort((a,b)=>b.p-a.p);
 $('weeklySubjects').innerHTML=ranked.length?ranked.map(s=>'<div class="weekly-subject-row"><span>'+C.esc(s.emoji||'📚')+'</span><div><strong>'+C.esc(s.name)+'</strong><div class="progress"><i style="width:'+s.p+'%"></i></div></div><b>'+s.p+'%</b></div>').join(''):'<p class="profile-muted">لا توجد مواد لعرضها.</p>';

 const weak=[...ranked].reverse()[0],strong=ranked[0],recs=[];
 if(weak)recs.push({icon:'🎯',title:'ركّز على '+weak.name,text:'تقدمك '+weak.p+'%. حط جلسة 30 دقيقة لها في أول الأسبوع.',link:'./planner.html'});
 if(avg&&avg<70)recs.push({icon:'🧠',title:'راجع أخطاء الاختبارات',text:'متوسطك هذا الأسبوع '+avg+'%. راجع الشرح قبل إعادة المحاولة.',link:'./exam-center.html'});
 if(minutes<120)recs.push({icon:'⏰',title:'زوّد الاستمرارية',text:'هدف مناسب للأسبوع القادم: 20–30 دقيقة في 5 أيام.',link:'./planner.html'});
 if(strong&&strong.p>=70)recs.push({icon:'🌟',title:'حافظ على قوتك في '+strong.name,text:'أنت متقدم فيها. مراجعة قصيرة كفاية للحفاظ على المستوى.',link:'./subject.html?'+new URLSearchParams({type:profile.educationType,stage:profile.stage,grade:String(profile.grade),subject:strong.id})});
 $('weeklyRecommendations').innerHTML=recs.slice(0,4).map(r=>'<a class="weekly-recommendation" href="'+r.link+'"><span>'+r.icon+'</span><div><strong>'+C.esc(r.title)+'</strong><p>'+C.esc(r.text)+'</p></div><i class="fa-solid fa-arrow-left"></i></a>').join('');

 const results=[
   ...currentQ.map(x=>({kind:'اختبار',name:x.title||'اختبار',score:Number(x.score||0),at:x.createdAt})),
   ...currentS.map(x=>({kind:'محاكاة',name:x.name||'محاكي',score:Number(x.score||0),at:x.createdAt}))
 ].sort((a,b)=>b.at-a.at);
 $('weeklyResults').innerHTML=results.length?results.map(x=>'<div class="weekly-result-row"><span class="status-pill info">'+x.kind+'</span><div><strong>'+C.esc(x.name)+'</strong><small>'+new Date(x.at).toLocaleDateString('ar-EG')+'</small></div><b class="score-pill '+scoreClass(x.score)+'">'+x.score+'%</b></div>').join(''):'<div class="feature-empty"><span>🧪</span><h3>لا توجد نتائج هذا الأسبوع</h3><p>حل اختبار أو محاكي وسيظهر هنا في التقرير.</p></div>';
}
$('printWeeklyReport').onclick=()=>window.print();

(async()=>{
 ({user,profile}=await C.requireStudent());$('pageAvatar').textContent=C.initials(profile.name||user.displayName||'طالب');
 const s=await C.db.ref('customSubjects').once('value');data.customSubjects=s.val()||{};render();
})();
})();