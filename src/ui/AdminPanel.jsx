import React, { useState } from "react";
import QRCode from "react-qr-code";
import { supabase } from "../services/supabaseClient";
import { generateLoginToken } from "../utils/token";

export default function AdminPanel() {
  const [qr, setQr] = useState("");
  const [link, setLink] = useState("");
  const [nom, setNom] = useState("");
  const [prenom, setPrenom] = useState("");

  async function handleAddUser() {
    const token = generateLoginToken();

    // Récupère l'utilisateur actuellement connecté
    const { data: { user: currentUser }, error: userError } = await supabase.auth.getUser();
    if (userError || !currentUser) {
      alert("Vous devez être connecté pour créer un utilisateur.");
      return;
    }

    // Ajoute l'id de l'utilisateur connecté dans la nouvelle ligne
    const { data, error } = await supabase
      .from("users")
      .insert({ login_token: token, created_by: currentUser.id }) // Ajoute created_by
      .select()
      .single();

    if (error) return alert(error.message);

    await supabase.from("personnes").insert({
      nom,
      prenom,
      user_id: data.id,
      created_by: currentUser.id // Optionnel si tu veux aussi dans cette table
    });

    const loginLink = `${window.location.origin}/?uuid=${token}`;
    setLink(loginLink);
    setQr(loginLink);
  }

  return (
    <div style={{ background: "#222", color: "#fff", padding: 24, borderRadius: 8 }}>
      <h2>Ajouter un utilisateur</h2>
      <input placeholder="Nom" value={nom} onChange={e => setNom(e.target.value)} />
      <input placeholder="Prénom" value={prenom} onChange={e => setPrenom(e.target.value)} />
      <button onClick={handleAddUser}>Créer et générer QR/lien</button>
      {qr && (
        <div>
          <p>Lien unique : <a href={link}>{link}</a></p>
          <QRCode value={qr} />
        </div>
      )}
    </div>
  );
}