import { Scene } from 'phaser';
import { EventBus } from '../EventBus';

export class Game extends Scene
{
    player: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
    constructor ()
    {
        super('Game');
    }

    preload ()
    {
        this.load.setPath('assets');

        this.load.spritesheet("player", "1.png", {
            frameWidth: 90,
            frameHeight: 300
            
        });
    }

    create ()
    {
        // Create the background and other assets

        // Create player animations
        this.anims.create({
            key: 'walk',
            frames: this.anims.generateFrameNumbers('player', { start: 4, end: 22 }),
            frameRate: 15,
            repeat: Infinity
        });
        
        // Create the player sprite only once in create
        this.player = this.physics.add.sprite(512, 340, "player");
        this.player.play('walk'); // Start the walk animation

        // EventBus emit for scene readiness
        EventBus.emit('current-scene-ready', this);
        console.log(this.textures.exists('player')); // Should return true if the texture is loaded

    }

    update() {
        // Update player actions, movement, etc. here if necessary
        // For example, handle player input or other game logic
    }
}
