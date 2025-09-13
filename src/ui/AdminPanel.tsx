// AdminPanel.tsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import AddUserForm from "./AddUserForm";
import UserList from "./UserList";
import { fetchUsersWithPersonnes, addUser, deleteUserCascade } from "../services/UserService";
import { supabase } from "../services/supabaseClient";
import { Container, Nav, Button, Alert, Spinner } from "react-bootstrap";
import AdminAvatarAssets from "./AdminAvatarAssets";

type User = import("../services/UserService").User;

interface AddedUser {
  loginLink: string;
  id: number;
  loginToken: string;
}

export default function AdminPanel() {
  const [loading, setLoading] = useState<boolean>(true);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [tab, setTab] = useState<"add" | "list" | "assets">("add");
  const [users, setUsers] = useState<User[]>([]);
  const [adminToken, setAdminToken] = useState<string>("");
  const navigate = useNavigate();

  function withBase(path: string) {
  const base = ((import.meta as any)?.env?.BASE_URL || "/").replace(/\/$/, "");
    const normalized = path.startsWith("/") ? path : `/${path}`;
    return `${window.location.origin}${base}${normalized}`;
  }

  useEffect(() => {
    async function checkRole() {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error || !user) {
        setErrorMsg("Vous devez être connecté.");
        setLoading(false);
        setTimeout(() => navigate("/admin-login"), 2000);
        return;
      }
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
      if (profileError || !profile) {
        setErrorMsg("Impossible de vérifier le rôle.");
        setLoading(false);
        setTimeout(() => navigate("/"), 2000);
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
        await handleFetchUsers();
        return;
      }
      setErrorMsg("Accès refusé : vous n'êtes pas administrateur.");
      setLoading(false);
      setTimeout(() => navigate("/"), 2000);
    }
    checkRole();
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate("/admin-login");
  }

  async function handleDeleteUser(loginToken: string) {
    try {
      await deleteUserCascade(loginToken);
      await handleFetchUsers();
    } catch (err: any) {
      alert("Erreur lors de la suppression : " + (err?.message || err));
    }
  }

  async function handleFetchUsers() {
    setLoading(true);
  const { data } = await fetchUsersWithPersonnes();
  setUsers((data as User[]) || []);
    setLoading(false);
  }

  async function handleAddUserToDB({ nom, prenom }: { nom: string; prenom: string }): Promise<AddedUser> {
    const { data: { user: currentUser } } = await supabase.auth.getUser();

    if (!currentUser) {
      throw new Error("Session expirée. Veuillez vous reconnecter.");
    }

    const token = Math.random().toString(36).slice(2, 10).toUpperCase();
    const insertedUser = await addUser({
      nom,
      prenom,
      token,
      createdBy: currentUser.id,
    });

    const loginLink = withBase(`/game?uuid=${encodeURIComponent(insertedUser.login_token)}`);

    return {
      loginLink,
      id: insertedUser.id,
      loginToken: insertedUser.login_token,
    };
  }

  function handleUserIdClick(userId: number) {
    navigate(`/admin-panel/user/${userId}`);
  }

  function handlePersonClick(userId: number) {
    navigate(`/admin-panel/user/${userId}`);
  }

  function handleTokenClick(token: string) {
    window.open(withBase(`/game?uuid=${encodeURIComponent(token)}`), "_blank", "noopener");
  }

  if (errorMsg) {
    return (
      <Container className="mt-5">
        <Alert variant="danger">
          {errorMsg} <div>Redirection en cours...</div>
        </Alert>
      </Container>
    );
  }

  if (loading) {
    return (
      <Container className="mt-5 text-center">
        <Spinner animation="border" variant="primary" />
      </Container>
    );
  }

  if (!isAdmin) return null;

  const profileLink = adminToken
    ? withBase(`/game?uuid=${encodeURIComponent(adminToken)}`)
    : "#";

  return (
    <Container className="panel">
      <Nav variant="tabs" activeKey={tab} className="mb-4 align-items-center">
        <Nav.Item>
          <Nav.Link eventKey="add" onClick={() => setTab("add")}>
            Ajouter un utilisateur
          </Nav.Link>
        </Nav.Item>
        <Nav.Item>
          <Nav.Link eventKey="list" onClick={() => setTab("list")}>
            Liste des utilisateurs
          </Nav.Link>
        </Nav.Item>
        <Nav.Item>
          <Nav.Link eventKey="assets" onClick={() => setTab("assets")}>
            Assets Avatar
          </Nav.Link>
        </Nav.Item>
        <Nav.Item>
          <Nav.Link
            href={profileLink}
            target="_blank"
            rel="noopener noreferrer"
            disabled={!adminToken}
          >
            Voir mon profil public
          </Nav.Link>
        </Nav.Item>
        <Nav.Item className="ms-auto">
          <Button variant="outline-danger" size="sm" className="btn-ghost" onClick={handleLogout}>
            Se déconnecter
          </Button>
        </Nav.Item>
      </Nav>

      {tab === "add" && <AddUserForm onAddUser={handleAddUserToDB} />}

      {tab === "list" && (
        <UserList
          users={users}
          onUserIdClick={handleUserIdClick}
          onPersonClick={handlePersonClick}
          onTokenClick={handleTokenClick}
          onDeleteUser={handleDeleteUser}
        />
      )}

  {tab === "assets" && <AdminAvatarAssets />}
    </Container>
  );
}
