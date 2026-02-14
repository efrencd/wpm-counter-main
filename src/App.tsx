import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import TeacherLoginPage from './pages/teacher/TeacherLoginPage';
import TeacherDashboardPage from './pages/teacher/TeacherDashboardPage';
import TeacherClassPage from './pages/teacher/TeacherClassPage';
import StudentLoginPage from './pages/student/StudentLoginPage';
import StudentReadingPage from './pages/student/StudentReadingPage';
import StudentResultsPage from './pages/student/StudentResultsPage';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Navigate to="/teacher/login" replace />} />
        <Route path="/teacher/login" element={<TeacherLoginPage />} />
        <Route path="/teacher" element={<TeacherDashboardPage />} />
        <Route path="/teacher/class/:id" element={<TeacherClassPage />} />
        <Route path="/student" element={<StudentLoginPage />} />
        <Route path="/student/reading" element={<StudentReadingPage />} />
        <Route path="/student/results" element={<StudentResultsPage />} />
      </Route>
    </Routes>
  );
}
