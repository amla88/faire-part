import Phaser from 'phaser';

export default class ChecklistService {
  constructor(private scene: Phaser.Scene, private user: any) {}
  markDone(objectiveId: number) {
    // TODO: wire with Supabase if needed later
    console.log('Objective done:', objectiveId);
  }
}
