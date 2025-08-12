import Phaser from "phaser";
import MainScene from "./scenes/MainScene.js";
import LoginScene from "./scenes/LoginScene.js";
import AdminPanel from "./ui/AdminPanel.jsx";
import React from "react";
import ReactDOM from "react-dom/client";

const config = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  backgroundColor: "#2d3436",
  parent: "game",
  scene: [LoginScene, MainScene],
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

new Phaser.Game(config);

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AdminPanel />
    {/* Tu peux ajouter ici ton jeu Phaser ou une logique de routage */}
  </React.StrictMode>
);
