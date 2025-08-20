import React, { useState } from "react";
import { supabase } from "../services/supabaseClient";
import { useNavigate } from "react-router-dom";

export default function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const navigate = useNavigate();

  async function handleLogin(e) {
    e.preventDefault();
    setErrorMsg("");

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setErrorMsg(error.message);
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .single();

    if (profileError || profile.role !== "admin") {
      setErrorMsg("Accès refusé : vous n'êtes pas administrateur.");
      await supabase.auth.signOut();
      return;
    }

    navigate("/admin-panel");
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
