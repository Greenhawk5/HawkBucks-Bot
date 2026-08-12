export class MissionCollector {

    constructor() {
        this.missions = [];
    }

    add(mission) {
        this.missions.push(mission);
    }

    getAll() {
        return this.missions;
    }

}