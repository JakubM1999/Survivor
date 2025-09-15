import { Scene } from 'phaser';
import { EventBus } from '../EventBus';

export class Game extends Scene
{
    // Player properties
    playerX: number = 0;
    playerY: number = 0;
    playerAngle: number = 0;
    moveSpeed: number = 2;
    turnSpeed: number = 0.05;
    
    // Input
    cursors: Phaser.Types.Input.Keyboard.CursorKeys;
    wasd: any;
    mouseX: number = 0;
    mouseY: number = 0;
    mouseSensitivity: number = 0.002; // Increased sensitivity for better control
    pitch: number = 0; // Vertical look angle
    maxPitch: number = Math.PI; // 180 degrees up/down (full range)
    isPointerLocked: boolean = false;
    
    // 3D world properties
    mapWidth: number = 16;
    mapHeight: number = 16;
    tileSize: number = 64;
    
    // Simple map (1 = wall, 0 = empty)
    map: number[][] = [];
    
    // Rendering
    screenWidth: number;
    screenHeight: number;
    rayCount: number = 320;
    fov: number = Math.PI / 3; // 60 degrees
    maxDistance: number = 800;
    graphics: Phaser.GameObjects.Graphics;
    
    constructor ()
    {
        super('Game');
    }

    preload ()
    {
        this.load.setPath('assets');

        // Load sprites for 3D rendering
        this.load.image("wall", "1.png");
        this.load.image("floor", "bg.png");
        this.load.image("player", "characters.png");
    }

