import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    copyPublicDir: true,
    rollupOptions: {
      input: {
        main: 'index.html',
        login: 'login.html',
        admin: 'admin-dashboard.html',
        profesor: 'profesor-dashboard.html',
        student: 'student-dashboard.html',
        attendance: 'attendance.html',
        exercise: 'exercise-list.html',
        membership: 'membership-list.html',
        progress: 'progress.html',
        routine_builder: 'routine-builder.html',
        routine_list: 'routine-list.html',
        routine_programs: 'routine-programs.html',
        student_list: 'student-list.html',
        student_profile: 'student-profile.html',
        wellbeing: 'wellbeing-check.html',
        workout: 'workout-session.html',
        gym_setting: 'gym-setting.html'
      }
    }
  },
  server: {
    port: 3000,
    open: false
  }
});
