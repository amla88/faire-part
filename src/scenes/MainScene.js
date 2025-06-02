import supabaseService from "../services/supabaseService.js";

export default class MainScene extends Phaser.Scene {
  constructor() {
    super("MainScene");
    this.auth = null;
    this.user = null;
  }

  async create() {
    /*
    this.add.text(50, 50, "Phaser + Supabase", {
      font: "24px Arial",
      fill: "#fff",
    });

    this.loadButton = this.add
      .text(50, 100, "🔄 Charger sauvegarde", {
        font: "20px Arial",
        fill: "#00f",
      })
      .setInteractive()
      .on("pointerdown", () => this.loadSave());

    this.saveButton = this.add
      .text(50, 150, "💾 Sauvegarder", { font: "20px Arial", fill: "#0f0" })
      .setInteractive()
      .on("pointerdown", () => this.saveGame());
  }

  async connectToDB() {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: "test@test.com",
      password: "test",
    });

    if (error || !data.user) {
      console.error("Erreur d'authentification :", error.message);
    } else {
      this.auth = data.user;
      this.loadUser();
    }*/
  }

  

  async saveGame() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    console.log("Utilisateur connecté:", user);
    const response = await supabase
      .from("users")
      .update({ connect: true, connexion: new Date() })
      .eq("id", this.user.id);

    if (response.error) {
      console.error("Erreur sauvegarde:", response.error);
    } else {
      console.log("✅ Sauvegarde réussie !", response.data);
    }
  }

  async loadSave() {
    const { username } = this.saveData;

    const { data, error } = await supabase
      .from("saves")
      .select("*")
      .eq("username", username)
      .maybeSingle();

    if (error) {
      console.error("Erreur chargement :", error);
    } else if (data) {
      this.saveData = { ...this.saveData, ...data };
      console.log("✅ Sauvegarde chargée :", this.saveData);
      this.add.text(
        50,
        200,
        `Joueur: ${data.username}, Niveau: ${data.level}`,
        {
          font: "18px Arial",
          fill: "#fff",
        }
      );
    } else {
      console.log("📭 Aucune sauvegarde trouvée.");
    }
  }
}