    create ()
    {
        // Get screen dimensions
        this.screenWidth = this.cameras.main.width;
        this.screenHeight = this.cameras.main.height;
        
        // Initialize player position (center of map)
        this.playerX = this.mapWidth * this.tileSize / 2;
        this.playerY = this.mapHeight * this.tileSize / 2;
        
        // Create a simple maze map
        this.generateMap();
        
        // Set up input
        this.cursors = this.input.keyboard!.createCursorKeys();
        this.wasd = this.input.keyboard!.addKeys('W,S,A,D');
        
        // Set up mouse controls
        this.input.mouse!.disableContextMenu();
        
        // Initialize mouse position
        this.mouseX = this.screenWidth / 2;
        this.mouseY = this.screenHeight / 2;
        
        // Request pointer lock on first click
        this.input.on('pointerdown', () => {
            if (!document.pointerLockElement) {
                this.input.mouse!.requestPointerLock();
            }
        });
        
        // Handle pointer lock change
        document.addEventListener('pointerlockchange', () => {
            if (document.pointerLockElement === this.game.canvas) {
                this.isPointerLocked = true;
                // Pointer is locked, enable mouse look
                this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
                    if (this.isPointerLocked) {
                        const deltaX = pointer.movementX || 0;
                        const deltaY = pointer.movementY || 0;
                        
                        // Different sensitivity for each axis to match feel
                        const horizontalSensitivity = this.mouseSensitivity;
                        const verticalSensitivity = this.mouseSensitivity * 2; // Make vertical more sensitive
                        
                        // Horizontal look (yaw)
                        this.playerAngle += deltaX * horizontalSensitivity;
                        
                        // Vertical look (pitch) - adjusted sensitivity
                        this.pitch -= deltaY * verticalSensitivity;
                        
                        // No pitch limits - allow full vertical look
                        // This allows looking straight up and straight down
                    }
                });
            } else {
                this.isPointerLocked = false;
                // Pointer is unlocked, disable mouse look
                this.input.off('pointermove');
            }
        });
        
        // Handle pointer lock error
        document.addEventListener('pointerlockerror', () => {
            console.log('Pointer lock failed');
        });
        
        // Disable camera follow since we're doing custom rendering
        this.cameras.main.setBackgroundColor('#1a1a1a');
        
        // Add debug text
        this.add.text(10, 10, '3D FPS Game - Mouse to look, WASD to move', {
            fontSize: '16px',
            color: '#ffffff'
        });
        
        this.add.text(10, 30, 'W/S: Move Forward/Backward', {
            fontSize: '14px',
            color: '#cccccc'
        });
        
        this.add.text(10, 50, 'A/D: Strafe Left/Right', {
            fontSize: '14px',
            color: '#cccccc'
        });
        
        this.add.text(10, 70, 'Mouse: Look around (click to capture cursor)', {
            fontSize: '14px',
            color: '#cccccc'
        });
        
        this.add.text(10, 90, 'Click once to capture cursor, then move mouse', {
            fontSize: '12px',
            color: '#999999'
        });
        
        this.add.text(10, 110, 'Press ESC to release cursor', {
            fontSize: '12px',
            color: '#999999'
        });

        // EventBus emit for scene readiness
        EventBus.emit('current-scene-ready', this);
    }

    update() {
        this.handleInput();
        this.render3D();
        
        // Re-request pointer lock if it gets lost
        if (!this.isPointerLocked && this.input.activePointer.isDown) {
            this.input.mouse!.requestPointerLock();
        }
    }
    
    handleInput() {
        // Movement only - no turning with keyboard
        if (this.cursors.up.isDown || this.wasd.W.isDown) {
            this.moveForward();
        }
        if (this.cursors.down.isDown || this.wasd.S.isDown) {
            this.moveBackward();
        }
        if (this.cursors.left.isDown || this.wasd.A.isDown) {
            this.strafeLeft();
        }
        if (this.cursors.right.isDown || this.wasd.D.isDown) {
            this.strafeRight();
        }
    }
    
    moveForward() {
        const newX = this.playerX + Math.cos(this.playerAngle) * this.moveSpeed;
        const newY = this.playerY + Math.sin(this.playerAngle) * this.moveSpeed;
        
        if (!this.isWall(newX, this.playerY)) this.playerX = newX;
        if (!this.isWall(this.playerX, newY)) this.playerY = newY;
    }
    
    moveBackward() {
        const newX = this.playerX - Math.cos(this.playerAngle) * this.moveSpeed;
        const newY = this.playerY - Math.sin(this.playerAngle) * this.moveSpeed;
        
        if (!this.isWall(newX, this.playerY)) this.playerX = newX;
        if (!this.isWall(this.playerX, newY)) this.playerY = newY;
    }
    
    strafeLeft() {
        const newX = this.playerX + Math.cos(this.playerAngle - Math.PI / 2) * this.moveSpeed;
        const newY = this.playerY + Math.sin(this.playerAngle - Math.PI / 2) * this.moveSpeed;
        
        if (!this.isWall(newX, this.playerY)) this.playerX = newX;
        if (!this.isWall(this.playerX, newY)) this.playerY = newY;
    }
    
    strafeRight() {
        const newX = this.playerX + Math.cos(this.playerAngle + Math.PI / 2) * this.moveSpeed;
        const newY = this.playerY + Math.sin(this.playerAngle + Math.PI / 2) * this.moveSpeed;
        
        if (!this.isWall(newX, this.playerY)) this.playerX = newX;
        if (!this.isWall(this.playerX, newY)) this.playerY = newY;
    }
    
    isWall(x: number, y: number): boolean {
        const mapX = Math.floor(x / this.tileSize);
        const mapY = Math.floor(y / this.tileSize);
        
        if (mapX < 0 || mapX >= this.mapWidth || mapY < 0 || mapY >= this.mapHeight) {
            return true;
        }
        
        return this.map[mapY][mapX] === 1;
    }
    
    generateMap() {
        // Create a simple maze pattern
        this.map = [];
        for (let y = 0; y < this.mapHeight; y++) {
            this.map[y] = [];
            for (let x = 0; x < this.mapWidth; x++) {
                // Create walls around the border
                if (x === 0 || x === this.mapWidth - 1 || y === 0 || y === this.mapHeight - 1) {
                    this.map[y][x] = 1;
                } else {
                    // Create some internal walls
                    this.map[y][x] = (x + y) % 3 === 0 ? 1 : 0;
                }
            }
        }
    }
    
    render3D() {
        // Create a single graphics object for rendering
        if (!this.graphics) {
            this.graphics = this.add.graphics();
        }
        
        // Clear previous frame
        this.graphics.clear();
        
        // Apply pitch offset to the entire view
        // Map pitch to screen offset more appropriately
        const normalizedPitch = this.pitch / Math.PI; // Normalize to -1 to 1 range
        const pitchOffset = normalizedPitch * this.screenHeight * 0.3;
        
        // Draw checkerboard ceiling with pitch offset
        this.drawCheckerboard(0, 0 + pitchOffset, this.screenWidth, this.screenHeight / 2, 32, 0x1a1a1a, 0x2a2a2a);
        
        // Draw checkerboard floor with pitch offset
        this.drawCheckerboard(0, this.screenHeight / 2 + pitchOffset, this.screenWidth, this.screenHeight / 2, 32, 0x2d2d2d, 0x3d3d3d);
        
        // Cast rays and render walls
        const rayWidth = this.screenWidth / this.rayCount;
        
        for (let i = 0; i < this.rayCount; i++) {
            const rayAngle = this.playerAngle - this.fov / 2 + (this.fov / this.rayCount) * i;
            const distance = this.castRay(rayAngle);
            
            // Calculate wall height based on distance (perspective projection)
            const wallHeight = (this.screenHeight * this.tileSize) / distance;
            const wallTop = Math.max(0, (this.screenHeight - wallHeight) / 2);
            const wallBottom = Math.min(this.screenHeight, wallTop + wallHeight);
            
            // Apply global pitch offset to walls
            const adjustedWallTop = wallTop + pitchOffset;
            const adjustedWallBottom = wallBottom + pitchOffset;
            
            // Calculate color intensity based on distance
            const intensity = Math.max(0.1, 1 - distance / this.maxDistance);
            const color = Phaser.Display.Color.GetColor(
                Math.floor(100 * intensity),
                Math.floor(150 * intensity),
                Math.floor(200 * intensity)
            );
            
            // Draw the wall slice
            this.graphics.fillStyle(color);
            this.graphics.fillRect(i * rayWidth, adjustedWallTop, rayWidth, adjustedWallBottom - adjustedWallTop);
        }
        
        // Add crosshair
        this.graphics.lineStyle(2, 0xffffff);
        this.graphics.lineBetween(this.screenWidth / 2 - 10, this.screenHeight / 2, 
                                 this.screenWidth / 2 + 10, this.screenHeight / 2);
        this.graphics.lineBetween(this.screenWidth / 2, this.screenHeight / 2 - 10, 
                                 this.screenWidth / 2, this.screenHeight / 2 + 10);
    }
    
    castRay(angle: number): number {
        let distance = 0;
        const stepSize = 0.5; // Smaller step size for more accuracy
        
        while (distance < this.maxDistance) {
            const x = this.playerX + Math.cos(angle) * distance;
            const y = this.playerY + Math.sin(angle) * distance;
            
            if (this.isWall(x, y)) {
                return distance;
            }
            
            distance += stepSize;
        }
        
        return this.maxDistance;
    }
    
    drawCheckerboard(x: number, y: number, width: number, height: number, tileSize: number, color1: number, color2: number) {
        for (let tileX = 0; tileX < width; tileX += tileSize) {
            for (let tileY = 0; tileY < height; tileY += tileSize) {
                // Alternate colors based on position
                const isEven = Math.floor(tileX / tileSize) % 2 === Math.floor(tileY / tileSize) % 2;
                const color = isEven ? color1 : color2;
                
                this.graphics.fillStyle(color);
                this.graphics.fillRect(x + tileX, y + tileY, tileSize, tileSize);
            }
        }
    }
    
    renderSimple() {
        // Create a simple top-down view for now
        if (!this.graphics) {
            this.graphics = this.add.graphics();
        }
        
        // Clear previous frame
        this.graphics.clear();
        
        // Draw background
        this.graphics.fillStyle(0x1a1a1a);
        this.graphics.fillRect(0, 0, this.screenWidth, this.screenHeight);
        
        // Calculate tile size to fill screen
        const tileSize = Math.min(this.screenWidth / this.mapWidth, this.screenHeight / this.mapHeight);
        const mapWidth = this.mapWidth * tileSize;
        const mapHeight = this.mapHeight * tileSize;
        const offsetX = (this.screenWidth - mapWidth) / 2;
        const offsetY = (this.screenHeight - mapHeight) / 2;
        
        // Draw map
        for (let y = 0; y < this.mapHeight; y++) {
            for (let x = 0; x < this.mapWidth; x++) {
                if (this.map[y][x] === 1) {
                    this.graphics.fillStyle(0x666666);
                    this.graphics.fillRect(offsetX + x * tileSize, offsetY + y * tileSize, tileSize, tileSize);
                } else {
                    this.graphics.fillStyle(0x333333);
                    this.graphics.fillRect(offsetX + x * tileSize, offsetY + y * tileSize, tileSize, tileSize);
                }
            }
        }
        
        // Draw player
        const playerScreenX = offsetX + (this.playerX / this.tileSize) * tileSize;
        const playerScreenY = offsetY + (this.playerY / this.tileSize) * tileSize;
        
        this.graphics.fillStyle(0xff0000);
        this.graphics.fillRect(playerScreenX - tileSize/4, playerScreenY - tileSize/4, tileSize/2, tileSize/2);
        
        // Draw direction indicator
        const dirX = playerScreenX + Math.cos(this.playerAngle) * tileSize/2;
        const dirY = playerScreenY + Math.sin(this.playerAngle) * tileSize/2;
        this.graphics.lineStyle(3, 0xffff00);
        this.graphics.lineBetween(playerScreenX, playerScreenY, dirX, dirY);
    }
}
