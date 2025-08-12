// src/App.jsx
import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import AdminLogin from "./ui/AdminLogin";
import AdminPanel from "./ui/AdminPanel";
import Game from "./Game";

export default function App() {
  return (
    <Router basename="/faire-part">
      <Routes>
        <Route path="/admin-login" element={<AdminLogin />} />
        <Route path="/admin-panel" element={<AdminPanel />} />
        <Route path="/game" element={<Game />} />
        {/* redirige racine vers /game */}
        <Route path="/" element={<Navigate to="/game" replace />} />
        <Route path="*" element={<Navigate to="/game" replace />} />
      </Routes>
    </Router>
  );
}
