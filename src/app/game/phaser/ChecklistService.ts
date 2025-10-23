import Phaser from 'phaser';

export default class ChecklistService {
  constructor(private scene: Phaser.Scene) {}
  
  markDone(objectiveId: number) {
    // Marquer l'objectif comme complété dans l'état local
  }
}
