// AddUserForm.tsx
import React, { useState } from "react";
import QRCode from "react-qr-code";
import { Alert, Button } from "react-bootstrap";

interface AddUserFormProps {
  onAddUser: (data: { nom: string; prenom: string }) => Promise<{
    id: number | string;
    loginLink: string;
    loginToken: string;
  }>;
}

interface CreatedUser {
  id: number | string;
  login_token: string;
}

export default function AddUserForm({ onAddUser }: AddUserFormProps) {
  const [nom, setNom] = useState<string>("");
  const [prenom, setPrenom] = useState<string>("");
  const [qr, setQr] = useState<string>("");
  const [link, setLink] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<boolean>(false);
  const [createdUser, setCreatedUser] = useState<CreatedUser | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!nom || !prenom) {
      setError("Nom et prénom sont obligatoires.");
      return;
    }
    setError("");
    try {
      const res = await onAddUser({ nom, prenom });

      // Vérifie les champs essentiels
      if (!res || !res.id || !res.loginLink || !res.loginToken) {
        setError("Erreur : données utilisateur incomplètes.");
        setSuccess(false);
        setCreatedUser(null);
        return;
      }

      setLink(res.loginLink);
      setQr(res.loginLink);
      setSuccess(true);
      setCreatedUser({
        id: res.id,
        login_token: res.loginToken,
      });
      setNom("");
      setPrenom("");
    } catch (e: any) {
      setError("Erreur lors de l'ajout : " + (e?.message || e));
      setSuccess(false);
      setCreatedUser(null);
    }
  }

  function resetForm() {
    setCreatedUser(null);
    setSuccess(false);
    setError("");
    setNom("");
    setPrenom("");
    setQr("");
    setLink("");
  }

  return (
    <div>
      <h2 className="mb-3">Ajouter un utilisateur</h2>
      {error && <Alert variant="warning">{error}</Alert>}
      {success && createdUser ? (
        <Alert variant="success" className="d-flex flex-column align-items-start">
          <div className="mb-2">✅ L’utilisateur a bien été ajouté&nbsp;!</div>
          <div>
            <b>ID&nbsp;:</b> {createdUser.id} <br />
            <b>Token&nbsp;:</b> {createdUser.login_token}
          </div>
          <div className="mt-2">
            <Button
              variant="success"
              size="sm"
              onClick={() =>
                window.open(
                  `/faire-part/admin-panel/user/${createdUser.id}`,
                  "_blank",
                  "noopener"
                )
              }
            >
              Voir la fiche détail
            </Button>
            <Button
              onClick={resetForm}
              variant="outline-secondary"
              size="sm"
              className="ms-3"
            >
              Ajouter un autre utilisateur
            </Button>
          </div>
          {qr && (
            <div className="mt-3 text-center w-100">
              <p>
                Lien unique&nbsp;:{" "}
                <a href={link} style={{ color: "#40128B" }}>
                  {link}
                </a>
              </p>
              <div
                style={{
                  display: "inline-block",
                  background: "#fff",
                  padding: 10,
                  borderRadius: 12,
                }}
              >
                <QRCode value={qr} />
              </div>
            </div>
          )}
        </Alert>
      ) : (
        <form onSubmit={handleSubmit}>
          <input
            placeholder="Nom"
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            style={{ marginRight: 8, padding: 4 }}
          />
          <input
            placeholder="Prénom"
            value={prenom}
            onChange={(e) => setPrenom(e.target.value)}
            style={{ marginRight: 8, padding: 4 }}
          />
          <Button type="submit" style={{ padding: "6px 12px" }}>
            Créer et générer QR/lien
          </Button>
        </form>
      )}
    </div>
  );
}
