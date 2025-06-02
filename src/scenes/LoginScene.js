import supabase from "../services/supabaseService.js";
import env from '../environment';

export default class LoginScene extends Phaser.Scene {
  constructor() {
    super({ key: "LoginScene" });
  }

  preload() {
    this.load.html("loginForm", "assets/login-form.html");
  }

  async create() {
    // Fonction pour obtenir l'UUID depuis l'URL
    const uuid = this.getUUIDFromURL();

    // Si un UUID est présent, tenter de se connecter
    if (uuid) {
      try {
        const user = await supabase.signIn(env.emailUser, env.passwordUser);
        if (user) {
          this.scene.start("MainScene");
          return;
        }
      } catch (error) {
        console.error("Login failed with UUID:", error);
      }
    }

    // Charger le HTML dans le DOM
    const dom = this.add
      .dom(this.cameras.main.centerX, this.cameras.main.centerY)
      .createFromCache("loginForm");

    // Gérer l’événement de clic
    dom.addListener("click");
    dom.on("click", async (event) => {
      if (event.target.name === "loginButton") {
        const email = dom.getChildByName("email").value;
        const password = dom.getChildByName("password").value;
        const errorEl = dom.getChildByClassName("error")[0];

        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          errorEl.textContent = error.message;
        } else {
          errorEl.textContent = "";
          this.scene.start("MainScene"); // Change la scène si succès
        }
      }
    });
  }

  getUUIDFromURL() {
    const params = new URLSearchParams(window.location.search);
    return params.get("uuid");
  }
}
