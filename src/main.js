import './style.css';
import { Game } from './game.js';

const canvas = document.querySelector('#view');
const game = new Game(canvas);
game.start();
