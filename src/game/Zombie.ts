export class Zombie {
    x: number;
    y: number;
    angle: number;
    health: number;
    maxHealth: number;
    speed: number;
    detectionRange: number;
    attackRange: number;
    attackDamage: number;
    attackCooldown: number;
    lastAttackTime: number;
    attackRecoveryTime: number;
    lastAttackRecovery: number;
    state: 'idle' | 'chasing' | 'attacking' | 'dead';
    targetX: number;
    targetY: number;
    path: { x: number; y: number }[];
    pathIndex: number;
    lastPathUpdate: number;
    pathUpdateInterval: number;
    size: number;
    isVisible: boolean;
    distanceToPlayer: number;
    angleToPlayer: number;
    spawnTime: number;
    gracePeriod: number;

    constructor(x: number, y: number) {
        this.x = x;
        this.y = y;
        this.angle = 0;
        this.health = 100;
        this.maxHealth = 100;
        this.speed = 0.4; // Much slower than player
        this.detectionRange = 400;
        this.attackRange = 30;
        this.attackDamage = 20;
        this.attackCooldown = 2000; // 2 seconds
        this.lastAttackTime = 0;
        this.attackRecoveryTime = 1500; // 1.5 seconds recovery after attack
        this.lastAttackRecovery = 0;
        this.state = 'idle';
        this.targetX = x;
        this.targetY = y;
        this.path = [];
        this.pathIndex = 0;
        this.lastPathUpdate = 0;
        this.pathUpdateInterval = 1000; // Update path every second
        this.size = 20; // Zombie size for collision
        this.isVisible = false;
        this.distanceToPlayer = 0;
        this.angleToPlayer = 0;
        this.spawnTime = Date.now();
        this.gracePeriod = 2000; // 2 seconds grace period before detection
    }

    update(playerX: number, playerY: number, map: number[][], mapWidth: number, mapHeight: number, tileSize: number, deltaTime: number) {
        if (this.state === 'dead') return;

        // Calculate distance and angle to player
        this.distanceToPlayer = Math.sqrt(
            (playerX - this.x) ** 2 + (playerY - this.y) ** 2
        );
        this.angleToPlayer = Math.atan2(playerY - this.y, playerX - this.x);

        // Check if zombie can see player (simple line of sight)
        this.isVisible = this.canSeePlayer();
        

        // State machine
        switch (this.state) {
            case 'idle':
                this.updateIdle(playerX, playerY);
                break;
            case 'chasing':
                this.updateChasing(playerX, playerY, map, mapWidth, mapHeight, tileSize, deltaTime);
                break;
            case 'attacking':
                this.updateAttacking();
                break;
        }
    }

    updateIdle(playerX: number, playerY: number) {
        const currentTime = Date.now();
        const timeSinceSpawn = currentTime - this.spawnTime;
        
        // Check if grace period has passed
        if (timeSinceSpawn < this.gracePeriod) {
            // During grace period, wander around normally but can't detect player
            const randomAngle = Math.random() * Math.PI * 2;
            const moveDistance = 0.3; // Normal movement during grace period
            this.x += Math.cos(randomAngle) * moveDistance;
            this.y += Math.sin(randomAngle) * moveDistance;
            this.angle = randomAngle;
            
            return;
        }
        
        // Check if player is within detection range (only after grace period)
        if (this.distanceToPlayer <= this.detectionRange && this.isVisible) {
            this.state = 'chasing';
            this.targetX = playerX;
            this.targetY = playerY;
            console.log(`Zombie detected player and started chasing`);
        } else {
            // Always move in idle state - wander around
            const randomAngle = Math.random() * Math.PI * 2;
            const moveDistance = 0.3; // Slow idle movement
            this.x += Math.cos(randomAngle) * moveDistance;
            this.y += Math.sin(randomAngle) * moveDistance;
            this.angle = randomAngle;
            
        }
    }

    updateChasing(playerX: number, playerY: number, map: number[][], mapWidth: number, mapHeight: number, tileSize: number, deltaTime: number) {
        // Update target if player moved significantly
        if (this.distanceToPlayer > this.detectionRange || !this.isVisible) {
            this.state = 'idle';
            return;
        }

        // Check if close enough to attack
        if (this.distanceToPlayer <= this.attackRange) {
            this.state = 'attacking';
            return;
        }

        // Move towards player but maintain minimum distance
        this.moveTowardsPlayer(playerX, playerY, deltaTime, 20, map, mapWidth, mapHeight, tileSize);
    }

    updateAttacking() {
        const currentTime = Date.now();
        
        // Check if we're in recovery period after an attack
        if (this.lastAttackRecovery > 0 && currentTime - this.lastAttackRecovery < this.attackRecoveryTime) {
            // In recovery - can't attack or move much
            return;
        }
        
        // Check if player moved out of attack range
        if (this.distanceToPlayer > this.attackRange) {
            this.state = 'chasing';
            this.lastAttackRecovery = 0; // Reset recovery
            return;
        }

        // Check if player moved out of detection range
        if (this.distanceToPlayer > this.detectionRange || !this.isVisible) {
            this.state = 'idle';
            this.lastAttackRecovery = 0; // Reset recovery
            return;
        }

        // Attack if cooldown is ready
        if (currentTime - this.lastAttackTime > this.attackCooldown) {
            this.attack();
            this.lastAttackTime = currentTime;
            this.lastAttackRecovery = currentTime; // Start recovery period
        }
    }

    canSeePlayer(): boolean {
        // Since we have no walls in the outdoor setting, zombies can always see the player
        // This was the main issue - the line of sight check was too strict
        return true;
    }

    isWall(x: number, y: number, map: number[][], mapWidth: number, mapHeight: number, tileSize: number): boolean {
        const mapX = Math.floor(x / tileSize);
        const mapY = Math.floor(y / tileSize);
        
        if (mapX < 0 || mapX >= mapWidth || mapY < 0 || mapY >= mapHeight) {
            return true;
        }
        
        return map[mapY][mapX] === 1;
    }

    updatePath(targetX: number, targetY: number) {
        // Simple pathfinding - move directly towards target if possible
        this.path = [{ x: targetX, y: targetY }];
        this.pathIndex = 0;
    }

    moveAlongPath(deltaTime: number) {
        if (this.path.length === 0) return;

        const target = this.path[this.pathIndex];
        const dx = target.x - this.x;
        const dy = target.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < 5) {
            // Reached current target, move to next
            this.pathIndex++;
            if (this.pathIndex >= this.path.length) {
                this.pathIndex = 0;
            }
            return;
        }

        // Move towards target
        const moveDistance = this.speed * deltaTime;
        const moveX = (dx / distance) * moveDistance;
        const moveY = (dy / distance) * moveDistance;

        this.x += moveX;
        this.y += moveY;
        this.angle = Math.atan2(dy, dx);
    }
    
    moveTowardsPlayer(playerX: number, playerY: number, deltaTime: number, minDistance: number = 40, map?: number[][], mapWidth?: number, mapHeight?: number, tileSize?: number) {
        const dx = playerX - this.x;
        const dy = playerY - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Always move towards player, but slower when close
        let moveDistance = this.speed * deltaTime;
        
        // If we're very close, move slower but still move
        if (distance <= minDistance) {
            moveDistance *= 0.3; // Slow down but don't stop
        }
        
        // Move towards player
        const moveX = (dx / distance) * moveDistance;
        const moveY = (dy / distance) * moveDistance;
        
        // Check wall collision before moving
        if (map && mapWidth && mapHeight && tileSize) {
            const newX = this.x + moveX;
            const newY = this.y + moveY;
            
            if (!this.isWall(newX, this.y, map, mapWidth, mapHeight, tileSize)) {
                this.x = newX;
            }
            if (!this.isWall(this.x, newY, map, mapWidth, mapHeight, tileSize)) {
                this.y = newY;
            }
        } else {
            this.x += moveX;
            this.y += moveY;
        }
        
        this.angle = Math.atan2(dy, dx);
    }

    attack() {
        // This will be called by the game to damage the player
        console.log('Zombie attacks!');
    }

    takeDamage(damage: number) {
        this.health -= damage;
        if (this.health <= 0) {
            this.health = 0;
            this.state = 'dead';
        }
    }

    isDead(): boolean {
        return this.state === 'dead';
    }

    getRenderData(_playerX: number, _playerY: number, playerAngle: number): {
        distance: number;
        angle: number;
        isVisible: boolean;
        health: number;
        maxHealth: number;
    } {
        // Calculate relative angle to player's view
        const relativeAngle = this.angleToPlayer - playerAngle;
        
        return {
            distance: this.distanceToPlayer,
            angle: relativeAngle,
            isVisible: this.isVisible,
            health: this.health,
            maxHealth: this.maxHealth
        };
    }
}
