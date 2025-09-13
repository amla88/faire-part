// src/Game.tsx
import React, { useEffect, useRef, useState } from "react";
import Phaser from "phaser";
import MainScene from "./scenes/MainScene";
import supabaseService from "./services/supabaseService";
import { supabase } from "./services/supabaseClient";
import type { PersonneRow } from "./services/supabaseService";
import { useSearchParams, useNavigate, Link } from "react-router-dom";

// Typage minimal pour user et personne (adapter selon ton DB)
interface User {
  id: number;
  login_token: string;
  [key: string]: any;
}

interface Personne {
  id: number;
  nom?: string;
  prenom?: string;
  user_id: number;
  [key: string]: any;
}

const Game: React.FC = () => {
  const gameRef = useRef<Phaser.Game | null>(null);
  const [status, setStatus] = useState<string | null>("Vérification du lien...");
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;

    async function init() {
      const uuid = searchParams.get("uuid");

      if (!uuid) {
        navigate("/login", {
          replace: true,
          state: { error: "Lien invalide : aucun code personnel fourni." },
        });
        return;
      }

      setStatus("Vérification du token...");

      // 1) vérifier le token et charger l'objet user via supabaseService
      const user: User | null = await supabaseService.loadUserByLoginToken(uuid);
      if (!user) {
        navigate("/login", {
          replace: true,
          state: { error: "Code personnel invalide ou expiré." },
        });
        return;
      }

      // 2) récupérer la personne liée (si existante)
  const personne: PersonneRow | null = await supabaseService.loadPersonneByUserId(user.id);
      // Persiste le contexte pour l'éditeur d'avatar React
      try {
        if (personne?.id) {
          localStorage.setItem("personne_id", String(personne.id));
        } else {
          localStorage.removeItem("personne_id");
        }
        if (uuid) localStorage.setItem("login_uuid", uuid);
      } catch {}

      // 3) créer l'instance Phaser (si pas déjà créée)
      if (!gameRef.current) {
        setStatus("Chargement du jeu...");

        const config: Phaser.Types.Core.GameConfig = {
          type: Phaser.AUTO,
          pixelArt: true,
           width: 360,
           height: 240,
          backgroundColor: "#10141f", // neutral-900 from palette
          parent: "game",
          scene: [MainScene],
          dom: {
            createContainer: true,
          },
          scale: {
            mode: Phaser.Scale.FIT,
            autoCenter: Phaser.Scale.CENTER_BOTH,
          },
          physics: {
            default: "arcade",
            arcade: {
              gravity: { x:0, y: 0 },
              debug: false,
            },
          },
        };

        gameRef.current = new Phaser.Game(config);

        setTimeout(() => {
          try {
            if (gameRef.current?.registry) {
              gameRef.current.registry.set("personne_id", personne?.id ?? null);
              gameRef.current.registry.set("user_row", user);
            }
          } catch (err) {
            console.warn("Impossible de régler la registry Phaser :", err);
          }
        }, 50);
      }

      setStatus(null); // succès, on cache les messages
    }

    init();

    return () => {
      // cleanup : détruire le jeu si on quitte la page
      if (gameRef.current) {
        try {
          gameRef.current.destroy(true);
        } catch (e) {
          /* ignore */
        }
        gameRef.current = null;
      }
      mounted = false;
    };
  }, [searchParams, navigate]);

  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative" }}>
      <div id="game" style={{ width: "100%", height: "100%" }} />
      {status && (
        <div style={{ position: "absolute", top: 12, left: 12, color: "#fff" }}>{status}</div>
      )}
      {/* Bouton pour accéder au créateur d'avatar (préserve le uuid) */}
      <Link
        to={`/avatar?uuid=${encodeURIComponent(searchParams.get("uuid") || "")}`}
        className="admin-fab"
        style={{ right: 70 }}
      >Avatar</Link>
    </div>
  );
};

export default Game;
