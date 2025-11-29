import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import StudentChat from './pages/StudentChat';
import TeacherDashboard from './pages/TeacherDashboard';
import StudentSubjects from './pages/StudentSubjects';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/student" element={<StudentSubjects />} />
        <Route path="/student/chat" element={<StudentChat />} />
        <Route path="/teacher" element={<TeacherDashboard />} />
      </Routes>
    </Router>
  );
}

export default App;
