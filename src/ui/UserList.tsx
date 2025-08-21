import React, { useState } from "react";
import { Table, Button, Badge, Modal } from "react-bootstrap";

interface Personne {
  id: string;
  nom: string;
  prenom: string;
}

interface User {
  id: string;
  login_token: string;
  personnes?: Personne[];
}

interface UserListProps {
  users: User[];
  onUserIdClick?: (userId: string) => void;
  onPersonClick?: (personId: string) => void;
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
                    <Badge
                      key={p.nom + p.prenom}
                      bg="secondary"
                      pill
                      style={{ marginRight: 5, cursor: "pointer", fontSize: "1em" }}
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
                  ))
                ) : (
                  <span style={{ color: "#aaa" }}>Aucune</span>
                )}
              </td>
              <td>
                <Button
                  variant="outline-warning"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onTokenClick?.(user.login_token);
                  }}
                  title="Voir la fiche publique"
                >
                  {user.login_token}
                </Button>
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
