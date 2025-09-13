import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import PublicLogin from "./ui/PublicLogin";
import AdminLogin from "./ui/AdminLogin";
import AdminPanel from "./ui/AdminPanel";
import UserDetail from "./ui/UserDetail";
import AvatarCreator from "./ui/AvatarCreator";
import Game from "./Game";
import "./ui/theme.css";

// Pas de props pour App, donc on peut typer explicitement
const App: React.FC = () => {
  return (
    <Router basename="/faire-part">
      {/* Bouton discret pour accès admin */}
      <a
        href="/faire-part/admin-login"
        className="admin-fab"
        aria-label="Accès administrateur"
        title="Accès administrateur"
      >Admin</a>
      <Routes>
        <Route path="/login" element={<PublicLogin />} />
        <Route path="/admin-login" element={<AdminLogin />} />
        <Route path="/admin-panel" element={<AdminPanel />} />
        <Route path="/admin-panel/user/:id" element={<UserDetail />} />
        <Route path="/game" element={<Game />} />
        <Route path="/avatar" element={<AvatarCreator />} />
        {/* redirige racine vers /login */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
};

export default App;
