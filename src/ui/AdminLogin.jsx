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

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setErrorMsg(error.message);
      return;
    }

    // On attend explicitement que la session soit bien propagée
    let attempts = 0;
    let maxAttempts = 10;
    let delay = 100; // ms

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
    <div style={{ maxWidth: 400, margin: "auto", padding: 24, background: "#222", color: "#fff", borderRadius: 8 }}>
      <h2>Connexion Admin</h2>
      <form onSubmit={handleLogin}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{ width: "100%", marginBottom: 12, padding: 8 }}
        />
        <input
          type="password"
          placeholder="Mot de passe"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={{ width: "100%", marginBottom: 12, padding: 8 }}
        />
        <button type="submit" style={{ width: "100%", padding: 10 }}>
          Se connecter
        </button>
        {errorMsg && <p style={{ color: "red" }}>{errorMsg}</p>}
      </form>
    </div>
  );
}