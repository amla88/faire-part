import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../services/supabaseClient";
import { Card, ListGroup, Spinner } from "react-bootstrap";

interface Personne {
  nom: string;
  prenom: string;
}

interface User {
  id: string;
  login_token: string;
  personnes?: Personne[];
}

export default function UserDetail() {
  const { id } = useParams<{ id: string }>();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!id) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from<User>("users")
        .select(`
          id,
          login_token,
          personnes:personnes!personnes_user_id_fkey(nom, prenom)
        `)
        .eq("id", id)
        .single();

      if (error) {
        console.error("Erreur Supabase:", error);
        setUser(null);
      } else {
        setUser(data);
      }
      setLoading(false);
    })();
  }, [id]);

  if (loading) return <Spinner variant="primary" className="mt-5" />;

  if (!user)
    return (
      <Card className="mt-4">
        <Card.Body>
          <b>Utilisateur introuvable</b>
        </Card.Body>
      </Card>
    );

  return (
    <Card className="mt-4">
      <Card.Body>
        <Card.Title>Détail utilisateur {user.id}</Card.Title>
        <Card.Text>
          <b>Token</b> : <code>{user.login_token}</code>
        </Card.Text>
        <Card.Subtitle className="mb-2 text-muted">Personnes associées :</Card.Subtitle>
        <ListGroup>
          {user.personnes && user.personnes.length > 0
            ? user.personnes.map((p, i) => (
                <ListGroup.Item key={i}>
                  {p.prenom} {p.nom}
                </ListGroup.Item>
              ))
            : <ListGroup.Item>Aucune</ListGroup.Item>
          }
        </ListGroup>
      </Card.Body>
    </Card>
  );
}
