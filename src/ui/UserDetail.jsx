import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../services/supabaseClient";
import { Card, ListGroup, Spinner } from "react-bootstrap";

export default function UserDetail() {
  const { id } = useParams();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("users")
        .select(`
          id,
          login_token,
          personnes:personnes!personnes_user_id_fkey ( nom, prenom )
        `)
        .eq("id", id)
        .single();
      setUser(data);
      setLoading(false);
    })();
  }, [id]);

  if (loading) return <Spinner variant="primary" className="mt-5" />;
  if (!user) return <Card className="mt-4"><Card.Body><b>Utilisateur introuvable</b></Card.Body></Card>;

  return (
    <Card className="mt-4">
      <Card.Body>
        <Card.Title>Détail utilisateur {user.id}</Card.Title>
        <Card.Text>
          <b>Token</b> : <code>{user.login_token}</code>
        </Card.Text>
        <Card.Subtitle className="mb-2 text-muted">Personnes associées :</Card.Subtitle>
        <ListGroup>
          {user.personnes && user.personnes.length > 0
            ? user.personnes.map((p, i) =>
                <ListGroup.Item key={i}>{p.prenom} {p.nom}</ListGroup.Item>
              )
            : <ListGroup.Item>Aucune</ListGroup.Item>
          }
        </ListGroup>
      </Card.Body>
    </Card>
  );
}