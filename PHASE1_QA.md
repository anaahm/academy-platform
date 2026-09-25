# Phase 1 — Stability & UI QA

آخر تحديث: 24 سبتمبر 2026

## الهدف
هذه المرحلة لا تضيف مميزات جديدة. الهدف هو تثبيت المنصة الحالية، توحيد التصميم، ومنع رجوع أخطاء التشغيل المتكررة قبل مواصلة التطوير.

## فحص آلي تم اجتيازه
- جميع ملفات JavaScript الأساسية تمر من فحص Syntax.
- لا توجد استخدامات `$$$`.
- لا توجد collection selectors مع `$` بدل `$$` في الملفات الأساسية.
- ملفات Firebase التي تقوم بالتهيئة تستخدم guard قبل `initializeApp`.
- لا توجد حوارات متصفح قديمة `alert/prompt/confirm` في المسارات الأساسية؛ الإجراءات الحساسة تستخدم AcademyUI.
- ربط IDs الأساسية تم تدقيقه بين HTML وJavaScript للطالب والمدرس والإدارة.
- Service Worker محدث ليشمل UI Kit والصفحات الأساسية.

## تجربة الطالب — اختبار يدوي قبل كل إصدار
- إنشاء حساب جديد.
- تسجيل الدخول ثم Refresh والتأكد أن الجلسة محفوظة.
- تسجيل الخروج ثم تسجيل الدخول مرة أخرى.
- تعديل الاسم.
- تغيير نوع التعليم والمرحلة والصف.
- فتح كل مادة من Dashboard.
- فتح درس والانتقال بين الفيديو والشرح والتدريب.
- إكمال درس والتأكد من حفظ التقدم وXP.
- Quick Check داخل الدرس.
- فتح اختبار وحدة بعد إكمال دروسها.
- محاولة فتح اختبار مقفول والتأكد من ظهور رسالة واضحة.
- الواجبات: عرض، تسليم، مشاهدة التصحيح.
- الجدول: الحصص والبث ومهام المذاكرة.
- مركز الإشعارات وحالة مقروء/غير مقروء.
- المخطط والتقرير الأسبوعي والمكتبة والمحاكيات والمجتمع.
- اختبار الموبايل عند 360px و390px و430px.
- اختبار الكمبيوتر عند 1366px و1920px.

## تجربة المدرس
- تسجيل الدخول والتحقق من الصلاحية.
- فتح جميع التبويبات.
- إضافة محتوى.
- إنشاء واجب.
- مشاهدة تسليمات الطلاب.
- تصحيح واجب بدرجة وتعليق.
- حذف واجب والتأكد من حذف التسليمات أولًا.
- اختبار القائمة الجانبية على الهاتف والكمبيوتر.

## تجربة الإدارة
- تسجيل الدخول والتحقق من isAdmin.
- فتح جميع أقسام القائمة.
- إضافة/تعديل/حذف مادة ودرس واختبار وملف ومحاكي.
- إضافة مدرس وتفعيل/تعطيل الحساب.
- إدارة الطلاب.
- إضافة بث وحصة أسبوعية.
- إرسال إشعار موجه.
- اختبار كل نوافذ التأكيد قبل الحذف.
- اختبار الجداول والفلاتر والمودالات على الهاتف.

## Design System
- `assets/ui-kit.css`: الهوية البصرية المشتركة، Responsive، حالات Focus، Modals، Loading، Empty/Error states.
- `assets/ui-kit.js`: Confirm dialogs، route progress، offline/online banner، mobile student navigation، accessibility helpers.
- يجب استخدام AcademyUI لأي Confirmation جديد بدل `window.confirm`.
- يجب استخدام `$$` عند التعامل مع مجموعة عناصر.

## قاعدة المرحلة الأولى
أي ميزة جديدة لا تبدأ قبل اجتياز مسارها الحالي لاختبار التشغيل والموبايل.


## Premium 3D interface pass — 2026-09-25

Completed a full visual-system pass based on the approved student dashboard reference.

### Covered surfaces
- Student dashboard and navigation
- Subject page
- Lesson page
- Exam center and simulations
- Assignments
- Student profile
- Progress
- Study planner
- Schedule
- Weekly report
- Library
- Live sessions
- Community
- Leaderboard
- Notifications
- Explore
- Search
- News
- Certificate
- Teacher portal
- Admin console

### Visual/system checks
- Shared 3D button depth, hover and pressed states
- 3D icon treatment with highlight + depth shadow
- Elevated cards with unified borders and soft shadows
- Responsive grid safeguards using min-width: 0 and mobile collapse rules
- Sticky sidebars disabled/repositioned at smaller breakpoints where needed
- Horizontal tab overflow handled on mobile
- Reduced-motion fallbacks for decorative animation
- Dashboard hero remains configurable from Admin > Settings
- PWA shell refreshed to v28 and key portal/admin assets added to cache

### Static validation completed
- JavaScript syntax checks passed for all major student pages, teacher portal, and admin console
- No duplicate HTML IDs found in audited pages
- No broken collection-selector pattern found in audited JavaScript
- Shared CSS files and page CSS files have balanced braces
- Known reported "missing IDs" are dynamic DOM elements or shared-script cross-page IDs, not runtime errors
