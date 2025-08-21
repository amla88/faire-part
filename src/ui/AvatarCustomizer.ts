// NPCFormMusic.ts
import { SupabaseClient } from '@supabase/supabase-js';

interface MusicPreference {
  artist1: string;
  title1: string;
  link1: string;
  comment1: string;
  artist2: string;
  title2: string;
  link2: string;
  comment2: string;
}

export default class NPCForm {
  private scene: any;
  private supabase: SupabaseClient;
  private onClose: () => void;
  private container: HTMLDivElement | null = null;

  constructor(scene: any, supabase: SupabaseClient, onClose: () => void = () => {}) {
    this.scene = scene;
    this.supabase = supabase;
    this.onClose = onClose;
    this.createForm();
  }

  private createForm() {
    this.container = document.createElement('div');
    this.container.id = 'npc-form';
    Object.assign(this.container.style, {
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      background: '#111',
      padding: '20px',
      border: '2px solid #fff',
      color: '#fff',
      zIndex: '1000',
      display: 'none',
      width: '300px',
      fontFamily: 'monospace'
    });

    this.container.innerHTML = `
      <div>
        <h3>Dialogue avec le PNJ</h3>
        <p>Partage deux de tes musiques préférées :</p>
        <form>
          <div><label>Artiste 1:<br><input type="text" name="artist1"></label></div>
          <div><label>Titre 1:<br><input type="text" name="title1"></label></div>
          <div><label>Lien 1:<br><input type="url" name="link1"></label></div>
          <div><label>Commentaire 1:<br><textarea name="comment1"></textarea></label></div>
          <hr>
          <div><label>Artiste 2:<br><input type="text" name="artist2"></label></div>
          <div><label>Titre 2:<br><input type="text" name="title2"></label></div>
          <div><label>Lien 2:<br><input type="url" name="link2"></label></div>
          <div><label>Commentaire 2:<br><textarea name="comment2"></textarea></label></div>
          <div style="margin-top:10px;">
            <button type="submit">Envoyer</button>
            <button type="button" id="close-npc-form">Fermer</button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(this.container);

    const form = this.container.querySelector('form')!;
    form.addEventListener('submit', async (e: Event) => {
      e.preventDefault();
      const target = e.target as HTMLFormElement;
      const formData = new FormData(target);
      const data: MusicPreference = Object.fromEntries(formData.entries()) as MusicPreference;

      const { error } = await this.supabase.from('music_preferences').insert([data]);
      if (error) {
        alert('Erreur lors de l\'envoi : ' + error.message);
      } else {
        alert('Merci pour ta contribution !');
        this.hide();
      }
    });

    const closeBtn = this.container.querySelector('#close-npc-form') as HTMLButtonElement;
    closeBtn.addEventListener('click', () => this.hide());
  }

  show() {
    if (this.container) this.container.style.display = 'block';
  }

  hide() {
    if (this.container) {
      this.container.style.display = 'none';
      this.onClose();
    }
  }
}
