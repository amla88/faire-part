import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

interface LocationState {
  error?: string | null;
}

export default function PublicLogin() {
  const [code, setCode] = useState<string>("");
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as LocationState | null;
  const incomingError = state?.error || null;

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
  const trimmed = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!trimmed) return;
    navigate(`/game?uuid=${encodeURIComponent(trimmed)}`);
  };

  return (
    <div className="page">
      <div className="card">
        <h1 className="title">Accès au faire-part</h1>
        <p className="subtitle">Entrez votre code personnel pour accéder au jeu.</p>

        {incomingError && <div className="alert alert-error">{incomingError}</div>}

        <form onSubmit={onSubmit}>
          <label htmlFor="code" className="label">Code personnel</label>
          <input
            id="code"
            type="text"
            placeholder="Ex: UOQ612TC"
            value={code}
            onChange={(e) => {
              const v = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
              setCode(v);
            }}
            autoFocus
            className="input"
          />
          <button type="submit" className="btn btn-primary w-100 mt-12">Valider</button>
        </form>
      </div>
    </div>
  );
}
