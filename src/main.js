import './style.css';
import { preloadDecos } from './decos.js';
import { Game } from './game.js';

const canvas = document.querySelector('#view');
preloadDecos().then(() => {
  const game = new Game(canvas);
  game.start();
});
