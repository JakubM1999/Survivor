import { Scene } from 'phaser';
import { EventBus } from '../EventBus';
import { Zombie } from '../Zombie';

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
    wasd: Record<string, Phaser.Input.Keyboard.Key>;
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
    
    // Zombie system
    zombies: Zombie[] = [];
    maxZombies: number = 5;
    zombieSpawnTimer: number = 0;
    zombieSpawnInterval: number = 10000; // 10 seconds
    playerHealth: number = 100;
    maxPlayerHealth: number = 100;
    lastDamageTime: number = 0;
    damageCooldown: number = 1000; // 1 second between damage ticks
    
    // Shooting system
    lastShotTime: number = 0;
    shotCooldown: number = 500; // 0.5 seconds between shots
    weaponDamage: number = 50;
    
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
        this.wasd = this.input.keyboard!.addKeys('W,S,A,D') as Record<string, Phaser.Input.Keyboard.Key>;
        
        // Set up mouse controls
        this.input.mouse!.disableContextMenu();
        
        // Initialize mouse position
        this.mouseX = this.screenWidth / 2;
        this.mouseY = this.screenHeight / 2;
        
        // Request pointer lock on first click and handle shooting
        this.input.on('pointerdown', () => {
            if (!document.pointerLockElement) {
                this.input.mouse!.requestPointerLock();
            } else {
                // Shoot if pointer is locked
                this.shoot();
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
        this.cameras.main.setBackgroundColor('#87CEEB'); // Sky blue for outdoor setting
        
        // Add debug text
        this.add.text(10, 10, '3D FPS Game - Outdoor Survival - Mouse to look, WASD to move', {
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
        
        this.add.text(10, 130, 'Left Click: Shoot zombies', {
            fontSize: '12px',
            color: '#999999'
        });
        
        this.add.text(10, 150, 'Check console for zombie behavior and spawn locations', {
            fontSize: '10px',
            color: '#666666'
        });
        
        this.add.text(10, 170, 'Yellow circle = Safe spawn radius (200 units)', {
            fontSize: '10px',
            color: '#666666'
        });
        
        this.add.text(10, 190, 'Zombie colors: Gray=Grace, Green=Active, Orange=Recovery', {
            fontSize: '10px',
            color: '#666666'
        });
        
        // Initialize zombies
        this.spawnInitialZombies();
        
        // Set up independent zombie update timer
        this.time.addEvent({
            delay: 16, // 60 FPS
            callback: () => {
                this.updateZombies(16);
            },
            loop: true
        });
        
        // Add UI elements
        const healthText = this.add.text(this.screenWidth - 200, 10, `Health: ${this.playerHealth}/${this.maxPlayerHealth}`, {
            fontSize: '16px',
            color: '#ffffff'
        });
        healthText.setName('healthText');
        
        const zombieText = this.add.text(this.screenWidth - 200, 30, `Zombies: 0/${this.maxZombies}`, {
            fontSize: '16px',
            color: '#ffffff'
        });
        zombieText.setName('zombieText');

        // EventBus emit for scene readiness
        EventBus.emit('current-scene-ready', this);
    }

    update() {
        this.handleInput();
        this.checkPlayerZombieCollision();
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
        // Create an outdoor setting - completely open with no walls
        this.map = [];
        for (let y = 0; y < this.mapHeight; y++) {
            this.map[y] = [];
            for (let x = 0; x < this.mapWidth; x++) {
                // No walls at all - completely open outdoor area
                this.map[y][x] = 0;
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
        
        // Draw sky with gradient effect
        this.drawSky(0, 0 + pitchOffset, this.screenWidth, this.screenHeight / 2);
        
        // Draw grass ground with pitch offset
        this.drawGrass(0, this.screenHeight / 2 + pitchOffset, this.screenWidth, this.screenHeight / 2);
        
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
        
        // Render zombies
        this.renderZombies(pitchOffset);
        
        // Add crosshair
        this.graphics.lineStyle(2, 0xffffff);
        this.graphics.lineBetween(this.screenWidth / 2 - 10, this.screenHeight / 2, 
                                 this.screenWidth / 2 + 10, this.screenHeight / 2);
        this.graphics.lineBetween(this.screenWidth / 2, this.screenHeight / 2 - 10, 
                                 this.screenWidth / 2, this.screenHeight / 2 + 10);
        
        // Update UI
        this.updateUI();
    }
    
    renderZombies(pitchOffset: number) {
        // Sort zombies by distance (farthest first for proper depth)
        const visibleZombies = this.zombies
            .filter(zombie => !zombie.isDead() && zombie.isVisible)
            .map(zombie => ({
                zombie,
                data: zombie.getRenderData(this.playerX, this.playerY, this.playerAngle)
            }))
            .sort((a, b) => b.data.distance - a.data.distance);
        
        visibleZombies.forEach(({ zombie, data }) => {
            // Check if zombie is within FOV
            const normalizedAngle = this.normalizeAngle(data.angle);
            if (Math.abs(normalizedAngle) > this.fov / 2) return;
            
            // Calculate screen position
            const screenX = (normalizedAngle / (this.fov / 2)) * (this.screenWidth / 2) + (this.screenWidth / 2);
            
            // Calculate sprite size based on distance
            const spriteHeight = (this.screenHeight * 100) / data.distance; // 100 is base sprite height
            const spriteWidth = spriteHeight * 0.6; // Aspect ratio
            
            // Calculate sprite position
            const spriteTop = (this.screenHeight - spriteHeight) / 2 + pitchOffset;
            const spriteLeft = screenX - spriteWidth / 2;
            
            // Only render if sprite is on screen
            if (spriteLeft < this.screenWidth && spriteLeft + spriteWidth > 0) {
                // Calculate color based on distance and health
                const intensity = Math.max(0.1, 1 - data.distance / this.maxDistance);
                const healthRatio = data.health / data.maxHealth;
                
                let color;
                if (zombie.state === 'attacking') {
                    color = Phaser.Display.Color.GetColor(
                        Math.floor(255 * intensity),
                        Math.floor(100 * intensity),
                        Math.floor(100 * intensity)
                    );
                } else if (zombie.state === 'chasing') {
                    color = Phaser.Display.Color.GetColor(
                        Math.floor(200 * intensity),
                        Math.floor(150 * intensity),
                        Math.floor(100 * intensity)
                    );
                } else {
                    color = Phaser.Display.Color.GetColor(
                        Math.floor(100 * intensity * healthRatio),
                        Math.floor(150 * intensity * healthRatio),
                        Math.floor(100 * intensity * healthRatio)
                    );
                }
                
                // Draw zombie sprite (simple rectangle for now)
                this.graphics.fillStyle(color);
                this.graphics.fillRect(spriteLeft, spriteTop, spriteWidth, spriteHeight);
                
                // Draw health bar
                const barWidth = spriteWidth;
                const barHeight = 4;
                const barY = spriteTop - 8;
                
                // Background (red)
                this.graphics.fillStyle(0x660000);
                this.graphics.fillRect(spriteLeft, barY, barWidth, barHeight);
                
                // Health (green)
                this.graphics.fillStyle(0x00ff00);
                this.graphics.fillRect(spriteLeft, barY, barWidth * healthRatio, barHeight);
            }
        });
    }
    
    normalizeAngle(angle: number): number {
        while (angle > Math.PI) angle -= 2 * Math.PI;
        while (angle < -Math.PI) angle += 2 * Math.PI;
        return angle;
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
    
    drawSky(x: number, y: number, width: number, height: number) {
        // Create a gradient sky effect
        for (let i = 0; i < height; i++) {
            const ratio = i / height;
            const r = Math.floor(135 + (100 - 135) * ratio); // Blue to lighter blue
            const g = Math.floor(206 + (200 - 206) * ratio);
            const b = Math.floor(235 + (255 - 235) * ratio);
            const color = Phaser.Display.Color.GetColor(r, g, b);
            
            this.graphics.fillStyle(color);
            this.graphics.fillRect(x, y + i, width, 1);
        }
    }
    
    drawGrass(x: number, y: number, width: number, height: number) {
        // Create a grass pattern
        const grassTileSize = 16;
        for (let tileX = 0; tileX < width; tileX += grassTileSize) {
            for (let tileY = 0; tileY < height; tileY += grassTileSize) {
                // Alternate between different shades of green
                const isEven = Math.floor(tileX / grassTileSize) % 2 === Math.floor(tileY / grassTileSize) % 2;
                const color = isEven ? 0x228B22 : 0x32CD32; // Forest green and lime green
                
                this.graphics.fillStyle(color);
                this.graphics.fillRect(x + tileX, y + tileY, grassTileSize, grassTileSize);
            }
        }
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
        
        // Draw outdoor background
        this.graphics.fillStyle(0x87CEEB); // Sky blue
        this.graphics.fillRect(0, 0, this.screenWidth, this.screenHeight);
        
        // Calculate tile size to fill screen
        const tileSize = Math.min(this.screenWidth / this.mapWidth, this.screenHeight / this.mapHeight);
        const mapWidth = this.mapWidth * tileSize;
        const mapHeight = this.mapHeight * tileSize;
        const offsetX = (this.screenWidth - mapWidth) / 2;
        const offsetY = (this.screenHeight - mapHeight) / 2;
        
        // Draw grass field
        for (let y = 0; y < this.mapHeight; y++) {
            for (let x = 0; x < this.mapWidth; x++) {
                // Alternate grass colors for texture
                const isEven = (x + y) % 2 === 0;
                const color = isEven ? 0x228B22 : 0x32CD32; // Forest green and lime green
                this.graphics.fillStyle(color);
                this.graphics.fillRect(offsetX + x * tileSize, offsetY + y * tileSize, tileSize, tileSize);
            }
        }
        
        // Draw player
        const playerScreenX = offsetX + (this.playerX / this.tileSize) * tileSize;
        const playerScreenY = offsetY + (this.playerY / this.tileSize) * tileSize;
        
        this.graphics.fillStyle(0xff0000);
        this.graphics.fillRect(playerScreenX - tileSize/4, playerScreenY - tileSize/4, tileSize/2, tileSize/2);
        
        // Draw player collision radius
        this.graphics.lineStyle(2, 0xff0000);
        this.graphics.strokeCircle(playerScreenX, playerScreenY, (15 / this.tileSize) * tileSize);
        
        // Draw safe spawn radius
        this.graphics.lineStyle(1, 0xffff00);
        this.graphics.strokeCircle(playerScreenX, playerScreenY, (200 / this.tileSize) * tileSize);
        
        // Draw direction indicator
        const dirX = playerScreenX + Math.cos(this.playerAngle) * tileSize/2;
        const dirY = playerScreenY + Math.sin(this.playerAngle) * tileSize/2;
        this.graphics.lineStyle(3, 0xffff00);
        this.graphics.lineBetween(playerScreenX, playerScreenY, dirX, dirY);
        
        // Draw zombies
        this.zombies.forEach(zombie => {
            if (zombie.isDead()) return;
            
            const zombieScreenX = offsetX + (zombie.x / this.tileSize) * tileSize;
            const zombieScreenY = offsetY + (zombie.y / this.tileSize) * tileSize;
            
            // Draw zombie (different color during grace period and recovery)
            const currentTime = Date.now();
            const timeSinceSpawn = currentTime - zombie.spawnTime;
            const isInGracePeriod = timeSinceSpawn < zombie.gracePeriod;
            const isInRecovery = zombie.lastAttackRecovery > 0 && currentTime - zombie.lastAttackRecovery < zombie.attackRecoveryTime;
            
            let zombieColor = 0x00ff00; // Default green
            if (isInGracePeriod) {
                zombieColor = 0x666666; // Gray during grace period
            } else if (isInRecovery) {
                zombieColor = 0xff6600; // Orange during recovery
            }
            
            this.graphics.fillStyle(zombieColor);
            this.graphics.fillRect(zombieScreenX - tileSize/6, zombieScreenY - tileSize/6, tileSize/3, tileSize/3);
            
            // Draw zombie collision radius
            this.graphics.lineStyle(1, 0x00ff00);
            this.graphics.strokeCircle(zombieScreenX, zombieScreenY, (zombie.size / this.tileSize) * tileSize);
            
            // Draw health bar
            const barWidth = tileSize/2;
            const barHeight = 2;
            const barY = zombieScreenY - tileSize/4;
            
            this.graphics.fillStyle(0x660000);
            this.graphics.fillRect(zombieScreenX - barWidth/2, barY, barWidth, barHeight);
            
            this.graphics.fillStyle(0x00ff00);
            this.graphics.fillRect(zombieScreenX - barWidth/2, barY, barWidth * (zombie.health / zombie.maxHealth), barHeight);
        });
    }
    
    spawnInitialZombies() {
        // Spawn a few zombies at random locations
        for (let i = 0; i < 3; i++) {
            this.spawnZombie();
        }
    }
    
    spawnZombie() {
        if (this.zombies.length >= this.maxZombies) return;
        
        // Spawn zombies at a safe distance from the player
        let x = 0, y = 0;
        let attempts = 0;
        const minDistanceFromPlayer = 200; // Minimum distance from current player position
        
        do {
            // Spawn zombies anywhere in the field
            x = Math.random() * (this.mapWidth - 2) * this.tileSize + this.tileSize;
            y = Math.random() * (this.mapHeight - 2) * this.tileSize + this.tileSize;
            
            // Check distance from current player position (calculated in while condition)
            
            attempts++;
        } while (Math.sqrt((x - this.playerX) ** 2 + (y - this.playerY) ** 2) < minDistanceFromPlayer && attempts < 100);
        
        if (attempts < 100) {
            const zombie = new Zombie(x, y);
            this.zombies.push(zombie);
            console.log(`Zombie spawned at (${x.toFixed(1)}, ${y.toFixed(1)}) - Distance from player: ${Math.sqrt((x - this.playerX) ** 2 + (y - this.playerY) ** 2).toFixed(1)}`);
        }
    }
    
    updateZombies(delta: number) {
        // Update existing zombies
        this.zombies.forEach(zombie => {
            zombie.update(this.playerX, this.playerY, this.map, this.mapWidth, this.mapHeight, this.tileSize, delta);
        });
        
        // Handle zombie-to-zombie collision
        this.handleZombieCollisions();
        
        // Remove dead zombies
        this.zombies = this.zombies.filter(zombie => !zombie.isDead());
        
        // Spawn new zombies periodically
        this.zombieSpawnTimer += delta;
        if (this.zombieSpawnTimer >= this.zombieSpawnInterval) {
            this.spawnZombie();
            this.zombieSpawnTimer = 0;
        }
    }
    
    handleZombieCollisions() {
        for (let i = 0; i < this.zombies.length; i++) {
            for (let j = i + 1; j < this.zombies.length; j++) {
                const zombie1 = this.zombies[i];
                const zombie2 = this.zombies[j];
                
                if (zombie1.isDead() || zombie2.isDead()) continue;
                
                const distance = Math.sqrt(
                    (zombie1.x - zombie2.x) ** 2 + (zombie1.y - zombie2.y) ** 2
                );
                
                const collisionDistance = zombie1.size + zombie2.size;
                if (distance < collisionDistance) {
                    // Push zombies apart
                    const dx = zombie2.x - zombie1.x;
                    const dy = zombie2.y - zombie1.y;
                    const pushDistance = (collisionDistance - distance) / 2;
                    const pushX = (dx / distance) * pushDistance;
                    const pushY = (dy / distance) * pushDistance;
                    
                    zombie1.x -= pushX;
                    zombie1.y -= pushY;
                    zombie2.x += pushX;
                    zombie2.y += pushY;
                }
            }
        }
    }
    
    checkPlayerZombieCollision() {
        const currentTime = Date.now();
        const playerRadius = 15; // Reduced player collision radius
        
        this.zombies.forEach(zombie => {
            if (zombie.isDead()) return;
            
            const distance = Math.sqrt(
                (zombie.x - this.playerX) ** 2 + (zombie.y - this.playerY) ** 2
            );
            
            // Check for collision between player and zombie
            const collisionDistance = playerRadius + zombie.size;
            if (distance < collisionDistance) {
                // Push zombie away from player, but only slightly
                const dx = zombie.x - this.playerX;
                const dy = zombie.y - this.playerY;
                const pushDistance = (collisionDistance - distance) * 0.5; // Reduced push force
                const pushX = (dx / distance) * pushDistance;
                const pushY = (dy / distance) * pushDistance;
                
                zombie.x += pushX;
                zombie.y += pushY;
            }
            
            // Check if zombie is attacking and close enough
            if (zombie.state === 'attacking' && distance <= zombie.attackRange) {
                if (currentTime - this.lastDamageTime > this.damageCooldown) {
                    this.takeDamage(zombie.attackDamage);
                    this.lastDamageTime = currentTime;
                }
            }
        });
    }
    
    takeDamage(damage: number) {
        this.playerHealth -= damage;
        if (this.playerHealth < 0) this.playerHealth = 0;
        
        // Flash screen red when taking damage
        this.cameras.main.flash(200, 255, 0, 0, false);
        
        if (this.playerHealth <= 0) {
            this.gameOver();
        }
    }
    
    gameOver() {
        // Simple game over - restart the scene
        this.scene.restart();
    }
    
    updateUI() {
        // Update health display
        const healthText = this.children.getByName('healthText') as Phaser.GameObjects.Text;
        if (healthText) {
            healthText.setText(`Health: ${this.playerHealth}/${this.maxPlayerHealth}`);
        }
        
        // Update zombie count display
        const zombieText = this.children.getByName('zombieText') as Phaser.GameObjects.Text;
        if (zombieText) {
            const aliveZombies = this.zombies.filter(zombie => !zombie.isDead()).length;
            zombieText.setText(`Zombies: ${aliveZombies}/${this.maxZombies}`);
        }
    }
    
    shoot() {
        const currentTime = Date.now();
        if (currentTime - this.lastShotTime < this.shotCooldown) return;
        
        this.lastShotTime = currentTime;
        
        // Find the closest zombie in the crosshair
        let closestZombie: Zombie | null = null;
        let closestDistance = Infinity;
        
        this.zombies.forEach(zombie => {
            if (zombie.isDead()) return;
            
            const data = zombie.getRenderData(this.playerX, this.playerY, this.playerAngle);
            const normalizedAngle = this.normalizeAngle(data.angle);
            
            // Check if zombie is roughly in the crosshair (within a small angle)
            if (Math.abs(normalizedAngle) < 0.1) { // About 6 degrees
                if (data.distance < closestDistance) {
                    closestDistance = data.distance;
                    closestZombie = zombie;
                }
            }
        });
        
        if (closestZombie) {
            // Damage the zombie
            (closestZombie as Zombie).takeDamage(this.weaponDamage);
            
            // Visual feedback
            this.cameras.main.shake(100, 0.01);
            
            // Muzzle flash effect
            this.graphics.fillStyle(0xffff00);
            this.graphics.fillRect(this.screenWidth / 2 - 2, this.screenHeight / 2 - 2, 4, 4);
        }
    }
}
