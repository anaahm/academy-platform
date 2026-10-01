# Phase 11 — Final QA Checklist

## Automated release gate

- [x] JavaScript syntax validation for project scripts.
- [x] HTML/static validation across academy pages.
- [x] URL and question validation regression tests.
- [x] Rich lesson HTML sanitization regression test.
- [x] Student registration with education type, stage and grade.
- [x] Student lesson rendering with rich text and inline images.
- [x] Immediate correct/wrong answer feedback.
- [x] Full quiz result and answer review.
- [x] Mistake notebook creation and correction.
- [x] Spaced-review advancement after correcting a previous mistake.
- [x] Lesson cannot be completed before required training.
- [x] Lesson cannot be completed while lesson mistakes remain.
- [x] Completion is idempotent and awards lesson XP once.
- [x] Linked quiz remains locked until lesson completion.
- [x] Parent linked-student dashboard.
- [x] Teacher content submission remains pending until admin approval.
- [x] Admin approval preserves article, video, image and questions.
- [x] Admin, teacher and parent sessions are isolated from student auth.
- [x] Parent logout does not log out the student session.
- [x] Admin session remains active when the student/default session changes.
- [x] Non-student accounts are blocked from protected student lesson access.
- [x] Admin lesson preview works through the isolated admin session.

## Live-environment checks before production cutover

These require the real deployment credentials/environment rather than the in-memory QA harness:

- [ ] Sign in once with one real account for each role: student, teacher, parent, admin.
- [ ] Open student + parent + teacher + admin in separate tabs and verify login/logout isolation in the deployed browser.
- [ ] Verify the currently deployed database rules match the final role model.
- [ ] Verify one real teacher submission → admin approval → student lesson publication.
- [ ] Verify one real parent link by student phone/code.
- [ ] Verify subscription enforcement with one free item and one subscriber-only item if paid access is enabled.
- [ ] Verify PWA cache refresh after the final deployment.

## Deferred by project scope

- Applying/changing production Firebase Rules.
- Hostinger database migration and domain cutover.
- Production content population.
