import supabaseService from "../services/supabaseService.js";
import { supabase } from "../services/supabaseClient";
import env from "../environment";

export default class LoginScene extends Phaser.Scene {
  constructor() {
    super({ key: "LoginScene" });
  }

  preload() {
    this.load.html("loginForm", env.basePath + "assets/login-form.html");
    this.load.image('bg', env.basePath + "assets/backgrounds/mainbg.png");
  }

  async create() {
    console.log("Base path = ", env.basePath);
    this.add.image(0, 0, 'bg').setOrigin(0, 0);
    // Fonction pour obtenir l'UUID depuis l'URL
    const uuid = this.getUUIDFromURL();

    // Si un UUID est présent, tenter de se connecter
    if (uuid) {
      const error = await this.connexionClassique(uuid);
      this.chargerFormulaireDeConnexionClassique(error);
    } else {
      this.chargerFormulaireDeConnexionAdmin();
    }
  }

  getClient() {
    return supabaseService.getClient();
  }

  async connexionClassique(uuid) {
    let error = null;
    try {
      // Pas besoin d'email/password pour les invités
      const { data, error: userError } = await supabase
        .from("users")
        .select("*")
        .eq("login_token", uuid)
        .maybeSingle();
      if (userError || !data) {
        error = "Aucun utilisateur trouvé avec ce lien";
      } else {
        await supabaseService.loadUser(data.auth_uuid);
        if (supabaseService.getUser()) {
          this.scene.start("MainScene");
          return;
        } else {
          error = "Utilisateur non trouvé";
        }
      }
    } catch (err) {
      error = "Erreur de connexion";
    }
    return error;
  }

  async connexionAdmin(email, password) {
    let error = null;
    try {
      const user = await supabaseService.signIn(email, password);
      if (user) {
        await supabaseService.loadUser(user.id);
        if (supabaseService.getUser()?.is_admin) {
          // Redirige vers l’interface admin
          window.location.href = "/?admin=true";
          return;
        } else {
          error = "Ce compte n'est pas administrateur";
        }
      } else {
        error = "Échec de la connexion admin";
      }
    } catch (err) {
      console.error("Erreur dans signIn :", err);
      error = "Erreur de connexion admin";
    }
    return error;
  }

  chargerFormulaireDeConnexionClassique(error) {
    // Charger le HTML dans le DOM
    const dom = this.add
      .dom(this.cameras.main.centerX, this.cameras.main.centerY)
      .createFromCache("loginForm");

    dom.getChildByName("email").remove();
    dom.getChildByName("password").remove();
    // Ajoute erreur de login
    this.setError(dom, error);

    // Gérer l’événement de clic
    dom.addListener("click");
    dom.on("click", async (event) => {
      if (event.target.name === "loginButton") {
        const uuid = dom.getChildByName("uuid").value;
        const error = await this.connexionClassique(uuid);
        this.setError(dom, error);
      }
    });
  }

  chargerFormulaireDeConnexionAdmin() {
    // Charger le HTML dans le DOM
    const dom = this.add
      .dom(this.cameras.main.centerX, this.cameras.main.centerY)
      .createFromCache("loginForm");

    dom.getChildByName("uuid").remove();

    // Gérer l’événement de clic
    dom.addListener("click");
    dom.on("click", async (event) => {
      if (event.target.name === "loginButton") {
        const email = dom.getChildByName("email").value;
        const password = dom.getChildByName("password").value;

        const error = await this.connexionAdmin(email, password);
        this.setError(dom, error);
      }
    });
  }

  setError(dom, error) {
    const errorEl = dom.node.querySelector(".error");
    if (error) {
      errorEl.textContent = error;
    } else {
      errorEl.textContent = "";
      this.scene.start("MainScene"); // Change la scène si succès
    }
  }

  getUUIDFromURL() {
    const params = new URLSearchParams(window.location.search);
    return params.get("uuid");
  }

  async logout() {
    try {
      const { error } = await supabaseService.signOut();
      if (error) {
        console.error("Erreur lors du logout :", error);
      } else {
        console.log("Déconnexion réussie");
      }
    } catch (err) {
      console.error("Erreur inattendue pendant le logout :", err);
    }

    // Recharge la scène de login après déconnexion
    this.scene.start("LoginScene");
  }
}
