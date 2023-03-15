import { LightningElement, api, wire } from 'lwc';
import getQuiz from 'wires/quizAdapter';

const formatQuestionNumbering = (index) =>
    String.fromCharCode(97 + parseInt(index)) + ')';

const replaceQuestionMergeFields = (text) => {
    return text.replace(/\$(\d)/g, (_, index) => formatQuestionNumbering(index));
};

const formatQuestionText = (text, replacements) => {
    return text.replace(/\$(\d)/g, (_, index) => `$${replacements[index]}`);
};

export default class QuizScreen extends LightningElement {
    @api quizId;
    @api questionQueue = [];
    @api shuffle;

    quiz;
    answerList = [];

    quizFinished = false;
    showSummaryScreen = false;

    @wire(getQuiz, { filename: 'index' })
    quizIndex;

    @wire(getQuiz, { filename: '$quizId' })
    quizWire(quiz) {
        const finalQuiz = JSON.parse(JSON.stringify(quiz));
        // NOTE: Shuffling the options and replacing the $0, $1, etc. with the correct options
        for (
            let questionIndex = 0;
            questionIndex < finalQuiz.length;
            questionIndex++
        ) {
            let question = finalQuiz[questionIndex];
            let options = question.options;
            if (this.shuffle) {
                options = options.sort(() => Math.random() - 0.5);
            }
            const indexReplacements = quiz[questionIndex].options.map((opt) =>
                options.indexOf(opt)
            );
            question.answerIndex = indexReplacements[question.answerIndex];
            for (
                let optionIndex = 0;
                optionIndex < question.options.length;
                optionIndex++
            ) {
                question.options[optionIndex] = formatQuestionText(
                    question.options[optionIndex],
                    indexReplacements
                );
            }
        }
        this.quiz = finalQuiz;
    }

    currentQuestionIndex = 0;

    get title() {
        return this.quizIndex ? this.quizIndex[this.quizId].label : null;
    }

    get questionId() {
        return this.questionQueue[this.currentQuestionIndex] || 0;
    }

    get question() {
        return this.quiz ? this.quiz[this.questionId] : null;
    }

    get answers() {
        return this.questionQueue.map((questionIndex, index) => ({
            id: questionIndex,
            number: questionIndex + 1,
            right:
                this.quiz[questionIndex].answerIndex === this.answerList[index]
        }));
    }

    get progressText() {
        return `${this.currentQuestionIndex + 1} / ${
            this.questionQueue.length
        }`;
    }

    get accuracyResult() {
        const correctAnswers = this.answerList.filter(
            (answer, questionIndex) =>
                this.quiz[questionIndex].answerIndex === answer
        ).length;
        return `${correctAnswers} / ${this.questionQueue.length} (${Math.round(
            (correctAnswers / this.questionQueue.length) * 100
        )}%)`;
    }

    get questionOptions() {
        return this.question.options.map((option, index) => ({
            id: index,
            text: replaceQuestionMergeFields(option),
            number: formatQuestionNumbering(index),
            isCorrect:
                this.isCurrentQuestionAnswered &&
                this.quiz[this.questionId].answerIndex === index,
            isSelected: this.answerList[this.currentQuestionIndex] === index
        }));
    }

    get isCurrentQuestionAnswered() {
        return this.answerList[this.currentQuestionIndex] !== undefined;
    }

    answerClickHandler(event) {
        if (this.isCurrentQuestionAnswered) {
            this.showSummaryScreen = true;
            return;
        }
        const el = event.target.closest('p');
        if (el) {
            const index = [...el.parentElement.children].indexOf(el);
            this.answerList[this.currentQuestionIndex] = index;
            this.goToNext();
        }
    }

    returnHomeHandler(event) {
        this.dispatchEvent(new CustomEvent('back'));
    }

    reviewClickHandler(event) {
        const el = event.target.closest('p');
        if (el) {
            const index = [...el.parentElement.children].indexOf(el);
            this.currentQuestionIndex = index;
            this.showSummaryScreen = false;
        }
    }

    goToNext() {
        if (this.currentQuestionIndex < this.questionQueue.length - 1) {
            this.currentQuestionIndex++;
        } else {
            this.showSummaryScreen = true;
            this.quizFinished = true;
        }
    }
}
