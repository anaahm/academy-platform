(() => {
  'use strict';

  const firebaseConfig = window.ACADEMY_FIREBASE_CONFIG;
  if (!firebaseConfig) throw new Error('Firebase config is missing');

  if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
  const auth = firebase.auth();
  const database = firebase.database();

  const $ = (id) => document.getElementById(id);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  const state = {
    user: null,
    profile: null,
    dbData: {},
    publicTeachers: {},
    explorer: { type: 'all', stage: null, tab: 'stages', search: '' }
  };
  let baseDataPromise = null;
  let registerInProgress = false;
  let legacyEmailLogin = false;
  function phoneLoginEmail(raw) {
    const digits = raw.replace(/[٠-٩۰-۹]/g, character => String(character.charCodeAt(0) - (character.charCodeAt(0) >= 1776 ? 1776 : 1632)))
      .replace(/[\s()\-.]/g, '');
    let phone = digits;
    if (/^01[0125]\d{8}$/.test(phone)) phone = '+20' + phone.slice(1);
    else if (/^0020(1[0125]\d{8})$/.test(phone)) phone = '+20' + phone.slice(4);
    else if (/^20(1[0125]\d{8})$/.test(phone)) phone = '+' + phone;
    if (!/^\+[1-9]\d{7,14}$/.test(phone)) throw new Error('أدخل رقم هاتف صحيحًا، مثل 01012345678، مع رمز الدولة إن كان من خارج مصر.');
    return {phone, email:'p' + phone.slice(1) + '@students.academy.invalid'};
  }
  function phoneIndexKey(phone=''){ return String(phone||'').replace(/\D/g,''); }
  async function ensureStudentPhoneIndex(uid, profile){
    if(!uid||!profile?.phone)return;
    const key=phoneIndexKey(profile.phone);if(!key)return;
    try{
      const ts=Date.now();
      await database.ref().update({
        ['studentPhoneIndexV4/'+key]:{studentId:uid,updatedAt:ts},
        ['phoneDirectoryV4/students/'+uid]:{uid,name:profile.name||'',phone:profile.phone,updatedAt:ts}
      });
    }catch(error){console.warn('Student phone directory sync skipped',error)}
  }

  const stageLabels = {
    primary: 'المرحلة الابتدائية',
    prep: 'المرحلة الإعدادية',
    sec: 'المرحلة الثانوية'
  };

  const gradeLabels = {
    primary: {1:'الصف الأول الابتدائي',2:'الصف الثاني الابتدائي',3:'الصف الثالث الابتدائي',4:'الصف الرابع الابتدائي',5:'الصف الخامس الابتدائي',6:'الصف السادس الابتدائي'},
    prep: {1:'الصف الأول الإعدادي',2:'الصف الثاني الإعدادي',3:'الصف الثالث الإعدادي'},
    sec: {1:'الصف الأول الثانوي',2:'الصف الثاني الثانوي',3:'الصف الثالث الثانوي'}
  };

  const defaults = {
    primary: [
      {id:'arabic',name:'اللغة العربية',emoji:'📖'},
      {id:'math',name:'الرياضيات',emoji:'🧮'},
      {id:'science',name:'العلوم',emoji:'🔬'},
      {id:'english',name:'اللغة الإنجليزية',emoji:'🇬🇧'},
      {id:'social',name:'الدراسات الاجتماعية',emoji:'🌍'},
      {id:'religion',name:'التربية الدينية',emoji:'🕌'}
    ],
    prep: [
      {id:'arabic',name:'اللغة العربية',emoji:'📖'},
      {id:'math',name:'الرياضيات',emoji:'🧮'},
      {id:'science',name:'العلوم',emoji:'🔬'},
      {id:'english',name:'اللغة الإنجليزية',emoji:'🇬🇧'},
      {id:'social',name:'الدراسات الاجتماعية',emoji:'🌍'},
      {id:'computer',name:'الحاسب الآلي',emoji:'💻'}
    ],
    sec: [
      {id:'arabic',name:'اللغة العربية',emoji:'📖'},
      {id:'english',name:'اللغة الإنجليزية',emoji:'🇬🇧'},
      {id:'math',name:'الرياضيات',emoji:'🧮'},
      {id:'physics',name:'الفيزياء',emoji:'⚛️'},
      {id:'chemistry',name:'الكيمياء',emoji:'🧪'},
      {id:'biology',name:'الأحياء',emoji:'🧬'},
      {id:'history',name:'التاريخ',emoji:'🏛️'},
      {id:'geography',name:'الجغرافيا',emoji:'🌍'}
    ]
  };

  function toast(message, type = 'success') {
    const el = $('toast');
    el.textContent = message;
    el.className = 'toast show ' + type;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => el.className = 'toast', 3200);
  }

  function friendlyAuthError(error) {
    const map = {
      'auth/email-already-in-use': 'هذا الرقم مسجل بالفعل. جرّب تسجيل الدخول.',
      'auth/invalid-email': 'صيغة البريد الإلكتروني غير صحيحة.',
      'auth/weak-password': 'كلمة المرور ضعيفة. استخدم 6 أحرف على الأقل.',
      'auth/user-not-found': 'لا يوجد حساب بهذه البيانات.',
      'auth/wrong-password': 'كلمة المرور غير صحيحة.',
      'auth/invalid-login-credentials': 'رقم الهاتف أو البريد أو كلمة المرور غير صحيحة.',
      'auth/too-many-requests': 'محاولات كثيرة. انتظر قليلًا ثم جرّب مرة أخرى.',
      'auth/operation-not-allowed': 'تسجيل البريد وكلمة المرور غير مفعل بعد في Firebase. فعّله من Authentication > Sign-in method.'
    };
    return map[error.code] || error.message || 'حدث خطأ غير متوقع.';
  }

  function openModal(id) {
    const el = $(id);
    if (!el) return;
    el.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  function closeModal(id) {
    const el = $(id);
    if (!el) return;
    el.classList.add('hidden');
    if (!$('explorerDrawer').classList.contains('open')) document.body.style.overflow = '';
  }

  function switchAuthTab(tab) {
    $$('[data-auth-tab]').forEach(btn => btn.classList.toggle('active', btn.dataset.authTab === tab));
    $('loginForm').classList.toggle('hidden', tab !== 'login');
    $('registerForm').classList.toggle('hidden', tab !== 'register');
  }

  function updateGradeOptions(stage) {
    const grid = $('gradeGrid');
    const grades = stage === 'primary' ? [1,2,3,4,5,6] : [1,2,3];
    const short = stage === 'primary'
      ? ['الأول','الثاني','الثالث','الرابع','الخامس','السادس']
      : ['الأول','الثاني','الثالث'];
    grid.innerHTML = grades.map((g, i) =>
      `<label><input type="radio" name="grade" value="${g}" required><span>${short[i]}</span></label>`
    ).join('');
  }

  function getSubjects(stage, grade, type) {
    const base = [...(defaults[stage] || [])];
    const custom = state.dbData.customSubjects?.[stage]?.[grade];
    if (Array.isArray(custom)) {
      custom.forEach(s => {
        if (!s || !s.id || !s.name) return;
        if (s.type && s.type !== type) return;
        const item={id:s.id,name:s.name,emoji:s.emoji||'⭐',imageUrl:s.imageUrl||'',units:s.units||[]};
        const i=base.findIndex(x=>x.id===s.id);
        if(i>=0)base[i]={...base[i],...item};else base.push(item);
      });
    }
    return base;
  }

  function educationLabel(type) {
    return type === 'azhar' ? 'التعليم الأزهري' : 'التعليم العام';
  }

  function subjectProgressOf(profile,subjectId,ctx={}) {
    const type=ctx.type||profile?.educationType||'public';
    const stage=ctx.stage||profile?.stage||'prep';
    const grade=String(ctx.grade||profile?.grade||1);
    const contextual=profile?.subjectProgressV3?.[type]?.[stage]?.[grade]?.[subjectId];
    return contextual===undefined||contextual===null
      ?Number(profile?.subjectProgress?.[subjectId]||0)
      :Number(contextual||0);
  }

  function initials(name = '') {
    return (name.trim()[0] || 'ط').toUpperCase();
  }

  async function loadDatabaseSnapshot() {
    try {
      const [subjectsSnap, announcementsSnap, settingsSnap, postsSnap] = await Promise.all([
        database.ref('customSubjects').once('value'),
        database.ref('announcements').once('value'),
        database.ref('settings').once('value'),
        database.ref('posts').once('value')
      ]);
      state.dbData = {
        customSubjects: subjectsSnap.val() || {},
        announcements: announcementsSnap.val() || {},
        settings: settingsSnap.val() || {},
        posts: postsSnap.val() || {}
      };
    } catch (e) {
      console.warn('Database read unavailable', e);
      state.dbData = {};
    }
  }
  async function loadDashboardLessonCatalog(profile){
    if(!profile?.stage)return;
    try{
      const [lessonsSnap,quizzesSnap,filesSnap]=await Promise.all([
        database.ref('lessons').orderByChild('stage').equalTo(profile.stage).once('value'),
        database.ref('quizzes').orderByChild('stage').equalTo(profile.stage).once('value'),
        database.ref('files').orderByChild('stage').equalTo(profile.stage).once('value')
      ]);
      state.dbData.lessons=lessonsSnap.val()||{};
      state.dbData.quizzes=quizzesSnap.val()||{};
      state.dbData.files=filesSnap.val()||{};
    }catch(error){
      console.warn('Dashboard learning catalog unavailable',error);
      state.dbData.lessons=state.dbData.lessons||{};
      state.dbData.quizzes=state.dbData.quizzes||{};
      state.dbData.files=state.dbData.files||{};
    }
  }

  function renderPublicTeachers(teachers={}) {
    const container=$('publicTeacherCards');if(!container)return;
    const list=Object.entries(teachers||{}).filter(([,p])=>p&&p.active!==false&&p.name).slice(0,8);
    container.innerHTML=list.length?list.map(([id,p],index)=>{
      const name=safeHtml(String(p.name).slice(0,80)),title=safeHtml(String(p.title||'عضو فريق التدريس').slice(0,100));
      const image=safeDashboardImage(p.photoUrl||'');
      const badge=index===0?'الأكثر مشاهدة':index===1?'شرح مميز':'فريق الأكاديمية';
      return '<a class="teacher-public-card mix-public-teacher-card" href="./teacher-profile.html?id='+encodeURIComponent(id)+'">'+
        '<div class="mix-public-teacher-photo">'+(image?'<img data-teacher-photo src="'+safeHtml(image)+'" alt="" loading="lazy">':'<span>'+safeHtml((p.name||'م')[0])+'</span>')+'<em>'+badge+'</em></div>'+
        '<div class="mix-public-teacher-copy"><small>مدرس معتمد</small><strong>'+name+'</strong><p>'+title+'</p><span>عرض الملف والدروس <i class="fa-solid fa-arrow-left"></i></span></div>'+
      '</a>';
    }).join(''):'<p class="teacher-empty">ستظهر هنا ملفات المعلمين بعد اعتمادها من الإدارة.</p>';
    container.querySelectorAll('[data-teacher-photo]').forEach(img=>img.addEventListener('error',()=>{img.parentElement.innerHTML='<span>'+(img.closest('a')?.querySelector('strong')?.textContent?.[0]||'م')+'</span>'},{once:true}));
  }

  async function loadProfile(uid) {
    const snap = await database.ref('studentProfilesV3/' + uid).once('value');
    const profile=snap.val();
    if(auth.currentUser?.uid===uid&&profile?.phone)ensureStudentPhoneIndex(uid,profile).catch(()=>{});
    return profile;
  }

  async function saveProfile(uid, patch) {
    await database.ref('studentProfilesV3/' + uid).update(patch);
  }

  function showPublicExperience() {
    window.AcademyUI?.hidePageLoading();
    $('siteHeader').classList.remove('hidden');
    $('publicExperience').classList.remove('hidden');
    $('publicFooter').classList.remove('hidden');
    $('studentDashboard').classList.add('hidden');
    $('guestNavActions').classList.toggle('hidden', !!state.user);
    $('userNavActions').classList.toggle('hidden', !state.user);
    window.scrollTo({top:0,behavior:'smooth'});
  }

  function showDashboard() {
    if (!state.user || !state.profile?.onboardingCompleted || !state.profile?.stage || !state.profile?.grade) {
      showPublicExperience();
      return;
    }
    const requested=new URLSearchParams(location.search).get('return');
    if(requested){try{const destination=new URL(requested,location.origin);if(destination.origin===location.origin&&destination.pathname.endsWith('/lesson.html')){location.replace(destination.href);return}}catch{}}
    $('siteHeader').classList.add('hidden');
    $('publicExperience').classList.add('hidden');
    $('publicFooter').classList.add('hidden');
    $('studentDashboard').classList.remove('hidden');
    $('guestNavActions').classList.add('hidden');
    $('userNavActions').classList.remove('hidden');
    renderDashboard();
    window.AcademyUI?.hidePageLoading();
    if(location.hash==='#studentSubjects'){
      requestAnimationFrame(()=>document.getElementById('studentSubjects')?.scrollIntoView({behavior:'smooth',block:'start'}));
    }else{
      window.scrollTo({top:0});
    }
  }

  function renderPublicNews() {
    const grid = $('homeNewsGrid');
    if (!grid) return;
    const posts = Object.entries(state.dbData.posts || {})
      .map(([id,v]) => ({id,...(v||{})}))
      .sort((a,b) => Number(b.date || b.createdAt || 0) - Number(a.date || a.createdAt || 0))
      .slice(0,3);
    grid.innerHTML = posts.length
      ? posts.map(n => `<article class="home-news-card">
          <span class="news-date">${n.date ? new Date(n.date).toLocaleDateString('ar-EG',{day:'numeric',month:'long',year:'numeric'}) : ''}</span>
          <h3>${safeHtml(n.title || 'تحديث جديد')}</h3>
          <p>${safeHtml(n.content || '')}</p>
          <a href="./news.html">قراءة الأخبار <i class="fa-solid fa-arrow-left"></i></a>
        </article>`).join('')
      : '<article class="home-news-card"><span class="news-date">الأكاديمية</span><h3>قريبًا تحديثات جديدة</h3><p>ستظهر هنا أحدث الأخبار والإضافات التي تنشرها الإدارة.</p><a href="./news.html">صفحة الأخبار</a></article>';
  }

  function renderHeaderUser() {
    if (!state.user) return;
    const name = state.profile?.name || state.user.displayName || state.user.email?.split('@')[0] || 'الطالب';
    $('headerUserName').textContent = name;
    $('headerAvatar').textContent = initials(name);
    $('headerUserGrade').textContent = state.profile?.stage && state.profile?.grade
      ? gradeLabels[state.profile.stage]?.[state.profile.grade] || 'حساب طالب'
      : 'أكمل إعداد الحساب';
  }

  function animateDashboardNumber(id,target,duration=550){
    const el=$(id);if(!el)return;
    const end=Math.max(0,Number(target||0)),start=Number(el.dataset.current||0),started=performance.now();
    const tick=now=>{
      const t=Math.min(1,(now-started)/duration),ease=1-Math.pow(1-t,3),value=Math.round(start+(end-start)*ease);
      el.textContent=value;el.dataset.current=String(value);
      if(t<1)requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  function statsFromProfile() {
    const s = state.profile?.stats || {};
    return {
      xp: Number(s.totalXP || 0),
      level: Number(s.level || Math.max(1, Math.floor((s.totalXP || 0) / 1000) + 1)),
      lessons: Number(s.completedLessons || 0),
      quizzes: Number(s.completedQuizzes || s.totalQuizzes || 0),
      streak: Number(s.streak || 0)
    };
  }


  function safeHtml(value = '') {
    return String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  }

  function dashSearchNormalize(value=''){
    return String(value).toLowerCase().normalize('NFKD').replace(/[\u064B-\u065F\u0670]/g,'').replace(/[أإآ]/g,'ا').replace(/ة/g,'ه').replace(/ى/g,'ي').replace(/[^\p{L}\p{N}\s]/gu,' ').replace(/\s+/g,' ').trim();
  }
  function dashSearchScore(text,q){
    const hay=dashSearchNormalize(text),needle=dashSearchNormalize(q);if(!needle)return 0;
    let score=0;if(hay===needle)score+=100;if(hay.startsWith(needle))score+=60;if(hay.includes(needle))score+=40;
    needle.split(' ').filter(Boolean).forEach(w=>{if(hay.includes(w))score+=10});return score;
  }
  function dashboardQuickSearchRows(query){
    const p=state.profile;if(!p||!query)return[];
    const rows=[],subjects=getSubjects(p.stage,String(p.grade),p.educationType);
    subjects.forEach(s=>{
      const score=dashSearchScore(s.name,query);if(score)rows.push({kind:'subject',title:s.name,meta:'مادة صفك',icon:s.emoji||'📚',score:score+18,href:'./subject.html?'+new URLSearchParams({type:p.educationType,stage:p.stage,grade:String(p.grade),subject:s.id})});
    });
    Object.entries(state.dbData.lessons||{}).forEach(([id,l])=>{
      if(!l||l.isHidden||Number(l.publishAt||0)>Date.now()||l.type!==p.educationType||l.stage!==p.stage||String(l.grade)!==String(p.grade))return;
      const s=subjects.find(x=>x.id===l.subject),teacherText=(Array.isArray(l.videos)?l.videos:[]).map(v=>v?.name).filter(Boolean).slice(0,2).join(' • ')||l.teacherName||'';
      const score=dashSearchScore([l.title,s?.name,teacherText].join(' '),query);if(!score)return;
      rows.push({kind:'lesson',title:l.title||'درس',meta:[s?.name,teacherText].filter(Boolean).join(' • '),icon:'▶️',score:score+12,href:'./lesson.html?'+new URLSearchParams({type:p.educationType,stage:p.stage,grade:String(p.grade),subject:l.subject||'',id})});
    });
    Object.entries(state.publicTeachers||{}).forEach(([id,t])=>{
      if(!t||t.active===false||!t.name)return;
      const score=dashSearchScore([t.name,t.title,t.bio].join(' '),query);if(!score)return;
      rows.push({kind:'teacher',title:t.name,meta:t.title||'مدرس في الأكاديمية',icon:'👨‍🏫',score:score+8,href:'./teacher-profile.html?id='+encodeURIComponent(id)});
    });
    return rows.sort((a,b)=>b.score-a.score).slice(0,6);
  }
  function renderDashSearchSuggestions(){
    const input=$('dashSearchInput'),box=$('dashSearchSuggestions');if(!input||!box)return;
    const q=input.value.trim();if(q.length<2){box.classList.add('hidden');box.innerHTML='';return}
    const rows=dashboardQuickSearchRows(q);
    box.innerHTML=rows.length?rows.map((r,i)=>'<button type="button" data-dash-search-index="'+i+'"><span>'+safeHtml(r.icon)+'</span><div><strong>'+safeHtml(r.title)+'</strong><small>'+safeHtml(r.meta||'')+'</small></div><i class="fa-solid fa-arrow-left"></i></button>').join('')+'<a href="./search.html?q='+encodeURIComponent(q)+'"><i class="fa-solid fa-magnifying-glass"></i> عرض كل نتائج البحث عن «'+safeHtml(q)+'»</a>':'<a href="./search.html?q='+encodeURIComponent(q)+'"><i class="fa-solid fa-magnifying-glass"></i> ابحث في الأكاديمية كلها عن «'+safeHtml(q)+'»</a>';
    box.classList.remove('hidden');
    box.querySelectorAll('[data-dash-search-index]').forEach(btn=>btn.onclick=()=>{const row=rows[Number(btn.dataset.dashSearchIndex)];if(row)location.href=row.href});
  }

  function safeDashboardImage(value='') {
    if(!value)return '';
    try {
      const url=new URL(value,location.href);
      return ['http:','https:'].includes(url.protocol)?url.href:'';
    } catch { return ''; }
  }
  function applyVisualSettings(){
    const settings=state.dbData.settings||{},root=document.documentElement;
    const publicHero=safeDashboardImage(settings.publicHeroUrl||'');
    const authVisual=safeDashboardImage(settings.authVisualUrl||'');
    const dashboardHero=safeDashboardImage(settings.dashboardHeroUrl||'');
    if(publicHero)root.style.setProperty('--future-public-hero-image','url("'+publicHero.replace(/"/g,'%22')+'")');
    else root.style.removeProperty('--future-public-hero-image');
    if(authVisual)root.style.setProperty('--future-auth-image','url("'+authVisual.replace(/"/g,'%22')+'")');
    else root.style.removeProperty('--future-auth-image');
    if(dashboardHero)root.style.setProperty('--future-dashboard-image','url("'+dashboardHero.replace(/"/g,'%22')+'")');
    else root.style.removeProperty('--future-dashboard-image');
    const map={primary:'stageImagePrimary',prep:'stageImagePrep',sec:'stageImageSec',azhar:'stageImageAzhar'};
    Object.entries(map).forEach(([key,id])=>{
      const el=$(id),image=safeDashboardImage(settings.stageImages?.[key]||'');
      if(!el)return;
      if(image)el.style.setProperty('--stage-image','url("'+image.replace(/"/g,'%22')+'")');
      else el.style.removeProperty('--stage-image');
    });
  }

  async function updateDailyActivity(uid) {
    const now=new Date(),yesterdayDate=new Date(now),cutoffDate=new Date(now);
    yesterdayDate.setDate(now.getDate()-1);cutoffDate.setDate(now.getDate()-45);
    const today=localDateKey(now),yesterday=localDateKey(yesterdayDate),cutoff=localDateKey(cutoffDate);
    await database.ref('studentProfilesV3/' + uid).transaction(profile => {
      if (!profile) return profile;
      profile.activity=profile.activity||{};profile.activity.days=profile.activity.days||{};profile.stats=profile.stats||{};
      const last=profile.activity.lastDate||'';
      if(last!==today){
        profile.stats.streak=last===yesterday?Number(profile.stats.streak||0)+1:1;
        profile.activity.lastDate=today;
      }
      profile.activity.days[today]=true;
      Object.keys(profile.activity.days).forEach(key=>{if(key<cutoff)delete profile.activity.days[key]});
      profile.activity.lastSeenAt=Date.now();
      return profile;
    });
  }

  function buildDashboardNotifications() {
    const items = [];
    const ann = state.dbData.announcements;
    if (ann?.isActive && (!ann.expiry || Date.now() < ann.expiry) && ann.text) {
      items.push({icon:'fa-bullhorn',title:'إعلان من الأكاديمية',text:ann.text});
    }
    if (state.profile?.lastLessonTitle) {
      items.push({icon:'fa-circle-play',title:'أكمل من حيث توقفت',text:'ارجع إلى ' + state.profile.lastLessonTitle + ' وكمّل تقدمك.'});
    } else {
      items.push({icon:'fa-rocket',title:'ابدأ أول درس',text:'اختر مادة من موادك وابدأ أول خطوة في رحلتك.'});
    }
    const streak = Number(state.profile?.stats?.streak || 0);
    if (streak >= 2) items.push({icon:'fa-fire',title:'حافظ على السلسلة',text:'أنت مستمر منذ ' + streak + ' أيام. درس قصير اليوم يحافظ عليها.'});
    const xp = Number(state.profile?.stats?.totalXP || 0);
    if (xp < 500) items.push({icon:'fa-star',title:'هدفك القادم',text:'باقي ' + Math.max(0,500-xp) + ' XP للوصول لإنجاز 500 نقطة.'});
    return items.slice(0,4);
  }

  function renderSmartDashboard() {
    const stats = statsFromProfile();
    const p = state.profile || {};
    const subjects = p.stage && p.grade ? getSubjects(p.stage, String(p.grade), p.educationType) : [];
    const weakest = [...subjects].sort((a,b)=>subjectProgressOf(p,a.id)-subjectProgressOf(p,b.id))[0];
    const weakPct = weakest ? subjectProgressOf(p,weakest.id) : 0;
    const achievements = [
      {emoji:'🚀',name:'البداية',ok:stats.lessons>=1},
      {emoji:'📚',name:'5 دروس',ok:stats.lessons>=5},
      {emoji:'🎯',name:'أول اختبار',ok:stats.quizzes>=1},
      {emoji:'⭐',name:'500 XP',ok:stats.xp>=500}
    ];
    let shell = document.getElementById('smartDashboardGrid');
    if (!shell) {
      shell = document.createElement('section');
      shell.id = 'smartDashboardGrid';
      shell.className = 'smart-dashboard-grid';
      const anchor = document.querySelector('.dashboard-bottom-grid');
      if (anchor) anchor.insertAdjacentElement('afterend', shell);
    }
    const notes = buildDashboardNotifications();
    let recommendation = '';
    if (weakest) {
      const q = new URLSearchParams({
        type:p.educationType || 'public',
        stage:p.stage,
        grade:String(p.grade),
        subject:weakest.id
      });
      const advice = weakPct === 0
        ? 'لسه مبدأتش المادة. ابدأ بدرس واحد قصير النهارده.'
        : weakPct < 40
          ? 'دي أقل مادة في تقدمك حاليًا. جلسة 30 دقيقة هتعمل فرق واضح.'
          : 'تقدمك فيها أقل من باقي المواد. راجع درسًا واحدًا وحل تدريبًا.';
      recommendation = `
        <article class="dashboard-smart-card smart-recommendation-card">
          <div class="smart-recommendation-icon">${weakest.emoji || '📚'}</div>
          <div class="smart-recommendation-copy">
            <span class="section-kicker">توصية مخصصة ليك</span>
            <h3>ركّز اليوم على ${safeHtml(weakest.name)}</h3>
            <p>${safeHtml(advice)} تقدمك الحالي: <strong>${weakPct}%</strong>.</p>
            <div class="smart-recommendation-actions">
              <a class="btn btn-primary" href="./subject.html?${q.toString()}">ابدأ المذاكرة <i class="fa-solid fa-arrow-left"></i></a>
              <a class="btn btn-soft" href="./planner.html">أضفها لخطة اليوم</a>
            </div>
          </div>
          <div class="smart-recommendation-progress"><span>${weakPct}%</span><div class="progress"><i style="width:${Math.max(4,weakPct)}%"></i></div><small>تقدم المادة</small></div>
        </article>`;
    }
    shell.innerHTML = `
      ${recommendation}
      <article class="dashboard-smart-card">
        <div class="smart-card-head"><div><span class="section-kicker">رحلتك تتحسن</span><h3>إنجازاتك</h3></div><span>🏆</span></div>
        <div class="achievement-row">
          ${achievements.map(a=>`<div class="achievement-mini ${a.ok?'':'locked'}"><span>${a.emoji}</span><strong>${a.name}</strong></div>`).join('')}
        </div>
        <a href="./profile.html" class="text-btn" style="margin-top:14px">عرض كل الإنجازات <i class="fa-solid fa-arrow-left"></i></a>
      </article>
      <article class="dashboard-smart-card">
        <div class="smart-card-head"><div><span class="section-kicker">مهم لك الآن</span><h3>الإشعارات</h3></div><span>🔔</span></div>
        <div class="notification-list">
          ${notes.slice(0,3).map(n=>`<div class="notification-item"><span><i class="fa-solid ${n.icon}"></i></span><div><strong>${safeHtml(n.title)}</strong><p>${safeHtml(n.text)}</p></div></div>`).join('')}
        </div>
      </article>`;
  }

  function showNotificationPopover() {
    document.getElementById('notificationPopover')?.remove();
    const notes = buildDashboardNotifications();
    const box = document.createElement('div');
    box.id = 'notificationPopover';
    box.className = 'notification-popover';
    box.innerHTML = '<h3>إشعاراتك</h3><div class="notification-list">' +
      notes.map(n=>`<div class="notification-item"><span><i class="fa-solid ${n.icon}"></i></span><div><strong>${safeHtml(n.title)}</strong><p>${safeHtml(n.text)}</p></div></div>`).join('') +
      '</div>';
    document.body.appendChild(box);
    setTimeout(()=>document.addEventListener('click', function closer(e){
      if (!e.target.closest('#notificationPopover') && !e.target.closest('#notificationBtn') && !e.target.closest('#dashNotificationBtn')) {
        box.remove(); document.removeEventListener('click', closer);
      }
    }),0);
  }

  function localDateKey(date=new Date()) {
    return date.getFullYear()+'-'+String(date.getMonth()+1).padStart(2,'0')+'-'+String(date.getDate()).padStart(2,'0');
  }

  function todayKey() {
    return localDateKey();
  }

  function renderDailyGoals(goals = {}) {
    const keys=['lesson','assignment','quiz','review'];
    const done=keys.filter(k=>goals?.[k]).length;
    const pct=Math.round(done/keys.length*100);
    const ring=$('dailyGoalRing');
    if(ring) ring.style.background='conic-gradient(#10b981 '+(pct*3.6)+'deg,#e8eef7 0deg)';
    if($('dailyGoalPercent')) $('dailyGoalPercent').textContent=pct+'%';
    if($('dailyGoalCount')) $('dailyGoalCount').textContent=done+' من 4 مكتملة';
    if($('pulseChallengeState')) $('pulseChallengeState').textContent=done+' / 4';
    if($('dailyGoalProgress')) $('dailyGoalProgress').style.width=pct+'%';
    if($('dailyGoalHeadline'))$('dailyGoalHeadline').textContent=done===4?'أنجزت يومك بالكامل 🎉':done===3?'باقي هدف واحد فقط':done>=1?'أنت بدأت اليوم بشكل ممتاز':'ابدأ بخطوة واحدة';
    if($('dailyGoalMessage')) {
      $('dailyGoalMessage').textContent=done===4?'ممتاز! أنهيت أهداف اليوم بالكامل 🎉':done===3?'باقي خطوة واحدة فقط، كمّلها 💪':done?'بداية ممتازة، استمر.':'ابدأ بخطوة صغيرة وخلي اليوم يتحسب لك.';
    }
    $$('[data-daily-goal]').forEach(btn=>{
      const key=btn.dataset.dailyGoal,complete=!!goals?.[key];
      btn.classList.toggle('completed',complete);
      btn.setAttribute('aria-pressed',complete?'true':'false');
      const icon=btn.querySelector('.goal-state');
      if(icon) icon.className=complete?'fa-solid fa-square-check goal-state':'fa-regular fa-square goal-state';
    });
  }

  async function loadDailyGoals() {
    if(!state.user)return;
    try{
      if(window.AcademyGame&&state.profile){
        const synced=await window.AcademyGame.syncDailyMissionRewards(state.user.uid,state.profile);
        state.profile=synced.profile||state.profile;
        const missions=window.AcademyGame.dailyMissions(state.profile,todayKey());
        const goals={};missions.forEach(m=>goals[m.id]=!!m.done);
        renderDailyGoals(goals);
        if(synced.gained){
          const total=Number(state.profile?.stats?.totalXP||0),level=Number(state.profile?.stats?.level||Math.floor(total/1000)+1),inLevel=total%1000,pct=total>0&&inLevel===0?100:Math.round(inLevel/1000*100),remain=inLevel===0&&total>0?1000:1000-inLevel;
          if($('xpStat'))$('xpStat').textContent=total;if($('heroXpValue'))$('heroXpValue').textContent=total;if($('heroLevelValue'))$('heroLevelValue').textContent=level;if($('heroLevelProgress'))$('heroLevelProgress').style.width=pct+'%';if($('heroNextLevelText'))$('heroNextLevelText').textContent='باقي '+remain+' XP للمستوى التالي';
          toast('أضفنا +'+synced.gained+' XP من مهام اليوم المكتملة 🎉');
        }
        return;
      }
      const snap=await database.ref('studentProfilesV3/'+state.user.uid+'/dailyGoals/'+todayKey()).once('value');
      renderDailyGoals(snap.val()||{});
    }catch(e){console.warn('Daily goals load failed',e)}
  }

  async function toggleDailyGoal(key) {
    if(!state.user||!key)return;
    const ref=database.ref('studentProfilesV3/'+state.user.uid+'/dailyGoals/'+todayKey()+'/'+key);
    try{
      await ref.transaction(v=>!v);
      await loadDailyGoals();
    }catch(e){toast('تعذر تحديث تحدي اليوم.','error')}
  }

  function initDashboardSidebar() {
    const shell=$('studentDashboard');
    if(!shell)return;
    shell.classList.remove('sidebar-collapsed');
    localStorage.removeItem('academySidebarCollapsed');
    $('dashboardMoreToggle')?.addEventListener('click',()=>{
      const menu=$('dashboardMoreMenu'),toggle=$('dashboardMoreToggle');
      const opening=menu?.classList.contains('hidden');
      menu?.classList.toggle('hidden');
      toggle?.classList.toggle('open',!!opening);
      toggle?.setAttribute('aria-expanded',opening?'true':'false');
    });
    $$('[data-nav-label]').forEach(btn=>btn.addEventListener('click',()=>{
      if(btn.id==='dashHomeBtn'||btn.id==='dashSubjectsBtn'||btn.id==='dashPlannerBtn'){
        $$('[data-nav-label]').forEach(x=>x.classList.remove('active'));
        btn.classList.add('active');
      }
      document.querySelector('.dashboard-sidebar')?.classList.remove('open');
    }));
  }

  function nextWeeklyDate(dayOfWeek,time='18:00') {
    const now=new Date(),d=new Date(now);
    const diff=(Number(dayOfWeek)-now.getDay()+7)%7;
    d.setDate(now.getDate()+diff);
    const [h,m]=String(time||'18:00').split(':').map(Number);
    d.setHours(h||0,m||0,0,0);
    if(d.getTime()<Date.now()-60000)d.setDate(d.getDate()+7);
    return d.getTime();
  }

  function dashboardQuizHistory(profile=state.profile){
    return Object.values(profile?.quizHistory||{}).filter(Boolean);
  }
  function dashboardMistakes(profile=state.profile){
    return Object.values(profile?.mistakeNotebook||{}).flatMap(group=>Object.values(group||{}).filter(Boolean));
  }
  function dashboardSubjectQuizAverage(subjectId,profile=state.profile){
    const rows=dashboardQuizHistory(profile).filter(x=>String(x.subject||'')===String(subjectId));
    return rows.length?Math.round(rows.reduce((n,x)=>n+Number(x.score||0),0)/rows.length):null;
  }
  function dashboardSubjectMistakeCount(subjectId,profile=state.profile){
    return dashboardMistakes(profile).filter(x=>String(x.subject||'')===String(subjectId)).length;
  }
  function dashboardQuizAttempted(id,profile=state.profile){
    return dashboardQuizHistory(profile).some(x=>String(x.sourceId||x.quizId||'')===String(id));
  }
  function dashboardTargetMatches(item,profile=state.profile,user=state.user){
    if(!item||!profile||!user)return false;
    const mode=item.targetMode||'all';
    if(mode==='students'){
      const ids=Array.isArray(item.targetStudentIds)?item.targetStudentIds:Object.keys(item.targetStudentIds||{});
      return ids.includes(user.uid);
    }
    if(mode==='group'){
      const groups=Array.isArray(profile.groupIds)?profile.groupIds:Object.keys(profile.groupIds||{});
      return !!item.targetGroupId&&(profile.classGroupId===item.targetGroupId||groups.includes(item.targetGroupId));
    }
    return true;
  }
  function dashboardContentMatches(item,profile=state.profile){
    if(!item||!profile||item.isHidden||item.isActive===false)return false;
    if(Number(item.publishAt||0)>Date.now())return false;
    return (!item.type||item.type===profile.educationType)&&(!item.stage||item.stage===profile.stage)&&(!item.grade||String(item.grade)===String(profile.grade));
  }
  function dashboardSubjectNeed(subject,profile=state.profile){
    const progress=Math.max(0,Math.min(100,subjectProgressOf(profile,subject.id)));
    const avg=dashboardSubjectQuizAverage(subject.id,profile);
    const mistakes=dashboardSubjectMistakeCount(subject.id,profile);
    const quizPenalty=avg===null?18:Math.max(0,100-avg)*.38;
    const progressPenalty=Math.max(0,100-progress)*.48;
    const mistakePenalty=Math.min(28,mistakes*5);
    return{subject,progress,avg,mistakes,score:progressPenalty+quizPenalty+mistakePenalty};
  }
  function dashboardLessonHref(id,l,profile=state.profile){
    return './lesson.html?'+new URLSearchParams({type:l.type||profile.educationType,stage:l.stage||profile.stage,grade:String(l.grade||profile.grade),subject:l.subject||'',id});
  }
  function dashboardQuizHref(id,q,profile=state.profile){
    return './lesson.html?'+new URLSearchParams({type:q.type||profile.educationType,stage:q.stage||profile.stage,grade:String(q.grade||profile.grade),subject:q.subject||'',quiz:id});
  }
  function dashboardSubjectHref(subjectId,profile=state.profile){
    return './subject.html?'+new URLSearchParams({type:profile.educationType,stage:profile.stage,grade:String(profile.grade),subject:subjectId});
  }
  function dashboardSmartIcon(kind){
    return{live:'fa-tower-broadcast',assignment:'fa-clipboard-check',planner:'fa-list-check',schedule:'fa-calendar-day',lesson:'fa-circle-play',quiz:'fa-brain',file:'fa-file-pdf',review:'fa-rotate-left',subject:'fa-book-open'}[kind]||'fa-bolt';
  }
  function renderSmartHomeRecommendations(){
    const box=$('dashboardSmartCards'),profile=state.profile;
    if(!box||!profile?.stage||!profile?.grade)return;
    const subjects=getSubjects(profile.stage,String(profile.grade),profile.educationType);
    const subjectMap=new Map(subjects.map(s=>[String(s.id),s]));
    const needs=subjects.map(s=>dashboardSubjectNeed(s,profile)).sort((a,b)=>b.score-a.score);
    const weak=needs[0]||null;
    const mistakes=dashboardMistakes(profile);

    const lessons=Object.entries(state.dbData.lessons||{}).map(([id,v])=>({id,...(v||{})}))
      .filter(x=>dashboardContentMatches(x,profile)&&subjectMap.has(String(x.subject)));
    const quizzes=Object.entries(state.dbData.quizzes||{}).map(([id,v])=>({id,...(v||{})}))
      .filter(x=>dashboardContentMatches(x,profile)&&dashboardTargetMatches(x,profile,state.user)&&subjectMap.has(String(x.subject)));
    const files=Object.entries(state.dbData.files||{}).map(([id,v])=>({id,...(v||{})}))
      .filter(x=>dashboardContentMatches(x,profile)&&subjectMap.has(String(x.subject)));

    const incompleteLessons=lessons.filter(l=>!profile.learningProgress?.[l.id]?.completed);
    const quizCandidates=quizzes.filter(q=>!dashboardQuizAttempted(q.id,profile));
    const weakQuiz=weak?quizCandidates.filter(q=>String(q.subject)===String(weak.subject.id)).sort((a,b)=>Number(b.createdAt||0)-Number(a.createdAt||0))[0]:null;
    let quizPick=weakQuiz||quizCandidates.sort((a,b)=>{
      const an=needs.find(x=>String(x.subject.id)===String(a.subject))?.score||0,bn=needs.find(x=>String(x.subject.id)===String(b.subject))?.score||0;
      return bn-an||Number(b.createdAt||0)-Number(a.createdAt||0);
    })[0]||null;
    if(!quizPick&&quizzes.length){
      const histories=dashboardQuizHistory(profile).slice().sort((a,b)=>Number(a.score||0)-Number(b.score||0));
      const lowest=histories.find(h=>quizzes.some(q=>String(q.id)===String(h.sourceId||h.quizId||'')));
      if(lowest)quizPick=quizzes.find(q=>String(q.id)===String(lowest.sourceId||lowest.quizId||''))||null;
    }

    const unopenedFiles=files.filter(f=>!Number(profile.libraryHistory?.[f.id]?.openedAt||0)).sort((a,b)=>{
      const ai=a.isFeatured?1:0,bi=b.isFeatured?1:0;if(ai!==bi)return bi-ai;
      return Number(b.createdAt||b.updatedAt||0)-Number(a.createdAt||a.updatedAt||0);
    });
    const recentLesson=incompleteLessons.slice().sort((a,b)=>Number(b.createdAt||0)-Number(a.createdAt||0))[0]||null;
    const freshFile=unopenedFiles[0]||null;
    const freshPick=freshFile
      ?{kind:'file',title:freshFile.title||'ملف جديد',meta:(subjectMap.get(String(freshFile.subject))?.name||'المكتبة')+(freshFile.isFeatured?' • مهم':' • ملف جديد'),href:'./library.html?file='+encodeURIComponent(freshFile.id),createdAt:Number(freshFile.createdAt||freshFile.updatedAt||0),reason:freshFile.isFeatured?'لأن الإدارة رشحته كملف مهم ولم تفتحه بعد.':'لأنه من أحدث الملفات المناسبة لصفك ولم تفتحه بعد.'}
      :recentLesson
        ?{kind:'lesson',title:recentLesson.title||'درس جديد',meta:subjectMap.get(String(recentLesson.subject))?.name||'درس جديد',href:dashboardLessonHref(recentLesson.id,recentLesson,profile),createdAt:Number(recentLesson.createdAt||0),reason:'لأنه من أحدث الدروس المناسبة لمرحلتك ولم تكمله بعد.'}
        :null;

    const attention=state.dashboardAttention||{};
    let start=attention.pick||null;
    if(!start&&profile.lastLessonId){
      const l=lessons.find(x=>String(x.id)===String(profile.lastLessonId));
      if(l)start={kind:'lesson',title:'كمّل '+(l.title||profile.lastLessonTitle||'آخر درس'),text:subjectMap.get(String(l.subject))?.name||'متابعة التعلم',href:dashboardLessonHref(l.id,l,profile),reason:'لأن دي آخر نقطة وصلت لها في رحلتك.'};
    }
    if(!start&&weak){
      start={kind:'subject',title:'ابدأ بـ '+weak.subject.name,text:'خطوة قصيرة في المادة الأكثر احتياجًا للتركيز.',href:dashboardSubjectHref(weak.subject.id,profile),reason:'لأنها المادة التي تحتاج دعمًا أكبر حاليًا.'};
    }

    const review=weak?{
      kind:'review',
      title:'راجع '+weak.subject.name,
      meta:(weak.avg===null?'بدون نتائج كافية':'متوسط '+weak.avg+'%')+' • '+weak.progress+'% تقدم',
      href:weak.mistakes?'./profile.html?tab=mistakes':dashboardSubjectHref(weak.subject.id,profile),
      reason:weak.mistakes
        ?'عندك '+weak.mistakes+' سؤال'+(weak.mistakes>1?'':'')+' في دفتر الأخطاء لهذه المادة.'
        :weak.avg!==null&&weak.avg<75
          ?'متوسط اختباراتك فيها '+weak.avg+'%، فمراجعة قصيرة الآن هتفرق.'
          :'تقدمها أقل من بقية موادك، لذلك تستحق جلسة قصيرة اليوم.',
      badge:weak.mistakes?weak.mistakes+' أخطاء':weak.progress+'%'
    }:null;

    const quiz=quizPick?{
      kind:'quiz',title:quizPick.name||'اختبار مقترح',
      meta:(subjectMap.get(String(quizPick.subject))?.name||'اختبار')+' • '+Number(quizPick.questions?.length||0)+' سؤال'+(Number(quizPick.durationMinutes||0)?' • '+Number(quizPick.durationMinutes)+' د':''),
      href:dashboardQuizHref(quizPick.id,quizPick,profile),
      reason:dashboardQuizAttempted(quizPick.id,profile)?'ده اختبار محتاج تحسين نتيجتك فيه.':weak&&String(quizPick.subject)===String(weak.subject.id)?'اخترناه لأنه يقيس المادة التي تحتاج تركيزًا أكبر.':'لسه ما جربتش الاختبار ده وهو مناسب لصفك.',
      badge:dashboardQuizAttempted(quizPick.id,profile)?'أعد المحاولة':'لم تجربه'
    }:null;

    const cards=[];
    if(start)cards.push({
      kind:start.kind||'lesson',eyebrow:'ابدأ الآن',title:start.title||'أهم خطوة اليوم',text:start.text||'دي الخطوة الأعلى أولوية في يومك.',href:start.href||'./index.html',
      reason:start.reason||(start.kind==='live'?'لأن الجلسة مباشرة أو هتبدأ قريب.':start.kind==='assignment'?'لأن موعد التسليم هو الأقرب.':start.kind==='planner'?'لأنها ضمن خطة مذاكرتك اليوم.':'لأنها أعلى أولوية دلوقتي.'),tone:'primary',badge:'الأولوية الأولى'
    });
    if(review)cards.push({kind:'review',eyebrow:'راجع بذكاء',title:review.title,text:review.meta,href:review.href,reason:review.reason,tone:'review',badge:review.badge});
    if(quiz)cards.push({kind:'quiz',eyebrow:'اختبر نفسك',title:quiz.title,text:quiz.meta,href:quiz.href,reason:quiz.reason,tone:'quiz',badge:quiz.badge});
    if(freshPick)cards.push({kind:freshPick.kind,eyebrow:'جديد ليك',title:freshPick.title,text:freshPick.meta,href:freshPick.href,reason:freshPick.reason,tone:'fresh',badge:freshPick.kind==='file'?'من المكتبة':'درس جديد'});

    if(!cards.length){
      box.innerHTML='<article class="smart-plan-empty-v13"><span>🎉</span><div><strong>أنت محدث كل شيء حاليًا</strong><p>استكشف مادة جديدة أو راجع أحد دروسك القديمة.</p></div><a href="./explore.html">استكشف الآن <i class="fa-solid fa-arrow-left"></i></a></article>';
    }else{
      box.innerHTML=cards.slice(0,4).map((card,index)=>
        '<a class="smart-plan-card-v13 '+safeHtml(card.tone||'')+'" href="'+safeHtml(card.href)+'">'+
          '<div class="smart-plan-card-top-v13"><span class="smart-plan-card-icon-v13"><i class="fa-solid '+dashboardSmartIcon(card.kind)+'"></i></span><span class="smart-plan-card-badge-v13">'+safeHtml(card.badge||'مقترح')+'</span></div>'+
          '<small>'+safeHtml(card.eyebrow)+'</small><h3>'+safeHtml(card.title)+'</h3><p>'+safeHtml(card.text||'')+'</p>'+
          '<div class="smart-plan-reason-v13"><i class="fa-solid fa-wand-magic-sparkles"></i><span>'+safeHtml(card.reason||'اخترناه بناءً على نشاطك الحالي.')+'</span></div>'+
          '<div class="smart-plan-card-foot-v13"><strong>'+(index===0?'ابدأ الآن':'فتح الاقتراح')+'</strong><i class="fa-solid fa-arrow-left"></i></div>'+
        '</a>'
      ).join('');
    }

    const urgent=Number(attention.urgentCount||0);
    const reviewCount=mistakes.length+needs.filter(x=>x.avg!==null&&x.avg<70).length;
    const sevenDays=7*86400000,now=Date.now();
    const newCount=[...lessons,...quizzes,...files].filter(x=>Number(x.createdAt||x.updatedAt||0)&&now-Number(x.createdAt||x.updatedAt||0)<=sevenDays).length;
    if($('smartUrgentCount'))$('smartUrgentCount').textContent=urgent;
    if($('smartReviewCount'))$('smartReviewCount').textContent=reviewCount;
    if($('smartNewCount'))$('smartNewCount').textContent=newCount;
    if($('smartPlanSummary')){
      $('smartPlanSummary').textContent=urgent
        ?'عندك '+urgent+' خطوة ذات أولوية، ورتبنا باقي الاقتراحات بعدها.'
        :reviewCount
          ?'مفيش ضغط عاجل؛ أفضل استثمار لوقتك الآن هو تثبيت نقاط الضعف.'
          :'يومك هادئ — استغلّه في درس أو اختبار جديد مناسب لمستواك.';
    }
    const settings=state.dbData.settings||{};
    if(!settings.dashboardHeroSubtitle&&$('dashboardHeroSubtitle')){
      $('dashboardHeroSubtitle').textContent=urgent
        ?'عندك حاجة مهمة تستحق تبدأ بيها دلوقتي — رتّبناها لك تحت.'
        :reviewCount
          ?'يوم مناسب للمراجعة الذكية وتحسين المواد اللي محتاجة تركيز.'
          :'يوم هادئ للتقدم خطوة جديدة — اخترنا لك أفضل بداية.';
    }
  }

  async function loadDashboardPulse() {
    if(!state.user||!state.profile)return;
    const p=state.profile,uid=state.user.uid,now=Date.now();
    try{
      const [plannerSnap,assignSnap,scheduleSnap,liveSnap]=await Promise.all([
        database.ref('studentProfilesV3/'+uid+'/studyPlanner').once('value'),
        database.ref('assignments').orderByChild('stage').equalTo(p.stage).once('value'),
        database.ref('scheduleEvents').orderByChild('stage').equalTo(p.stage).once('value'),
        database.ref('liveSessions').once('value')
      ]);
      const candidates=[];
      const today=todayKey();

      Object.entries(plannerSnap.val()||{}).forEach(([id,t])=>{
        if(!t||t.done||!t.date)return;
        const isToday=t.date===today;
        const at=new Date(t.date+'T18:00:00').getTime();
        if(isToday || at>=now){
          candidates.push({
            kind:'planner',
            rank:isToday?0:4,
            at,
            title:isToday?'كمّل مهمة المذاكرة دي النهارده':'مهمة مذاكرة قادمة',
            text:t.title||'مهمة مذاكرة',
            href:'./planner.html',
            reason:isToday?'لأنها مهمة موجودة في خطة مذاكرتك اليوم.':'لأنها أقرب مهمة قادمة في مخططك.'
          });
        }
      });

      const profileGroups=Array.isArray(p.groupIds)?p.groupIds:Object.keys(p.groupIds||{});
      const assignmentTargetsStudent=a=>{
        const mode=a.targetMode||'all';
        if(mode==='students'){
          const ids=Array.isArray(a.targetStudentIds)?a.targetStudentIds:Object.keys(a.targetStudentIds||{});
          return ids.includes(uid);
        }
        if(mode==='group')return !!a.targetGroupId&&(p.classGroupId===a.targetGroupId||profileGroups.includes(a.targetGroupId));
        return true;
      };
      const assignments=Object.entries(assignSnap.val()||{}).map(([id,a])=>({id,...(a||{})}))
        .filter(a=>!a.isHidden && (!Number(a.publishAt||0)||Number(a.publishAt)<=now) && a.type===p.educationType && a.stage===p.stage && String(a.grade)===String(p.grade) && assignmentTargetsStudent(a));
      const nearAssignments=assignments.sort((a,b)=>Number(a.dueAt||Infinity)-Number(b.dueAt||Infinity)).slice(0,12);
      const submissionSnaps=await Promise.all(nearAssignments.map(a=>database.ref('assignmentSubmissions/'+a.id+'/'+uid).once('value')));
      nearAssignments.forEach((a,i)=>{
        const s=submissionSnaps[i].val();
        if(s)return;
        const due=Number(a.dueAt||0),diff=due?due-now:Infinity,overdue=Number.isFinite(diff)&&diff<0;
        candidates.push({
          kind:'assignment',
          rank:overdue?-1:diff<=86400000?1:3,
          at:due||now,
          title:overdue?'عندك واجب متأخر محتاج تسليم':diff<=86400000?'واجب محتاج تسليمه قريب':'عندك واجب قادم',
          text:(a.title||'واجب دراسي')+(a.teacherName?' • '+a.teacherName:''),
          href:'./assignments.html?id='+encodeURIComponent(a.id),
          reason:overdue?'لأن موعد الواجب فات ولسه محتاج تسليم.':diff<=86400000?'لأن موعد تسليم الواجب خلال أقل من يوم.':'لأنه أقرب واجب مطلوب منك.'
        });
      });

      const liveStatus=s=>{
        if(s.status==='ended')return'ended';
        if(s.status==='live')return'live';
        const at=Number(s.scheduledTime||0),duration=Math.max(10,Number(s.duration||60))*60000;
        if(at&&now>=at&&now<at+duration)return'live';
        if(at&&now>=at+duration)return'ended';
        return'upcoming';
      };
      Object.entries(liveSnap.val()||{}).forEach(([id,s])=>{
        if(!s||s.isHidden===true||Number(s.publishAt||0)>now)return;
        if(s.type&&s.type!==p.educationType)return;
        if(s.stage&&s.stage!==p.stage)return;
        if(s.grade&&String(s.grade)!==String(p.grade))return;
        const st=liveStatus(s),at=Number(s.scheduledTime||0),diff=at-now;
        if(st==='ended')return;
        if(st==='upcoming'&&(!at||diff>24*3600000))return;
        candidates.push({
          kind:'live',
          rank:st==='live'?-2:diff<=2*3600000?-.5:2.5,
          at:at||now,
          title:st==='live'?'🔴 جلسة مباشرة الآن':diff<=2*3600000?'جلسة مباشرة هتبدأ قريب':'جلسة مباشرة قادمة',
          text:(s.title||'جلسة مباشرة')+(s.teacher?' • '+s.teacher:''),
          href:'./live.html?id='+encodeURIComponent(id),
          reason:st==='live'?'لأن الجلسة شغالة الآن.':diff<=2*3600000?'لأن الجلسة هتبدأ خلال ساعتين.':'لأنها أقرب جلسة مباشرة ليك.'
        });
      });

      Object.entries(scheduleSnap.val()||{}).forEach(([id,e])=>{
        if(!e||e.isActive===false)return;
        if(e.type&&e.type!==p.educationType)return;
        if(e.stage&&e.stage!==p.stage)return;
        if(e.grade&&String(e.grade)!==String(p.grade))return;
        const at=nextWeeklyDate(e.dayOfWeek,e.time||'18:00');
        const diff=at-now;
        if(diff<=3*86400000){
          candidates.push({
            kind:'schedule',
            rank:diff<=6*3600000?2:5,
            at,
            title:diff<=6*3600000?'عندك حصة قريبة':'الحصة القادمة',
            text:(e.title||'حصة دراسية')+(e.teacher?' • '+e.teacher:''),
            href:'./schedule.html',
            reason:diff<=6*3600000?'لأن عندك حصة خلال الساعات القليلة القادمة.':'لأنها أقرب حصة في جدولك.'
          });
        }
      });

      candidates.sort((a,b)=>a.rank-b.rank || a.at-b.at);
      let pick=candidates[0];

      if(!pick){
        const subjects=getSubjects(p.stage,String(p.grade),p.educationType);
        const weak=[...subjects].sort((a,b)=>subjectProgressOf(p,a.id)-subjectProgressOf(p,b.id))[0];
        if(weak){
          const q=new URLSearchParams({type:p.educationType,stage:p.stage,grade:String(p.grade),subject:weak.id});
          pick={kind:'subject',title:'ابدأ خطوة خفيفة في '+weak.name,text:'مفيش التزامات عاجلة دلوقتي. درس واحد كفاية كبداية.',href:'./subject.html?'+q.toString(),at:0,rank:8,reason:'لأنها أقل مادة في تقدمك الحالي.'};
        }
      }

      if(pick){
        $('pulseActionTitle').textContent=pick.title;
        $('pulseActionText').textContent=pick.text;
        $('pulseActionBtn').onclick=()=>location.href=pick.href;
        const heroBtn=$('heroContinueBtn');
        if(heroBtn&&Number(pick.rank)<=2.5){
          const heroLabel=pick.kind==='live'?'ادخل الجلسة':pick.kind==='assignment'?'افتح الواجب':pick.kind==='planner'?'ابدأ مهمة اليوم':pick.kind==='schedule'?'شوف موعدك':'ابدأ الآن';
          const heroSmall=heroBtn.querySelector('small'),heroStrong=heroBtn.querySelector('strong'),heroIcon=heroBtn.querySelector('i');
          if(heroSmall)heroSmall.textContent='أفضل خطوة الآن';
          if(heroStrong)heroStrong.textContent=heroLabel;
          if(heroIcon)heroIcon.className='fa-solid '+dashboardSmartIcon(pick.kind);
          heroBtn.onclick=()=>location.href=pick.href;
        }
      }else{
        $('pulseActionTitle').textContent='أنت محدث كل شيء 🎉';
        $('pulseActionText').textContent='استكشف مادة جديدة أو راجع درسًا قديمًا.';
        $('pulseActionBtn').onclick=()=>location.href='./explore.html';
      }

      const next=candidates.filter(x=>x.at>=now).sort((a,b)=>a.at-b.at)[0];
      state.dashboardAttention={
        candidates,
        pick,
        next,
        urgentCount:candidates.filter(x=>Number(x.rank)<=1).length,
        loaded:true,
        updatedAt:now
      };
      renderSmartHomeRecommendations();
      if($('pulseNextTime')){
        $('pulseNextTime').textContent=next
          ? new Date(next.at).toLocaleString('ar-EG',{weekday:'short',hour:'numeric',minute:'2-digit'})
          : 'لا يوجد موعد قريب';
      }
    }catch(e){
      console.warn('Dashboard pulse failed',e);
      if($('pulseActionTitle'))$('pulseActionTitle').textContent='ابدأ من موادك الدراسية';
      if($('pulseActionText'))$('pulseActionText').textContent='اختر مادة وابدأ درسًا قصيرًا.';
      if($('pulseActionBtn'))$('pulseActionBtn').onclick=()=>document.getElementById('studentSubjects')?.scrollIntoView({behavior:'smooth'});
      state.dashboardAttention={candidates:[],pick:null,next:null,urgentCount:0,loaded:false};
      renderSmartHomeRecommendations();
    }
  }

  function renderRecommendedLessons(profile,subjects){
    const box=$('dashboardRecommendedLessons');if(!box)return;
    const subjectMap=new Map(subjects.map(s=>[s.id,s]));
    const progress=profile?.learningProgress||{},teachers=state.publicTeachers||state.dbData.settings?.publicTeachers||{};
    const rows=Object.entries(state.dbData.lessons||{}).map(([id,v])=>({id,...(v||{})}))
      .filter(l=>l&&!l.isHidden&&(!Number(l.publishAt||0)||Number(l.publishAt)<=Date.now())&&l.type===profile.educationType&&l.stage===profile.stage&&String(l.grade)===String(profile.grade)&&subjectMap.has(l.subject));
    if(!rows.length){
      box.innerHTML='<div class="mix-recommended-empty"><span>🎓</span><div><strong>نجهز لك الدروس المناسبة</strong><p>ستظهر هنا أحدث دروس صفك فور نشرها.</p></div></div>';
      return;
    }
    const needMap=new Map(subjects.map(s=>[String(s.id),dashboardSubjectNeed(s,profile)]));
    const ordered=rows.sort((a,b)=>{
      const ad=progress[a.id]?.completed?1:0,bd=progress[b.id]?.completed?1:0;
      if(ad!==bd)return ad-bd;
      const an=needMap.get(String(a.subject))?.score||0,bn=needMap.get(String(b.subject))?.score||0;
      if(an!==bn)return bn-an;
      const alast=String(a.id)===String(profile.lastLessonId||'')?1:0,blast=String(b.id)===String(profile.lastLessonId||'')?1:0;
      if(alast!==blast)return blast-alast;
      return Number(b.createdAt||0)-Number(a.createdAt||0);
    });
    const offset=Math.min(Number(state.recommendedOffset||0),Math.max(0,ordered.length-1));
    const picks=[...ordered.slice(offset),...ordered.slice(0,offset)].slice(0,4);
    box.innerHTML=picks.map(l=>{
      const s=subjectMap.get(l.subject)||{name:'المادة',emoji:'📚'},subjectImage=safeDashboardImage(s.imageUrl||'');
      const ids=new Set();if(l.teacherId)ids.add(String(l.teacherId));(Array.isArray(l.videos)?l.videos:[]).forEach(v=>{if(v?.teacherId)ids.add(String(v.teacherId))});
      const teacherNames=[...ids].map(id=>teachers[id]?.name||(l.videos||[]).find(v=>String(v?.teacherId||'')===id)?.name).filter(Boolean);
      const teacherText=teacherNames.length?teacherNames.slice(0,2).join(' • '):(l.teacherName||'فريق الأكاديمية');
      const done=!!progress[l.id]?.completed,need=needMap.get(String(l.subject))||{avg:null,mistakes:0,progress:subjectProgressOf(profile,l.subject)};
      const recommendationTag=done?'مكتمل':need.mistakes?'راجع '+need.mistakes+' خطأ':need.avg!==null&&need.avg<70?'تقوية':String(l.id)===String(profile.lastLessonId||'')?'كمّل من هنا':'مقترح لك';
      const recommendationReason=need.mistakes?'لأن عندك أخطاء مفتوحة في '+s.name:need.avg!==null&&need.avg<70?'متوسط اختباراتك '+need.avg+'%':String(l.id)===String(profile.lastLessonId||'')?'آخر درس وصلت له':'مناسب لتقدمك الحالي';
      const q=new URLSearchParams({type:profile.educationType,stage:profile.stage,grade:String(profile.grade),subject:l.subject,id:l.id});
      return '<a class="mix-recommended-card '+(done?'completed':'')+'" href="./lesson.html?'+q.toString()+'">'+
        '<div class="mix-recommended-art '+(subjectImage?'has-image':'')+'" '+(subjectImage?'style="background-image:url(&quot;'+safeHtml(subjectImage)+'&quot;)"':'')+'>'+
          (!subjectImage?'<span>'+safeHtml(s.emoji||'📚')+'</span>':'')+
          '<em>'+safeHtml(recommendationTag)+'</em>'+
        '</div>'+
        '<div class="mix-recommended-copy"><small>'+safeHtml(s.name)+'</small><h3>'+safeHtml(l.title||'درس جديد')+'</h3><p><i class="fa-solid fa-chalkboard-user"></i> '+safeHtml(teacherText)+'</p><p class="mix-recommended-reason-v13"><i class="fa-solid fa-wand-magic-sparkles"></i> '+safeHtml(recommendationReason)+'</p><div><span><i class="fa-solid fa-circle-play"></i> '+Number((l.videos||[]).length)+' فيديو</span><strong>'+(done?'راجع الدرس':'ابدأ الآن')+' <i class="fa-solid fa-arrow-left"></i></strong></div></div>'+
      '</a>';
    }).join('');
    const refresh=$('recommendedRefreshBtn');
    if(refresh)refresh.onclick=()=>{state.recommendedOffset=((Number(state.recommendedOffset||0)+1)%ordered.length);renderRecommendedLessons(profile,subjects)};
  }

  function renderDashboardStreak(profile,stats){
    const box=$('streakWeek'),days=profile?.activity?.days||{},lastDate=profile?.activity?.lastDate||'',streak=Math.max(0,Number(stats?.streak||0));
    if(box){
      const today=new Date(),items=[];
      for(let offset=6;offset>=0;offset--){
        const d=new Date(today);d.setDate(today.getDate()-offset);
        const key=localDateKey(d),legacyActive=!Object.keys(days).length&&offset<streak,active=!!days[key]||key===lastDate||legacyActive,isToday=offset===0;
        const label=new Intl.DateTimeFormat('ar-EG',{weekday:'short'}).format(d).replace('،','');
        items.push('<div class="mix-streak-day '+(active?'active ':'')+(isToday?'today':'')+'"><small>'+safeHtml(label)+'</small><span>'+(active?'<i class="fa-solid fa-check"></i>':d.getDate())+'</span></div>');
      }
      box.innerHTML=items.join('');
    }
    const milestones=[3,7,14,30],next=milestones.find(n=>n>streak);
    if($('streakNextReward'))$('streakNextReward').textContent=next?(next-streak)+' يوم حتى مكافأة '+next+' أيام':'سلسلة أسطورية!';
    if($('streakSideMessage'))$('streakSideMessage').textContent=streak>=7?'أسبوع كامل من الاستمرار، ممتاز جدًا!':streak>=3?'بداية قوية، كمّل بنفس الإيقاع.':'ادخل كل يوم وحافظ على السلسلة.';

    const achievements=[
      {icon:'🚀',label:'البداية',ok:Number(stats?.lessons||0)>=1},
      {icon:'📚',label:'5 دروس',ok:Number(stats?.lessons||0)>=5},
      {icon:'🎯',label:'أول اختبار',ok:Number(stats?.quizzes||0)>=1},
      {icon:'🔥',label:'3 أيام',ok:streak>=3},
      {icon:'⭐',label:'500 XP',ok:Number(stats?.xp||0)>=500}
    ];
    if($('dashboardAchievementPreview'))$('dashboardAchievementPreview').innerHTML=achievements.map(a=>'<div class="mix-achievement-mini '+(a.ok?'unlocked':'locked')+'"><span>'+a.icon+'</span><small>'+safeHtml(a.label)+'</small><i class="fa-solid '+(a.ok?'fa-check':'fa-lock')+'"></i></div>').join('');
  }

  function renderDashboard() {
    const p = state.profile;
    const name = p.name || state.user.displayName || 'طالبنا';
    const stats = statsFromProfile();
    const subjects = getSubjects(p.stage, String(p.grade), p.educationType);
    const settings = state.dbData.settings || {};

    const nowDate=new Date(),hour=nowDate.getHours();
    const greeting = hour < 12 ? 'صباح الخير' : hour < 18 ? 'مرحبًا' : 'مساء الخير';
    if($('dashboardGreetingLabel'))$('dashboardGreetingLabel').textContent=greeting;
    if($('dashboardDateLabel'))$('dashboardDateLabel').textContent=nowDate.toLocaleDateString('ar-EG',{weekday:'long',day:'numeric',month:'long'});
    if($('dashStudentName')) $('dashStudentName').textContent = name;
    if($('heroStudentName')) $('heroStudentName').textContent = name;
    if($('dashTodayLabel')) $('dashTodayLabel').textContent = settings.dashboardProfileSubtitle || 'طالب مجتهد يصنع الفرق';
    if($('dashAccountAvatar')) $('dashAccountAvatar').textContent = initials(name);
    if($('dashboardBrandName')) $('dashboardBrandName').textContent = settings.siteName || 'الأكاديمية';

    $('currentGradeTitle').textContent = gradeLabels[p.stage]?.[p.grade] || stageLabels[p.stage] || 'مرحلتك الدراسية';
    $('currentEducationTitle').textContent = educationLabel(p.educationType);

    const hero=$('dashboardHero');
    const customHero=safeDashboardImage(settings.dashboardHeroUrl||'');
    if(hero){
      if(customHero)hero.style.setProperty('--future-dashboard-image','url("'+customHero.replace(/"/g,'%22')+'")');
      else hero.style.removeProperty('--future-dashboard-image');
    }
    if($('dashboardHeroSubtitle')) $('dashboardHeroSubtitle').textContent = settings.dashboardHeroSubtitle || 'كل يوم هو فرصة جديدة للتعلم وتقترب من أهدافك';

    animateDashboardNumber('completedLessons',stats.lessons,500);
    animateDashboardNumber('completedQuizzes',stats.quizzes,520);
    animateDashboardNumber('streakValue',stats.streak,480);
    animateDashboardNumber('xpStat',stats.xp,620);
    const progressValues=subjects.map(s=>Math.max(0,Math.min(100,subjectProgressOf(p,s.id)))),overall=progressValues.length?Math.round(progressValues.reduce((a,b)=>a+b,0)/progressValues.length):0;
    if($('dashboardOverallPercent'))$('dashboardOverallPercent').textContent=overall+'%';
    if($('dashboardOverallRing'))$('dashboardOverallRing').style.setProperty('--progress',(overall*3.6)+'deg');
    if($('heroOverallPercent'))$('heroOverallPercent').textContent=overall+'%';
    if($('heroXpValue'))$('heroXpValue').textContent=stats.xp;
    if($('heroStreakValue'))$('heroStreakValue').textContent=stats.streak;
    if($('heroLevelValue'))$('heroLevelValue').textContent=stats.level;
    const xpInLevel=Math.max(0,stats.xp%1000),xpToNext=xpInLevel===0&&stats.xp>0?1000:1000-xpInLevel,levelPct=stats.xp>0&&xpInLevel===0?100:Math.round(xpInLevel/1000*100);
    if($('heroLevelProgress'))$('heroLevelProgress').style.width=levelPct+'%';
    if($('heroNextLevelText'))$('heroNextLevelText').textContent=levelPct===100?'جاهز للمستوى التالي':('باقي '+xpToNext+' XP للمستوى التالي');
    const progressMessage=overall>=80?'ممتاز! أنت قريب من إنهاء جزء كبير من صفك':overall>=50?'تقدم قوي — حافظ على نفس الإيقاع':overall>=20?'بداية جيدة، وكل درس يصنع فرقًا':'ابدأ أول مادة وخلي تقدمك يظهر هنا';
    const progressHint=overall>=80?'راجع المواد الأقل تقدمًا وأكمل الاختبارات المتبقية.':overall>=50?'ركز على مادة واحدة يوميًا بدل التشتت بين كل المواد.':overall>=20?'كمّل درسًا واختبارًا قصيرًا اليوم لرفع تقدمك.':'اختر مادة واحدة وابدأ بأول درس؛ سنحفظ كل خطوة.';
    if($('dashboardProgressMessage'))$('dashboardProgressMessage').textContent=progressMessage;
    if($('dashboardProgressHint'))$('dashboardProgressHint').textContent=progressHint;
    if($('streakSideValue')) $('streakSideValue').textContent=stats.streak;
    renderDashboardStreak(p,stats);

    const now=Date.now(),isVisibleContent=item=>item&&!item.isHidden&&(!Number(item.publishAt||0)||Number(item.publishAt)<=now);
    const palettes=['subject-pink','subject-blue','subject-green','subject-gold','subject-purple','subject-teal'];
    if($('dashboardSubjectCount'))$('dashboardSubjectCount').textContent=subjects.length;
    if($('dashboardSubjectsStageLabel'))$('dashboardSubjectsStageLabel').textContent=(gradeLabels[p.stage]?.[p.grade]||stageLabels[p.stage]||'مرحلتك')+' • '+educationLabel(p.educationType);
    if($('dashboardSubjectsSubtitle'))$('dashboardSubjectsSubtitle').textContent='مواد '+(gradeLabels[p.stage]?.[p.grade]||'صفك')+' — اختر المادة وابدأ أو تابع من آخر نقطة وصلت لها.';
    $('dashboardSubjects').innerHTML = subjects.map((s,index) => {
      const progress = Math.max(0, Math.min(100, subjectProgressOf(p,s.id)));
      const q = new URLSearchParams({
        type: p.educationType,
        stage: p.stage,
        grade: String(p.grade),
        subject: s.id
      });
      const subjectImage=safeDashboardImage(s.imageUrl||'');
      const subjectLessons=Object.values(state.dbData.lessons||{}).filter(l=>isVisibleContent(l)&&l.type===p.educationType&&l.stage===p.stage&&String(l.grade)===String(p.grade)&&l.subject===s.id);
      const subjectQuizzes=Object.values(state.dbData.quizzes||{}).filter(qz=>isVisibleContent(qz)&&qz.type===p.educationType&&qz.stage===p.stage&&String(qz.grade)===String(p.grade)&&qz.subject===s.id);
      const teacherIds=new Set(),units=new Set();
      subjectLessons.forEach(l=>{
        units.add(Number(l.unit||1));
        if(l.teacherId)teacherIds.add(String(l.teacherId));
        (Array.isArray(l.videos)?l.videos:[]).forEach(v=>{if(v?.teacherId)teacherIds.add(String(v.teacherId))});
      });
      const stateLabel=progress<=0?'ابدأ المادة':progress>=100?'مكتملة 🎉':progress>=70?'اقتربت من الإكمال':progress>=25?'استمر من حيث توقفت':'بداية موفقة';
      return `<a class="ref-subject-card mix-subject-card student-subject-card-v2 ${palettes[index%palettes.length]} ${subjectImage?'has-image':''}" href="./subject.html?${q.toString()}" aria-label="فتح مادة ${safeHtml(s.name)}">
        <div class="student-subject-cover">
          <div class="student-subject-cover-media">${subjectImage?'<img data-subject-image data-fallback="'+safeHtml(s.emoji||'📚')+'" src="'+safeHtml(subjectImage)+'" alt="" loading="lazy">':'<span>'+safeHtml(s.emoji || '📚')+'</span>'}</div>
          <span class="student-subject-progress-pill"><i class="fa-solid fa-chart-simple"></i> ${progress}%</span>
          <span class="student-subject-state">${stateLabel}</span>
        </div>
        <div class="student-subject-body">
          <div class="student-subject-title-row"><div><small>${safeHtml(gradeLabels[p.stage]?.[p.grade]||stageLabels[p.stage]||'')}</small><h3>${safeHtml(s.name)}</h3></div><span class="student-subject-arrow"><i class="fa-solid fa-arrow-left"></i></span></div>
          <div class="student-subject-metrics">
            <span><i class="fa-solid fa-circle-play"></i><b>${subjectLessons.length}</b><small>درس</small></span>
            <span><i class="fa-solid fa-brain"></i><b>${subjectQuizzes.length}</b><small>اختبار</small></span>
            <span><i class="fa-solid fa-layer-group"></i><b>${units.size||'—'}</b><small>وحدة</small></span>
            <span><i class="fa-solid fa-chalkboard-user"></i><b>${teacherIds.size||'—'}</b><small>مدرس</small></span>
          </div>
          <div class="student-subject-progress-row"><div class="ref-subject-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progress}"><span style="width:${progress}%"></span></div><small>${progress}%</small></div>
          <div class="student-subject-footer"><span>${progress>0&&progress<100?'كمّل رحلتك في المادة':'افتح المادة واستكشف محتواها'}</span><strong>${progress>0&&progress<100?'متابعة':'فتح المادة'} <i class="fa-solid fa-arrow-left"></i></strong></div>
        </div>
      </a>`;
    }).join('');

    renderRecommendedLessons(p,subjects);
    renderSmartHomeRecommendations();

    const first = subjects[0];
    const lastSubject = subjects.find(s => s.id === p.lastSubjectId) || first;
    if (lastSubject) {
      const continueProgress=Math.max(0,Math.min(100,subjectProgressOf(p,lastSubject.id)));
      const visibleSubjectLessons=Object.values(state.dbData.lessons||{}).filter(l=>l&&!l.isHidden&&(!Number(l.publishAt||0)||Number(l.publishAt)<=Date.now())&&l.type===p.educationType&&l.stage===p.stage&&String(l.grade)===String(p.grade)&&l.subject===lastSubject.id);
      if($('continueSubjectName')) $('continueSubjectName').textContent=lastSubject.name;
      if($('continueVisualSubject'))$('continueVisualSubject').textContent=lastSubject.name;
      if($('continueProgressLabel')) $('continueProgressLabel').textContent=continueProgress+'%';
      if($('continueProgressBar'))$('continueProgressBar').style.width=continueProgress+'%';
      if($('continueLessonCount'))$('continueLessonCount').textContent=visibleSubjectLessons.length;
      if($('continueStatusLabel'))$('continueStatusLabel').textContent=p.lastLessonId?'جاهز للمتابعة':continueProgress?'كمّل تقدمك':'ابدأ الآن';
      const continueImage=safeDashboardImage(lastSubject.imageUrl||'');
      if($('continueLessonVisual')){
        $('continueLessonVisual').style.backgroundImage=continueImage?'linear-gradient(rgba(15,23,42,.10),rgba(15,23,42,.46)),url("'+continueImage.replace(/"/g,'%22')+'")':'';
        $('continueLessonVisual').classList.toggle('has-image',!!continueImage);
      }
      $('continueTitle').textContent = p.lastLessonTitle || `ابدأ أول درس في ${lastSubject.name}`;
      $('continueMeta').textContent = p.lastLessonTitle
        ? `${lastSubject.name} • ${gradeLabels[p.stage]?.[p.grade] || ''} • سنفتح آخر نقطة وصلت لها`
        : 'اختر المادة وابدأ، وسنحفظ تقدمك تلقائيًا.';
      const subjectUrl=()=>{
        const q=new URLSearchParams({type:p.educationType,stage:p.stage,grade:String(p.grade),subject:lastSubject.id});
        return './subject.html?'+q.toString();
      };
      const go=() => {
        const q = new URLSearchParams({
          type: p.educationType,
          stage: p.stage,
          grade: String(p.grade),
          subject: lastSubject.id
        });
        if (p.lastLessonId) q.set('id', p.lastLessonId);
        location.href = p.lastLessonId ? './lesson.html?' + q.toString() : './subject.html?' + q.toString();
      };
      $('continueLearningBtn').onclick=go;
      if($('continuePlayBtn')) $('continuePlayBtn').onclick=go;
      if($('heroContinueBtn'))$('heroContinueBtn').onclick=go;
      if($('continueOpenSubjectBtn'))$('continueOpenSubjectBtn').onclick=()=>location.href=subjectUrl();
    }

    loadDailyGoals();
    loadDashboardPulse();
    renderHeaderUser();
  }

  function renderExplorerStages() {
    const list = $('explorerStageList');
    const query = state.explorer.search.toLowerCase().trim();
    const types = state.explorer.type === 'all' ? ['public','azhar'] : [state.explorer.type];
    const rows = [];

    types.forEach(type => {
      ['primary','prep','sec'].forEach(stage => {
        const title = `${stageLabels[stage]} • ${educationLabel(type)}`;
        if (query && !title.toLowerCase().includes(query)) return;
        rows.push({type,stage,title,emoji: stage==='primary'?'🎒':stage==='prep'?'📚':'🎓'});
      });
    });

    list.innerHTML = rows.map(r => `<article class="explorer-stage-item" data-explorer-stage="${r.stage}" data-explorer-type="${r.type}">
      <span class="emoji">${r.type==='azhar'?'🕌':r.emoji}</span>
      <div><strong>${r.title}</strong><small>استكشف الصفوف والمواد المتاحة بدون تغيير مرحلتك الأساسية.</small></div>
      <button aria-label="استكشف"><i class="fa-solid fa-arrow-left"></i></button>
    </article>`).join('') || '<p>لا توجد نتائج مطابقة.</p>';
  }

  function allExplorerSubjects() {
    const seen = new Map();
    Object.keys(defaults).forEach(stage => defaults[stage].forEach(s => seen.set(s.id, s)));
    const customSubjects = state.dbData.customSubjects || {};
    Object.entries(customSubjects).forEach(([stage, grades]) => {
      Object.values(grades || {}).forEach(arr => {
        if (!Array.isArray(arr)) return;
        arr.forEach(s => {
          if(!s?.id||!s?.name)return;
          const item={id:s.id,name:s.name,emoji:s.emoji||'⭐',imageUrl:s.imageUrl||''};
          seen.set(s.id,{...(seen.get(s.id)||{}),...item});
        });
      });
    });
    return [...seen.values()];
  }

  function renderExplorerSubjects(subjects = null, context = null) {
    const query = state.explorer.search.toLowerCase().trim();
    const items = subjects || allExplorerSubjects();
    $('explorerSubjectList').innerHTML = items
      .filter(s => !query || s.name.toLowerCase().includes(query))
      .map(s => {
        const subjectImage=safeDashboardImage(s.imageUrl||'');
        return `<article class="explorer-subject-item ${subjectImage?'has-image':''}">
        <span class="emoji">${subjectImage?'<img data-subject-image data-fallback="'+safeHtml(s.emoji||'📚')+'" src="'+safeHtml(subjectImage)+'" alt="" loading="lazy">':safeHtml(s.emoji || '📚')}</span>
        <div><strong>${s.name}</strong><small>${context || 'متاحة في مراحل مختلفة حسب المنهج'}</small></div>
        <button aria-label="فتح المادة"><i class="fa-solid fa-arrow-left"></i></button>
      </article>`;}).join('') || '<p>لا توجد مواد مطابقة.</p>';
  }

  function switchExplorerTab(tab) {
    state.explorer.tab = tab;
    $$('[data-explorer-tab]').forEach(b => b.classList.toggle('active', b.dataset.explorerTab === tab));
    $('explorerStagesView').classList.toggle('hidden', tab !== 'stages');
    $('explorerSubjectsView').classList.toggle('hidden', tab !== 'subjects');
    if (tab === 'stages') renderExplorerStages(); else renderExplorerSubjects();
  }

  function openExplorer(type = 'all', stage = null) {
    state.explorer.type = type || 'all';
    state.explorer.stage = stage || null;
    state.explorer.search = '';
    $('explorerSearch').value = '';
    $$('[data-type-filter]').forEach(b => b.classList.toggle('active', b.dataset.typeFilter === state.explorer.type));
    switchExplorerTab('stages');
    $('explorerBackdrop').classList.remove('hidden');
    $('explorerDrawer').classList.add('open');
    document.body.style.overflow = 'hidden';

    if (stage && type && type !== 'all') {
      const subjects = getSubjects(stage, '1', type);
      switchExplorerTab('subjects');
      renderExplorerSubjects(subjects, `${stageLabels[stage]} • ${educationLabel(type)}`);
    }
  }

  function closeExplorer() {
    $('explorerDrawer').classList.remove('open');
    $('explorerBackdrop').classList.add('hidden');
    document.body.style.overflow = '';
  }

  function bindEvents() {
    $('year').textContent = new Date().getFullYear();

    $$('[data-open-auth]').forEach(btn => btn.addEventListener('click', () => {
      switchAuthTab(btn.dataset.openAuth);
      openModal('authModal');
    }));

    $$('[data-close-modal]').forEach(btn => btn.addEventListener('click', () => closeModal(btn.dataset.closeModal)));
    $$('[data-auth-tab]').forEach(btn => btn.addEventListener('click', () => switchAuthTab(btn.dataset.authTab)));

    $$('[data-toggle-pass]').forEach(btn => btn.addEventListener('click', () => {
      const input = $(btn.dataset.togglePass);
      input.type = input.type === 'password' ? 'text' : 'password';
      btn.innerHTML = input.type === 'password' ? '<i class="fa-regular fa-eye"></i>' : '<i class="fa-regular fa-eye-slash"></i>';
    }));

    $('mobileMenuBtn').addEventListener('click', () => $('mobileMenu').classList.toggle('hidden'));
    document.querySelectorAll('[data-mobile-dash-target]').forEach(btn=>btn.addEventListener('click',()=>{
      const target=$(btn.dataset.mobileDashTarget);if(target)target.click();
      document.querySelectorAll('#academyMobileBottomNav button').forEach(x=>x.classList.toggle('active',x===btn));
    }));
    const dashSearchInput = $('dashSearchInput');
    const dashSearchForm = $('dashSearchForm');
    dashSearchForm?.addEventListener('submit',e=>{
      e.preventDefault();
      const q=dashSearchInput?.value.trim()||'';
      if(q)location.href='./search.html?q='+encodeURIComponent(q);
      else dashSearchInput?.focus();
    });
    dashSearchInput?.addEventListener('input',renderDashSearchSuggestions);
    dashSearchInput?.addEventListener('keydown',e=>{if(e.key==='Escape')$('dashSearchSuggestions')?.classList.add('hidden')});
    document.addEventListener('click',e=>{if(!e.target.closest('.ref-dashboard-search-wrap-v12'))$('dashSearchSuggestions')?.classList.add('hidden')});
    $('userChip').addEventListener('click', () => $('userMenu').classList.toggle('hidden'));
    if (!document.getElementById('profileMenuBtn')) {
      const profileBtn = document.createElement('button');
      profileBtn.id = 'profileMenuBtn';
      profileBtn.innerHTML = '<i class="fa-regular fa-user"></i> حسابي';
      profileBtn.addEventListener('click', () => location.href='./profile.html');
      $('userMenu').insertBefore(profileBtn, $('logoutBtn'));
    }
    $('mobileProfileBtn')?.addEventListener('click', () => location.href='./profile.html');
    $('notificationBtn')?.addEventListener('click', (e) => { e.stopPropagation(); showNotificationPopover(); });
    $('dashNotificationBtn')?.addEventListener('click', (e) => { e.stopPropagation(); showNotificationPopover(); });
    $('goDashboardBtn').addEventListener('click', showDashboard);
    $('exploreFromMenu').addEventListener('click', () => location.href='./explore.html');
    $('logoutBtn').addEventListener('click', async () => { await auth.signOut(); $('userMenu').classList.add('hidden'); });

    $('dashProfileBtn')?.addEventListener('click', () => location.href='./profile.html?tab=account');
    $('dashStudySettingsBtn')?.addEventListener('click', () => location.href='./profile.html?tab=study');
    $('dashChangeStudyBtn')?.addEventListener('click', () => location.href='./profile.html?tab=study');
    $('dashAccountProfile')?.addEventListener('click', () => location.href='./profile.html?tab=account');
    $('dashAccountStudy')?.addEventListener('click', () => location.href='./profile.html?tab=study');
    $('dashAccountBtn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      $('dashAccountMenu')?.classList.toggle('hidden');
    });
    const dashboardLogout = async () => {
      await auth.signOut();
      location.replace('./index.html');
    };
    $('dashLogoutBtn')?.addEventListener('click', dashboardLogout);
    $('dashAccountLogout')?.addEventListener('click', dashboardLogout);

    const loginForm = $('loginForm');
    $('legacyLoginToggle').addEventListener('click', () => {
      legacyEmailLogin = !legacyEmailLogin;
      $('loginPhoneField').classList.toggle('hidden', legacyEmailLogin);
      $('loginEmailField').classList.toggle('hidden', !legacyEmailLogin);
      $('loginPhone').required = !legacyEmailLogin;
      $('loginEmail').required = legacyEmailLogin;
      $('legacyLoginToggle').textContent = legacyEmailLogin ? 'الدخول برقم الهاتف' : 'لدي حساب قديم بالبريد الإلكتروني';
      (legacyEmailLogin ? $('loginEmail') : $('loginPhone')).focus();
    });
    if (loginForm && loginForm.dataset.authBound !== 'true') {
      loginForm.dataset.authBound = 'true';
      loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = $('loginSubmitBtn');
        btn.disabled = true; btn.textContent = 'جاري تسجيل الدخول...';
        try {
          await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
          const email = legacyEmailLogin ? $('loginEmail').value.trim() : phoneLoginEmail($('loginPhone').value).email;
          await auth.signInWithEmailAndPassword(email, $('loginPassword').value);
          closeModal('authModal');
          toast('تم تسجيل الدخول بنجاح 👋');
        } catch (error) {
          toast(friendlyAuthError(error), 'error');
        } finally {
          btn.disabled = false; btn.textContent = 'تسجيل الدخول';
        }
      });
    }

    $('registerStage').addEventListener('change', () => {
      const stage=$('registerStage').value,select=$('registerGrade');
      select.innerHTML='<option value="">اختر الصف الدراسي</option>'+(gradeLabels[stage]?Object.entries(gradeLabels[stage]).map(([grade,label])=>'<option value="'+grade+'">'+label+'</option>').join(''):'');
      select.disabled=!stage;
    });

    $('registerForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = $('registerSubmitBtn');
      const name = $('registerName').value.trim();
      const educationType=$('registerEducationType').value,stage=$('registerStage').value,grade=Number($('registerGrade').value);
      if(!['public','azhar'].includes(educationType)||!gradeLabels[stage]?.[grade])return toast('اختر نوع التعليم والمرحلة والصف أولًا.','error');
      let login;
      try { login = phoneLoginEmail($('registerPhone').value); }
      catch (error) { return toast(error.message, 'error'); }
      btn.disabled = true; btn.textContent = 'جاري إنشاء الحساب...';
      registerInProgress=true;
      let createdUser=null;
      try {
        const cred = await auth.createUserWithEmailAndPassword(login.email, $('registerPassword').value);
        createdUser=cred.user;
        state.user=cred.user;
        await cred.user.updateProfile({displayName:name});
        await saveProfile(cred.user.uid, {
          name,
          phone: login.phone,
          loginMethod: 'phone',
          createdAt: firebase.database.ServerValue.TIMESTAMP,
          educationType,stage,grade,onboardingCompleted:true,
          stats: { totalXP:0, level:1, completedLessons:0, completedQuizzes:0, streak:0 }
        });
        state.profile = await loadProfile(cred.user.uid);
        await ensureStudentPhoneIndex(cred.user.uid,state.profile);
        closeModal('authModal');
        showDashboard();
        toast('تم إنشاء الحساب وفتح مرحلتك بنجاح ✨');
      } catch (error) {
        if(createdUser){closeModal('authModal');openModal('onboardingModal');toast('تم إنشاء الحساب، لكن تعذر حفظ المرحلة. اخترها مرة أخرى.','error')}
        else toast(friendlyAuthError(error), 'error');
      } finally {
        registerInProgress=false;
        btn.disabled = false; btn.textContent = 'إنشاء الحساب ودخول مرحلتي';
      }
    });

    $('forgotPasswordBtn').addEventListener('click', async () => {
      if (!legacyEmailLogin) return toast('إذا نسيت كلمة مرور حساب الهاتف، تواصل مع إدارة المنصة. يمكنك تغييرها من ملفك الشخصي أثناء تسجيل الدخول.', 'error');
      const email = $('loginEmail').value.trim();
      if (!email) return toast('اكتب بريدك الإلكتروني أولًا.', 'error');
      try {
        await auth.sendPasswordResetEmail(email);
        toast('أرسلنا لك رابط إعادة تعيين كلمة المرور.');
      } catch (error) {
        toast(friendlyAuthError(error), 'error');
      }
    });

    $$('input[name="stage"]').forEach(input => input.addEventListener('change', () => updateGradeOptions(input.value)));

    $('onboardingForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const type = document.querySelector('input[name="educationType"]:checked')?.value;
      const stage = document.querySelector('input[name="stage"]:checked')?.value;
      const grade = document.querySelector('input[name="grade"]:checked')?.value;
      if (!type || !stage || !grade) return toast('اختر نوع التعليم والمرحلة والصف.', 'error');
      try {
        await saveProfile(state.user.uid, {
          educationType:type,
          stage,
          grade:Number(grade),
          onboardingCompleted:true,
          updatedAt:firebase.database.ServerValue.TIMESTAMP
        });
        state.profile = await loadProfile(state.user.uid);
        closeModal('onboardingModal');
        showDashboard();
        toast('تم تجهيز تجربتك التعليمية بنجاح 🎉');
      } catch (error) {
        toast('تعذر حفظ المرحلة. حاول مرة أخرى.', 'error');
      }
    });

    $('openExplorerPublic').addEventListener('click', () => location.href='./explore.html');
    $('openSubjectsExplorer').addEventListener('click', () => location.href='./explore.html');
    $('exploreAllStagesMain')?.addEventListener('click', () => location.href='./explore.html');
    $('dashHomeBtn')?.addEventListener('click', () => window.scrollTo({top:0,behavior:'smooth'}));
    $('dashSubjectsBtn')?.addEventListener('click', () => document.getElementById('studentSubjects')?.scrollIntoView({behavior:'smooth'}));
    $('heroSubjectsBtn')?.addEventListener('click', () => document.getElementById('studentSubjects')?.scrollIntoView({behavior:'smooth',block:'start'}));
    $('heroQuizBtn')?.addEventListener('click', () => location.href='./exam-center.html');
    $('dashTestsBtn')?.addEventListener('click', () => location.href='./exam-center.html');
    $('dashProgressBtn')?.addEventListener('click', () => location.href='./progress.html');
    $('dashPlannerBtn')?.addEventListener('click', () => location.href='./planner.html');
    $('dashSimulationsBtn')?.addEventListener('click', () => location.href='./simulations.html');
    $('dashLibraryBtn')?.addEventListener('click', () => location.href='./library.html');
    $('dashLiveBtn')?.addEventListener('click', () => location.href='./live.html');
    $('dashCommunityBtn')?.addEventListener('click', () => location.href='./community.html');
    $('dashLeaderboardBtn')?.addEventListener('click', () => location.href='./leaderboard.html');
    $('exploreAllStagesSide')?.addEventListener('click', () => location.href='./explore.html');
    $('sidebarExplorePromo')?.addEventListener('click', () => location.href='./explore.html');
    const currentMaterialsUrl=()=>{
      const p=state.profile||{};
      const q=new URLSearchParams();
      if(p.educationType)q.set('type',p.educationType);
      if(p.stage)q.set('stage',p.stage);
      if(p.grade)q.set('grade',String(p.grade));
      return './explore.html?'+q.toString();
    };
    $('exploreSubjectsDash')?.addEventListener('click', () => location.href=currentMaterialsUrl());
    $('dashboardExploreOtherStages')?.addEventListener('click', () => location.href='./explore.html?'+new URLSearchParams({type:state.profile?.educationType||'public'}));
    $('mobileExploreBtn')?.addEventListener('click', () => location.href='./explore.html');
    $('mobileSubjectsBtn')?.addEventListener('click', () => document.getElementById('studentSubjects')?.scrollIntoView({behavior:'smooth'}));
    $('mobileTestsBtn')?.addEventListener('click', () => location.href='./exam-center.html');
    $('mobileHomeBtn')?.addEventListener('click', () => window.scrollTo({top:0,behavior:'smooth'}));
    $('openMoreServices')?.addEventListener('click',()=>{
      const sidebar=$('dashboardSidebar'),menu=$('dashboardMoreMenu'),toggle=$('dashboardMoreToggle');
      sidebar?.classList.add('open');menu?.classList.remove('hidden');toggle?.classList.add('open');toggle?.setAttribute('aria-expanded','true');
    });
    $('closeExplorer').addEventListener('click', closeExplorer);
    $('explorerBackdrop').addEventListener('click', closeExplorer);

    $$('[data-explore-type][data-explore-stage]').forEach(card => card.addEventListener('click', () => {
      location.href='./explore.html?'+new URLSearchParams({type:card.dataset.exploreType,stage:card.dataset.exploreStage});
    }));

    $$('[data-type-filter]').forEach(btn => btn.addEventListener('click', () => {
      state.explorer.type = btn.dataset.typeFilter;
      $$('[data-type-filter]').forEach(b => b.classList.toggle('active', b === btn));
      renderExplorerStages();
    }));

    $$('[data-explorer-tab]').forEach(btn => btn.addEventListener('click', () => switchExplorerTab(btn.dataset.explorerTab)));

    $('explorerSearch').addEventListener('input', (e) => {
      state.explorer.search = e.target.value;
      if (state.explorer.tab === 'stages') renderExplorerStages(); else renderExplorerSubjects();
    });

    $('explorerStageList').addEventListener('click', (e) => {
      const row = e.target.closest('[data-explorer-stage]');
      if (!row) return;
      const stage = row.dataset.explorerStage;
      const type = row.dataset.explorerType;
      const subjects = getSubjects(stage, '1', type);
      switchExplorerTab('subjects');
      renderExplorerSubjects(subjects, `${stageLabels[stage]} • ${educationLabel(type)}`);
    });

    $('dashMobileMenu').addEventListener('click', () => document.querySelector('.dashboard-sidebar').classList.toggle('open'));

    initDashboardSidebar();
    $('[data-daily-goal]').forEach(btn=>btn.addEventListener('click',()=>{
      const key=btn.dataset.dailyGoal;
      if(key==='assignment')location.href='./assignments.html';
      else if(key==='quiz')location.href='./exam-center.html';
      else if(key==='review')location.href='./planner.html';
      else $('continueLearningBtn')?.click();
    }));
    $('dailyQuickStart')?.addEventListener('click',()=>{
      const firstIncomplete=$$('[data-daily-goal]').find(btn=>!btn.classList.contains('completed'));
      const key=firstIncomplete?.dataset.dailyGoal||'lesson';
      if(key==='lesson') $('continueLearningBtn')?.click();
      else if(key==='assignment') location.href='./assignments.html';
      else if(key==='quiz') location.href='./exam-center.html';
      else location.href='./planner.html';
    });


    document.addEventListener('click', (e) => {
      if (!e.target.closest('#userChip') && !e.target.closest('#userMenu')) $('userMenu')?.classList.add('hidden');
      if (!e.target.closest('#dashAccountBtn') && !e.target.closest('#dashAccountMenu')) $('dashAccountMenu')?.classList.add('hidden');
    });
  }

  auth.onAuthStateChanged(async user => {
    state.user = user;
    if(user&&registerInProgress)return;
    if (!user) {
      state.profile = null;
      showPublicExperience();
      $('guestNavActions').classList.remove('hidden');
      $('userNavActions').classList.add('hidden');
      return;
    }

    window.AcademyUI?.showPageLoading('جاري تجهيز مساحتك التعليمية...');
    try {
      if(!baseDataPromise) baseDataPromise=loadDatabaseSnapshot();
      await baseDataPromise;
      state.profile = await loadProfile(user.uid);
      await updateDailyActivity(user.uid);
      state.profile = await loadProfile(user.uid);
      if(state.profile?.stage)await loadDashboardLessonCatalog(state.profile);
    } catch (e) {
      console.warn(e);
      state.profile = null;showPublicExperience();
      toast('تعذر تحميل حسابك. أعد تحميل الصفحة للمحاولة مرة أخرى.','error');
      return;
    }
    if(state.user?.uid!==user.uid)return;
    renderHeaderUser();

    if (!state.profile?.onboardingCompleted || !state.profile?.stage || !state.profile?.grade) {
      showPublicExperience();
      openModal('onboardingModal');
    } else {
      showDashboard();
    }
  });

  async function init() {
    bindEvents();
    if(new URLSearchParams(location.search).get('auth')==='login'&&!auth.currentUser){switchAuthTab('login');openModal('authModal')}
    if(!baseDataPromise) baseDataPromise=loadDatabaseSnapshot();
    await baseDataPromise;
    applyVisualSettings();
    renderPublicNews();
    database.ref('settings/publicTeachers').on('value',snapshot=>{state.publicTeachers=snapshot.val()||{};renderPublicTeachers(state.publicTeachers);if($('dashSearchInput')?.value.trim())renderDashSearchSuggestions()},err=>{console.warn('Teacher directory unavailable',err);state.publicTeachers={};renderPublicTeachers()});
    renderExplorerStages();
    renderExplorerSubjects();
  }

  init();
})();
