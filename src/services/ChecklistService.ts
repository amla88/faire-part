import Phaser from "phaser";
import { supabase } from "./supabaseClient";

interface Objective {
  id: number;
  title: string;
  done: boolean;
}

interface User {
  id: string;
}

class ChecklistService {
  scene: Phaser.Scene;
  user: User | null;
  checklistText: Phaser.GameObjects.Text | null;
  objectives: Objective[];
  visible: boolean;

  constructor(scene: Phaser.Scene, user: User | null) {
    this.scene = scene;
    this.user = user;

    this.checklistText = null;
    this.objectives = [];
    this.visible = true;

    this.createUI();
    this.loadObjectives();
  }

  createUI() {
    this.checklistText = this.scene.add
      .text(10, 10, "Checklist:", {
        font: "16px monospace",
        color: "#ffffff",
        padding: { x: 10, y: 10 },
        backgroundColor: "#000000",
      })
      .setScrollFactor(0)
      .setDepth(20);
  }

  toggleUI(visible: boolean) {
    this.visible = visible;
    if (this.checklistText) this.checklistText.setVisible(visible);
  }

  async loadObjectives() {
    if (!this.user) return;

    const { data, error } = await supabase
      .from("objectifs")
      .select("*")
      .eq("user_id", this.user.id);

    if (error) {
      console.error("Erreur récupération objectifs:", error);
      return;
    }

    this.objectives = (data as any[]).map((obj) => ({
      id: obj.id,
      title: obj.title,
      done: obj.done,
    }));

    this.render();
  }

  markDone(id: number, done = true) {
    const obj = this.objectives.find((o) => o.id === id);
    if (!obj) return;

    obj.done = done;

    supabase
      .from("objectifs")
      .update({ done })
      .eq("id", id)
      .then(({ error }) => {
        if (error) console.error("Erreur update objectif:", error);
      });

    this.render();
  }

  render() {
    if (!this.checklistText) return;

    let text = "Checklist:\n";
    this.objectives.forEach((obj) => {
      text += obj.done ? `- [x] ${obj.title}\n` : `- [ ] ${obj.title}\n`;
    });

    this.checklistText.setText(text);
  }

  addObjective(title: string) {
    const id = Date.now();
    this.objectives.push({ id, title, done: false });
    this.render();
  }
}

export default ChecklistService;
