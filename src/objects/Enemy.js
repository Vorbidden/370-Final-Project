class Enemy {
    constructor(enemy, object) {
        this.name = enemy.name;
        this.health = enemy.health;
        this.object = object;
        this.forward = vec3.fromValues(0,-0.5,0.5); // This literally just exists so that I can make the enemy look at the player i hate my chungus life
    }
}