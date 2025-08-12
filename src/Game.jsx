// src/Game.jsx
import React, { useEffect, useRef, useState } from "react";
import Phaser from "phaser";
import MainScene from "./scenes/MainScene.js";
import supabaseService from "./services/supabaseService.js";
import { supabase } from "./services/supabaseClient";
import { useSearchParams, useNavigate } from "react-router-dom";

export default function Game() {
  const gameRef = useRef(null);
  const [status, setStatus] = useState("Vérification du lien...");
  const [error, setError] = useState(null);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    async function init() {
      const uuid = searchParams.get("uuid");

      if (!uuid) {
        setError("Lien invalide : aucun token fourni.");
        setStatus(null);
        return;
      }

      setStatus("Vérification du token...");

      // 1) vérifier le token et charger l'objet user via supabaseService
      const user = await supabaseService.loadUserByLoginToken(uuid);
      if (!user) {
        setError("Token invalide ou expiré.");
        setStatus(null);
        return;
      }

      // 2) récupérer la personne liée (si existante)
      const { data: personne, error: personneError } = await supabase
        .from("personnes")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (personneError) {
        setError("Erreur lors de la récupération des données utilisateur.");
        setStatus(null);
        return;
      }

      // 3) créer l'instance Phaser (si pas déjà créée)
      if (!gameRef.current) {
        setStatus("Chargement du jeu...");
        const config = {
          type: Phaser.AUTO,
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

        // give Phaser a moment to initialise, then set registry values
        // (registry exists on game instance)
        // A tiny timeout ensures gameRef.current.registry exists
        setTimeout(() => {
          try {
            if (gameRef.current && gameRef.current.registry) {
              gameRef.current.registry.set("personne_id", personne ? personne.id : null);
              // stocker user aussi si besoin
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
        } catch (e) { /* ignore */ }
        gameRef.current = null;
      }
      mounted = false;
    };
  }, [searchParams, navigate]);

  return (
    <div style={{ width: "100%", height: "100%", display: "flex", justifyContent: "center", alignItems: "center" }}>
      <div id="game" style={{ width: 800, height: 600 }} />
      {status && <div style={{ position: "absolute", color: "#fff" }}>{status}</div>}
      {error && (
        <div style={{ position: "absolute", color: "red", background: "#0008", padding: 12 }}>
          <p>{error}</p>
          <button onClick={() => window.location.href = "/"}>Retour</button>
        </div>
      )}
    </div>
  );
}
