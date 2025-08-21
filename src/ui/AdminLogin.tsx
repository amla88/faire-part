// AdminLogin.tsx
import React, { useState } from "react";
import { supabase } from "../services/supabaseClient";
import { useNavigate } from "react-router-dom";

export default function AdminLogin() {
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const navigate = useNavigate();

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMsg("");

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setErrorMsg(error.message);
      return;
    }

    // On attend explicitement que la session soit bien propagée
    let attempts = 0;
    const maxAttempts = 10;
    const delay = 100; // ms

    while (attempts < maxAttempts) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        navigate("/admin-panel");
        return;
      }
      await new Promise((res) => setTimeout(res, delay));
      attempts++;
    }

    // Si toujours pas de user, afficher un msg
    setErrorMsg("Session non initialisée, veuillez réessayer.");
  }

  return (
    <div className="page">
      <div className="card">
        <h2 className="title">Connexion administrateur</h2>
        <p className="subtitle">Espace réservé aux organisateurs.</p>

        <form onSubmit={handleLogin}>
          <label className="label" htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            placeholder="nom@exemple.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="input"
          />

          <label className="label mt-12" htmlFor="password">Mot de passe</label>
          <input
            id="password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="input"
          />

          <button type="submit" className="btn btn-primary w-100 mt-16">Se connecter</button>
          {errorMsg && <div className="alert alert-error mt-12">{errorMsg}</div>}
        </form>
      </div>
    </div>
  );
}
