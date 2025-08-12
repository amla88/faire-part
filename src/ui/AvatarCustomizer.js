import { upsertAvatar } from '../services/avatarService.js';
import { supabase } from "../services/supabaseClient";


export default class AvatarCustomizer {
  constructor(personne_id) {
    this.supabase = supabase;
    this.personne_id = personne_id;
    this.container = null;
  }

  show() {
    if (this.container) this.container.remove();
    this.container = document.createElement('div');
    this.container.id = 'avatar-customizer';
    Object.assign(this.container.style, {
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      background: '#222',
      color: '#fff',
      padding: '24px',
      border: '2px solid #fff',
      borderRadius: '8px',
      zIndex: '1001',
      width: '340px',
      fontFamily: 'monospace'
    });

    this.container.innerHTML = `
      <h3>Personnalise ton avatar</h3>
      <form id="avatar-form">
        <label>Couleur de peau:
          <select name="couleur_peau">
            <option value="1">Clair</option>
            <option value="2">Moyen</option>
            <option value="3">Foncé</option>
          </select>
        </label><br><br>
        <label>Couleur de cheveux:
          <select name="couleur_cheveu">
            <option value="1">Blond</option>
            <option value="2">Châtain</option>
            <option value="3">Brun</option>
            <option value="4">Noir</option>
            <option value="5">Roux</option>
          </select>
        </label><br><br>
        <label>Forme de cheveux:
          <select name="forme_cheveu">
            <option value="1">Court</option>
            <option value="2">Long</option>
            <option value="3">Bouclé</option>
            <option value="4">Raide</option>
          </select>
        </label><br><br>
        <label>Accessoire:
          <select name="accessoire">
            <option value="">Aucun</option>
            <option value="1">Lunettes</option>
            <option value="2">Boucles d'oreilles</option>
            <option value="3">Collier</option>
          </select>
        </label><br><br>
        <label>Pilosité:
          <select name="pilosite">
            <option value="">Aucune</option>
            <option value="1">Barbe</option>
            <option value="2">Moustache</option>
            <option value="3">Boucs</option>
          </select>
        </label><br><br>
        <label>Chapeau:
          <select name="chapeau">
            <option value="">Aucun</option>
            <option value="1">Casquette</option>
            <option value="2">Chapeau</option>
            <option value="3">Béret</option>
          </select>
        </label><br><br>
        <button type="submit">Enregistrer</button>
        <button type="button" id="close-avatar-customizer">Annuler</button>
      </form>
    `;

    document.body.appendChild(this.container);

    document.getElementById('close-avatar-customizer').onclick = () => {
      this.container.remove();
    };

    document.getElementById('avatar-form').onsubmit = async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      const data = Object.fromEntries(formData.entries());
      Object.keys(data).forEach(k => { if (data[k] === "") data[k] = null; });
      const { error } = await upsertAvatar(this.personne_id, data);
      if (error) {
        alert('Erreur lors de la sauvegarde : ' + error.message);
      } else {
        alert('Avatar enregistré !');
        this.container.remove();
      }
    };
  }
}