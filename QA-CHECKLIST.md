# Academy Platform — Phase 1 QA Checklist

This checklist is the release gate for `main`.

## Automated gate
- [ ] Static QA workflow passes on latest `main`.
- [ ] GitHub Pages deployment succeeds on the same commit.
- [ ] No missing local HTML/CSS/JS references.
- [ ] No JavaScript syntax errors.
- [ ] No duplicate static HTML IDs.

## Student journey
- [ ] Register a new account.
- [ ] Select education type, stage and grade.
- [ ] Refresh and confirm the session persists.
- [ ] Open dashboard and verify only the selected study context is shown.
- [ ] Open a subject, unit and lesson.
- [ ] Switch between multiple teacher videos.
- [ ] Complete a lesson once; verify +50 XP is not awarded twice.
- [ ] Confirm subject progress is isolated by education type, stage, grade and subject.
- [ ] Complete/retry a quiz; verify XP is only awarded for a new reward tier.
- [ ] Open Exam Center and verify locked/unlocked quizzes.
- [ ] Run/retry a simulation; verify repeat attempts cannot farm XP.
- [ ] Verify certificate is available only when all lessons in the exact subject context are complete.
- [ ] Add, complete and delete planner tasks.
- [ ] Verify planner items appear in the smart schedule.
- [ ] Verify weekly report reflects planner/quiz/simulation activity.
- [ ] Open library files and reject invalid links.
- [ ] Open live session viewer and close with Escape/backdrop.
- [ ] Create, like and report a community post.
- [ ] Join/leave a study group.
- [ ] Verify leaderboard periods and XP.
- [ ] Mark one/all notifications read.
- [ ] Submit an assignment, update it before grading, then view teacher feedback.
- [ ] Change name and study stage from profile.
- [ ] Log out and log back in.
- [ ] Test mobile bottom navigation on major student pages.
- [ ] Test PWA direct entry and offline shell.

## Teacher journey
- [ ] Sign in with an active teacher profile.
- [ ] Confirm only assigned subjects are selectable.
- [ ] Submit lesson content for admin review.
- [ ] Reject invalid/non-YouTube lesson video URLs.
- [ ] Create an assignment only for an assigned subject.
- [ ] Reject past due dates and invalid max scores.
- [ ] View student submissions; confirm newest/ungraded appear first.
- [ ] Grade within valid score range.
- [ ] Edit an existing grade.
- [ ] Verify modal focus/Escape behavior.
- [ ] Verify keyboard tab navigation.
- [ ] Log out with confirmation.
- [ ] Test responsive teacher portal on mobile.

## Admin journey
- [ ] Sign in with an admin account only.
- [ ] Verify overview loads before lazy sections.
- [ ] Open each admin section and confirm data loads on demand.
- [ ] Use global admin search.
- [ ] Create/edit/delete subjects, lessons, quizzes, files, simulations and live sessions.
- [ ] Add/edit schedule events.
- [ ] Create/edit news and announcements.
- [ ] Add/edit/disable teachers.
- [ ] Assign a subject to a teacher and prevent duplicate assignment.
- [ ] Approve/reject teacher submissions.
- [ ] View/manage students.
- [ ] Moderate community content/reports.
- [ ] Send targeted notification broadcasts.
- [ ] Verify forms show loading/error feedback.
- [ ] Verify all modals close with Escape/backdrop and restore focus.
- [ ] Verify current admin tab survives refresh.
- [ ] Test responsive admin portal on mobile.
- [ ] Log out with confirmation.

## Firebase release gate
- [ ] Apply the reviewed rules from `firebase.rules.production.json` in Firebase Console.
- [ ] Confirm required indexes exist for lessons, quizzes, files, assignments, schedule events and leaderboard XP.
- [ ] Test student writes only under their own profile/submissions.
- [ ] Test teacher writes only to allowed teacher paths.
- [ ] Test admin-only paths with a non-admin account.
- [ ] Confirm denied reads/writes show user-friendly errors.

## Final release
- [ ] Hard refresh production after deployment.
- [ ] Test Chrome desktop.
- [ ] Test Android Chrome.
- [ ] Test a narrow mobile viewport.
- [ ] Test a fresh/incognito session.
- [ ] Test an existing account with legacy progress data.
- [ ] Confirm latest Service Worker cache version is active.
