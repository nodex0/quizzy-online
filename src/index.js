
import '@lwc/synthetic-shadow';
import { createElement } from 'lwc';
import MyApp from 'quizzy/app';

const app = createElement('quizzy-app', { is: MyApp });
document.querySelector('#main').appendChild(app);