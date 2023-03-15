import { LightningElement, wire } from 'lwc';
import { QUIZ_MODE } from 'logic/constants';
import getQuiz from 'wires/quizAdapter';

export default class SelectionScreen extends LightningElement {
    @wire(getQuiz, { filename: 'index' })
    _quizIndex;

    QUIZ_MODE = QUIZ_MODE;

    get quizzes() {
        return this._quizIndex ? Object.keys(this._quizIndex).map(quizId => this._quizIndex[quizId]) : [];
    }

    quizClickHandler(event) {
        const id = event.target.closest('[data-quiz]')?.dataset.quiz;
        const mode = event.target.closest('[data-mode]')?.dataset.mode;
        if (id && mode) {
            let questionQueue;
            if (mode === QUIZ_MODE.RANDOM) {
                questionQueue = Array.from({ length: 30 }, () => Math.floor(Math.random() * this._quizIndex[id].length));
            } else if (mode === QUIZ_MODE.FULL) {
                questionQueue = Array.from({ length: this._quizIndex[id].length }, (_, i) => i);
            }
            this.dispatchEvent(
                new CustomEvent('quizselected', { detail: { id, questionQueue } })
            );
        }
    }
}
