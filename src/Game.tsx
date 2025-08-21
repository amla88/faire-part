// src/Game.tsx
import React, { useEffect, useRef, useState } from "react";
import Phaser from "phaser";
import MainScene from "./scenes/MainScene";
import supabaseService from "./services/supabaseService";
import { supabase } from "./services/supabaseClient";
import { useSearchParams, useNavigate } from "react-router-dom";

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
      const { data: personne, error: personneError } = await supabase
        .from<Personne>("personnes")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (personneError) {
        navigate("/login", {
          replace: true,
          state: {
            error:
              "Erreur lors de la récupération des données utilisateur. Réessayez.",
          },
        });
        return;
      }

      // 3) créer l'instance Phaser (si pas déjà créée)
      if (!gameRef.current) {
        setStatus("Chargement du jeu...");

        const config: Phaser.Types.Core.GameConfig = {
          type: Phaser.AUTO,
          pixelArt: true,
          width: 800,
          height: 600,
          backgroundColor: "#2d3436",
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
              gravity: { y: 0 },
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
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <div id="game" style={{ width: 800, height: 600 }} />
      {status && <div style={{ position: "absolute", color: "#fff" }}>{status}</div>}
    </div>
  );
};

export default Game;
