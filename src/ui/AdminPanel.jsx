// src/ui/AdminPanel.jsx
import React, { useState, useEffect } from "react";
import QRCode from "react-qr-code";
import { supabase } from "../services/supabaseClient";
import { generateLoginToken } from "../utils/token";

export default function AdminPanel() {
  const [qr, setQr] = useState("");
  const [link, setLink] = useState("");
  const [nom, setNom] = useState("");
  const [prenom, setPrenom] = useState("");
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    async function checkRole() {
      const { data: { user }, error } = await supabase.auth.getUser();

      if (error || !user) {
        window.location.href = "/admin-login";
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (profileError || !profile) {
        alert("Impossible de vérifier le rôle.");
        window.location.href = "/";
        return;
      }

      if (profile.role === "admin") {
        setIsAdmin(true);
      } else {
        alert("Accès refusé : vous n'êtes pas administrateur.");
        window.location.href = "/";
      }
      setLoading(false);
    }

    checkRole();
  }, []);

  async function handleAddUser() {
    const token = generateLoginToken();

    const { data: { user: currentUser }, error: userError } = await supabase.auth.getUser();
    if (userError || !currentUser) {
      alert("Vous devez être connecté pour créer un utilisateur.");
      return;
    }

    const { data, error } = await supabase
      .from("users")
      .insert({ login_token: token, created_by: currentUser.id })
      .select()
      .single();

    if (error) return alert(error.message);

    await supabase.from("personnes").insert({
      nom,
      prenom,
      user_id: data.id,
      created_by: currentUser.id
    });

    // <-- lien vers /game (change ici)
    const loginLink = `${window.location.origin}/game?uuid=${token}`;
    setLink(loginLink);
    setQr(loginLink);
  }

  if (loading) {
    return <p style={{ color: "#fff" }}>Vérification en cours...</p>;
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div style={{ background: "#222", color: "#fff", padding: 24, borderRadius: 8 }}>
      <h2>Ajouter un utilisateur</h2>
      <input placeholder="Nom" value={nom} onChange={e => setNom(e.target.value)} />
      <input placeholder="Prénom" value={prenom} onChange={e => setPrenom(e.target.value)} />
      <button onClick={handleAddUser}>Créer et générer QR/lien</button>
      {qr && (
        <div>
          <p>Lien unique : <a href={link}>{link}</a></p>
          <QRCode value={qr} />
        </div>
      )}
    </div>
  );
}
