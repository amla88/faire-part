import React, { useState } from "react";
import { Table, Button, Badge, Modal } from "react-bootstrap";

interface Personne {
  id?: number;
  nom: string;
  prenom: string;
}

interface User {
  id: number;
  login_token: string;
  personnes?: Personne[];
}

interface UserListProps {
  users: User[];
  onUserIdClick?: (userId: number) => void;
  onPersonClick?: (personId: number) => void;
  onTokenClick?: (token: string) => void;
  onDeleteUser: (userId: string) => void;
}

export default function UserList({
  users,
  onTokenClick,
  onDeleteUser,
}: UserListProps) {
  const [showModal, setShowModal] = useState(false);
  const [toDeleteId, setToDeleteId] = useState<string | null>(null);

  function handleAskDelete(userId: string) {
    setToDeleteId(userId);
    setShowModal(true);
  }

  function handleCancel() {
    setShowModal(false);
    setToDeleteId(null);
  }

  function handleConfirmDelete() {
    if (toDeleteId) {
      onDeleteUser(toDeleteId);
      setShowModal(false);
      setToDeleteId(null);
    }
  }

  return (
    <>
      <Table striped bordered hover responsive="md" className="align-middle">
        <thead>
          <tr>
            <th>ID</th>
            <th>Personnes associées</th>
            <th>Token d’accès</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id}>
              <td>
                <Button
                  variant="link"
                  onClick={() =>
                    window.open(
                      `/faire-part/admin-panel/user/${user.id}`,
                      "_blank",
                      "noopener"
                    )
                  }
                  style={{ fontWeight: 600 }}
                >
                  {user.id}
                </Button>
              </td>
              <td>
                {user.personnes && user.personnes.length > 0 ? (
                  user.personnes.map((p) => (
                    <div key={(p.id ?? p.nom) + (p.prenom || "") } style={{ display: 'inline-flex', gap: 6, alignItems: 'center', marginRight: 8, marginBottom: 6 }}>
                      <Badge
                        bg="secondary"
                        pill
                        style={{ cursor: "pointer", fontSize: "1em" }}
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(
                            `/faire-part/admin-panel/user/${user.id}`,
                            "_blank",
                            "noopener"
                          );
                        }}
                      >
                        {p.prenom} {p.nom}
                      </Badge>
                      <Button
                        variant="outline-secondary"
                        size="sm"
                        title="Éditer l'avatar"
                        onClick={(e) => {
                          e.stopPropagation();
                          const base = (import.meta as any)?.env?.BASE_URL || "/";
                          const uuid = encodeURIComponent(user.login_token);
                          const pid = encodeURIComponent(String(p.id ?? ""));
                          const url = `${window.location.origin}${base}avatar?uuid=${uuid}&personne_id=${pid}`;
                          window.open(url, "_blank", "noopener");
                        }}
                      >Avatar</Button>
                    </div>
                  ))
                ) : (
                  <span style={{ color: "#aaa" }}>Aucune</span>
                )}
              </td>
              <td>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <Button
                    variant="outline-warning"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      const base = (import.meta as any)?.env?.BASE_URL || "/";
                      const url = `${window.location.origin}${base}game?uuid=${encodeURIComponent(user.login_token)}`;
                      window.open(url, "_blank", "noopener");
                    }}
                    title="Ouvrir le lien public"
                  >
                    {user.login_token}
                  </Button>
                  <Button
                    variant="outline-secondary"
                    size="sm"
                    onClick={async (e) => {
                      e.stopPropagation();
                      try {
                        const base = (import.meta as any)?.env?.BASE_URL || "/";
                        const url = `${window.location.origin}${base}game?uuid=${encodeURIComponent(user.login_token)}`;
                        await navigator.clipboard.writeText(url);
                      } catch {
                        /* ignore */
                      }
                    }}
                    title="Copier le lien public"
                  >
                    Copier
                  </Button>
                </div>
              </td>
              <td>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => handleAskDelete(user.login_token)}
                >
                  Supprimer
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
      <Modal show={showModal} onHide={handleCancel} centered>
        <Modal.Header closeButton>
          <Modal.Title>Supprimer l'utilisateur</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          Cette action supprimera l'utilisateur <b>et toutes ses personnes associées</b>.<br />
          Êtes-vous sûr(e) ?
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleCancel}>
            Annuler
          </Button>
          <Button variant="danger" onClick={handleConfirmDelete}>
            Oui, supprimer
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}
