class Enemy {
    constructor(enemy, object) {
        this.name = enemy.name;
        this.health = enemy.health;
        this.object = object;
        this.forward = vec3.fromValues(0,0,-1);
    }
}