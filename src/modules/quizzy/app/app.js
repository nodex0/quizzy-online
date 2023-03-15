import { LightningElement } from 'lwc';
import { STAGE, QUIZ_MODE } from 'logic/constants';

export default class App extends LightningElement {
    stage = STAGE.SELECTION_SCREEN;
    quiz;
    questionQueue;

    darkMode = false;

    connectedCallback() {
        if (typeof localStorage.darkMode === 'undefined') {
            this.darkMode = window.matchMedia('(prefers-color-scheme: dark)').matches
        } else {
            this.darkMode = localStorage.getItem('darkMode') === 'true';
        }
    }

    quizSelectionHandler(event) {
        this.quizId = event.detail.id;
        this.questionQueue = event.detail.questionQueue;
        this.stage = STAGE.QUIZ_SCREEN;
    }

    goHomeHandler(event) {
        this.stage = STAGE.SELECTION_SCREEN;
    }

    toggleDarkModeHandler() {
        this.darkMode = !this.darkMode;
        localStorage.setItem('darkMode', this.darkMode);
    }

    get currentStage() {
        return Object.fromEntries(Object.keys(STAGE).map(key => [key, STAGE[key] === this.stage]));
    }

    get lightbulbClasses() {
        return this.darkMode ? 'w-6 h-6 fill-cyan-900 stroke-2 transition-all' : 'w-6 h-6 fill-yellow-300 stroke-2 transition-all';
    }

    get mainContainerClasses() {
        const commonClasses = 'grid h-full place-items-center overflow-y-auto sm:pt-3 sm:pb-3';
        return commonClasses + (this.darkMode ? ' bg-[radial-gradient(ellipse_at_bottom,_var(--tw-gradient-stops))] from-gray-700 to-gray-900' : ' bg-[radial-gradient(ellipse_at_bottom,_var(--tw-gradient-stops))] from-green-300 to-purple-400');
    }
}
