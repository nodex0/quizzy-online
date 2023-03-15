import { QUIZ_DIRECTORY } from 'logic/constants';

export default class getQuiz {
    connected = false;
    directory;

    constructor(dataCallback) {
        this.dataCallback = dataCallback;
    }

    connect() {
        this.connected = true;
    }

    disconnect() {
        this.connected = false;
    }

    update(config) {
        if (config.filename) {
            this.refreshData(config.filename);
        }
    }

    async refreshData(quizFile) {
        if (this.connected) {
            const content = await (await fetch(`${QUIZ_DIRECTORY}/${quizFile}.json`)).json();
            this.dataCallback(content);
        }
    }
}