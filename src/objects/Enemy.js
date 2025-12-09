class Enemy {
    constructor(enemy, object) {
        this.name = enemy.name;
        this.health = enemy.health;
        this.object = object;
        this.forward = vec3.fromValues(0,0,-1); // This literally just exists so that I can make the enemy look at the player i hate my chungus life
    }
}