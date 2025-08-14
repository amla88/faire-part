import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import AddUserForm from "./AddUserForm";
import UserList from "./UserList";
import { fetchUsersWithPersonnes, addUser, deleteUserCascade } from "../services/userService";
import { supabase } from "../services/supabaseClient";
import { Container, Nav, Button, Alert, Spinner } from "react-bootstrap";

export default function AdminPanel() {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [tab, setTab] = useState("add");
  const [users, setUsers] = useState([]);
  const [adminToken, setAdminToken] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    async function checkRole() {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error || !user) {
        setErrorMsg("Vous devez être connecté.");
        setTimeout(() => { navigate("/admin-login"); }, 2000);
        return;
      }
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
      if (profileError || !profile) {
        setErrorMsg("Impossible de vérifier le rôle.");
        setTimeout(() => { navigate("/"); }, 2000);
        return;
      }
      if (profile.role === "admin") {
        setIsAdmin(true);
        const { data: adminUser } = await supabase
          .from("users")
          .select("login_token")
          .eq("auth_uuid", user.id)
          .maybeSingle();
        setAdminToken(adminUser?.login_token || "");
        handleFetchUsers();
      } else {
        setErrorMsg("Accès refusé : vous n'êtes pas administrateur.");
        setTimeout(() => { navigate("/"); }, 2000);
      }
      setLoading(false);
    }
    checkRole();
    // eslint-disable-next-line
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate("/admin-login");
  }

  // ---> ICI ON RECOIT LE login_token <---
  async function handleDeleteUser(loginToken) {
    try {
      await deleteUserCascade(loginToken);
      await handleFetchUsers();
    } catch(err) {
      alert("Erreur lors de la suppression : " + (err?.message || err));
    }
  }

  async function handleFetchUsers() {
    setLoading(true);
    const { data } = await fetchUsersWithPersonnes();
    setUsers(data || []);
    setLoading(false);
  }

  async function handleAddUserToDB({ nom, prenom }) {
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    const token = Math.random().toString(36).slice(2,10).toUpperCase();
    const insertedUser = await addUser({ nom, prenom, token, createdBy: currentUser.id });
    const loginLink = `${window.location.origin}/game?token=${insertedUser.login_token}`;
    // NE PAS faire await handleFetchUsers() ici,
    // on le fera quand on repassera sur l’onglet liste ou au reset du formulaire.
    return { loginLink, id: insertedUser.id, loginToken: insertedUser.login_token };
  }

  function handleUserIdClick(userId) { navigate(`/admin-panel/user/${userId}`); }
  function handlePersonClick(userId) { navigate(`/admin-panel/user/${userId}`); }
  function handleTokenClick(token) { window.open(`/faire-part/game?token=${token}`, "_blank", "noopener"); }

  if (errorMsg) {
    return (
      <Container className="mt-5">
        <Alert variant="danger">{errorMsg} <div>Redirection en cours...</div></Alert>
      </Container>
    );
  }
  if (loading) {
    return <Container className="mt-5 text-center"><Spinner animation="border" variant="primary" /></Container>;
  }
  if (!isAdmin) return null;

  const profileLink = adminToken
    ? `${window.location.origin}/game?token=${adminToken}`
    : "#";

  return (
    <Container style={{maxWidth:900}} className="mt-5 bg-white rounded shadow p-4">
      <Nav variant="tabs" activeKey={tab} className="mb-4 align-items-center">
        <Nav.Item>
          <Nav.Link eventKey="add" onClick={() => setTab("add")}>Ajouter un utilisateur</Nav.Link>
        </Nav.Item>
        <Nav.Item>
          <Nav.Link eventKey="list" onClick={() => setTab("list")}>Liste des utilisateurs</Nav.Link>
        </Nav.Item>
        <Nav.Item>
          <Nav.Link
            href={profileLink}
            target="_blank"
            rel="noopener noreferrer"
            aria-disabled={!adminToken}
            style={{ color: !adminToken ? "#999" : undefined }}
          >Voir mon profil public</Nav.Link>
        </Nav.Item>
        <Nav.Item className="ms-auto">
          <Button variant="outline-danger" size="sm" onClick={handleLogout}>
            Se déconnecter
          </Button>
        </Nav.Item>
      </Nav>
      {tab === "add" && (
        <AddUserForm onAddUser={handleAddUserToDB} />
      )}
      {tab === "list" && (
        <UserList
          users={users}
          onUserIdClick={handleUserIdClick}
          onPersonClick={handlePersonClick}
          onTokenClick={handleTokenClick}
          // ---> Passe le login_token ici <---
          onDeleteUser={handleDeleteUser}
        />
      )}
    </Container>
  );
}