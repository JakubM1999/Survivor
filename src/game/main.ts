import { Game as MainGame } from './scenes/Game';
import { AUTO, Game, Types, WEBGL } from 'phaser';

//  Find out more information about the Game Config at:
//  https://newdocs.phaser.io/docs/3.70.0/Phaser.Types.Core.GameConfig
const config: Types.Core.GameConfig = {
    type: WEBGL, // Use WebGL for 3D capabilities
    width: window.innerWidth,
    height: window.innerHeight,
    parent: 'game-container',
    backgroundColor: '#1a1a1a',
    scene: [
        MainGame
    ],
    physics: {
        default: 'arcade', // This enables the arcade physics system
        arcade: {
            debug: false // Change to true to see physics bodies for debugging
        }
    },
    scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    render: {
        pixelArt: true, // Enable pixel art mode for crisp sprites
        antialias: false
    }
};

const StartGame = (parent: string) => {
    return new Game({ ...config, parent });
}

export default StartGame;

