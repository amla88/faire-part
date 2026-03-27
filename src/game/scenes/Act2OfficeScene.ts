import Phaser from 'phaser';
import { DialogueBox } from '../ui/DialogueBox';
import { FormBox } from '../ui/FormBox';
import { SceneInput } from '../systems/SceneInput';
import { quests, QuestFlags } from '../systems/QuestSystem';
import { gameBackend } from '../services/GameBackendBridge';

export class Act2OfficeScene extends Phaser.Scene {
  private inputState!: SceneInput;
  private dialogueBox!: DialogueBox;
  private formBox!: FormBox;
  private info!: Phaser.GameObjects.Text;
  private saving = false;

  constructor() {
    super('Act2OfficeScene');
  }

  create(): void {
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor('#1e1b24');
    this.add.text(18, 14, 'ACTE 2 - Office des saveurs (prototype)', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#f8e8c9',
    });

    this.inputState = new SceneInput(this);
    this.dialogueBox = new DialogueBox(this);
    this.formBox = new FormBox(this);

    this.info = this.add.text(width / 2, height / 2, 'Appuyez sur Espace/Enter (ou bouton tactile)\npour saisir vos allergènes.', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#f4dfbf',
      align: 'center',
    }).setOrigin(0.5);
  }

  override update(): void {
    const act = this.inputState.actionJustDown();
    if (this.dialogueBox.active) {
      if (act) this.dialogueBox.next();
      this.inputState.commit();
      return;
    }

    if (this.formBox.active) {
      // champs texte: on laisse la DOM box gérer la saisie.
      this.inputState.commit();
      return;
    }

    if (act && !quests.isDone(QuestFlags.act2AllergensDone)) {
      this.formBox.startTextFields({
        title: 'Santé & bien-être',
        fields: [
          { name: 'allergenes_alimentaires', label: 'Allergènes (optionnel)', placeholder: 'Noix, gluten…', multiline: true, maxLength: 2000 },
          { name: 'regimes_remarques', label: 'Remarques / régimes (optionnel)', placeholder: 'Végétarien, sans lactose…', multiline: true, maxLength: 2000 },
        ],
        onSubmit: (values) => {
          if (this.saving) return;
          this.saving = true;
          this.info.setText('Sauvegarde en cours…');
          gameBackend
            .recordRsvpForSelected({
              present_reception: false,
              present_repas: false,
              present_soiree: false,
              allergenes_alimentaires: values['allergenes_alimentaires'] || '',
              regimes_remarques: values['regimes_remarques'] || '',
            })
            .then(() => {
              quests.done(QuestFlags.act2AllergensDone);
              this.info.setText('Acte 2 validé. Passage à l’Acte 3…');
              this.time.delayedCall(600, () => this.scene.start('Act3GrangeScene'));
            })
            .catch((e) => {
              this.info.setText('Erreur: ' + String(e?.message || e));
            })
            .finally(() => {
              this.saving = false;
            });
        },
      });
    }

    this.inputState.commit();
  }
}

