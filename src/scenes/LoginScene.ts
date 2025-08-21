import Phaser from "phaser";
import supabaseService from "../services/supabaseService";
import { supabase } from "../services/supabaseClient";
import env from "../environment";

export default class LoginScene extends Phaser.Scene {
  constructor() {
    super({ key: "LoginScene" });
  }

  preload() {
    this.load.html("loginForm", env.basePath + "assets/login-form.html");
    this.load.image("bg", env.basePath + "assets/backgrounds/mainbg.png");
  }

  async create() {
    this.add.image(0, 0, "bg").setOrigin(0, 0);
    const uuid = this.getUUIDFromURL();

    if (uuid) {
      const error = await this.connexionClassique(uuid);
      this.showClassicLoginForm(error);
    } else {
      this.showAdminLoginForm();
    }
  }

  private async connexionClassique(uuid: string): Promise<string | null> {
    try {
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("login_token", uuid)
        .maybeSingle();

      if (error || !data) return "Aucun utilisateur trouvé avec ce lien";

      await supabaseService.loadUser(data.auth_uuid);

      if (!supabaseService.getUser()) return "Utilisateur non trouvé";

      this.scene.start("MainScene");
      return null;
    } catch {
      return "Erreur de connexion";
    }
  }

  private async connexionAdmin(email: string, password: string): Promise<string | null> {
    try {
      const user = await supabaseService.signIn(email, password);
      if (!user) return "Échec de la connexion admin";

      await supabaseService.loadUser(user.id);
      if (!supabaseService.getUser()?.is_admin) return "Ce compte n'est pas administrateur";

      window.location.href = "/?admin=true";
      return null;
    } catch (err) {
      console.error("Erreur dans signIn :", err);
      return "Erreur de connexion admin";
    }
  }

  private showClassicLoginForm(error: string | null) {
    const dom = this.add
      .dom(this.cameras.main.centerX, this.cameras.main.centerY)
      .createFromCache("loginForm");

    dom.getChildByName("email")?.remove();
    dom.getChildByName("password")?.remove();

    this.setError(dom, error);

    dom.addListener("click");
    dom.on("click", async (event: any) => {
      if (event.target.name === "loginButton") {
        const uuid = (dom.getChildByName("uuid") as HTMLInputElement).value;
        const err = await this.connexionClassique(uuid);
        this.setError(dom, err);
      }
    });
  }

  private showAdminLoginForm() {
    const dom = this.add
      .dom(this.cameras.main.centerX, this.cameras.main.centerY)
      .createFromCache("loginForm");

    dom.getChildByName("uuid")?.remove();

    dom.addListener("click");
    dom.on("click", async (event: any) => {
      if (event.target.name === "loginButton") {
        const email = (dom.getChildByName("email") as HTMLInputElement).value;
        const password = (dom.getChildByName("password") as HTMLInputElement).value;

        const error = await this.connexionAdmin(email, password);
        this.setError(dom, error);
      }
    });
  }

  private setError(dom: Phaser.GameObjects.DOMElement, error: string | null) {
    const errorEl = dom.node.querySelector(".error");
    if (!errorEl) return;

    if (error) {
      errorEl.textContent = error;
    } else {
      errorEl.textContent = "";
      this.scene.start("MainScene");
    }
  }

  private getUUIDFromURL(): string | null {
    const params = new URLSearchParams(window.location.search);
    return params.get("uuid");
  }

  public async logout() {
    try {
      const { error } = await supabaseService.signOut();
      if (error) console.error("Erreur lors du logout :", error);
      else console.log("Déconnexion réussie");
    } catch (err) {
      console.error("Erreur inattendue pendant le logout :", err);
    }
    this.scene.start("LoginScene");
  }
}
