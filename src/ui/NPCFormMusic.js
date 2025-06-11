export default class NPCForm {
  constructor(scene, supabase, onClose = () => {}) {
    this.scene = scene;
    this.supabase = supabase;
    this.onClose = onClose;
    this.createForm();
  }

  createForm() {
    this.container = document.createElement('div');
    this.container.id = 'npc-form';
    this.container.style.position = 'absolute';
    this.container.style.top = '50%';
    this.container.style.left = '50%';
    this.container.style.transform = 'translate(-50%, -50%)';
    this.container.style.background = '#111';
    this.container.style.padding = '20px';
    this.container.style.border = '2px solid #fff';
    this.container.style.color = '#fff';
    this.container.style.zIndex = '1000';
    this.container.style.display = 'none';
    this.container.style.width = '300px';

    this.container.innerHTML = `
      <div style="font-family: monospace;">
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

    this.container.querySelector('form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      const data = Object.fromEntries(formData.entries());
      const { error } = await this.supabase.from('music_preferences').insert([{ ...data }]);
      if (error) {
        alert('Erreur lors de l\'envoi : ' + error.message);
      } else {
        alert('Merci pour ta contribution !');
        this.hide();
      }
    });

    this.container.querySelector('#close-npc-form').addEventListener('click', () => {
      this.hide();
    });
  }

  show() {
    this.container.style.display = 'block';
  }

  hide() {
    this.container.style.display = 'none';
    this.onClose();
  }
}