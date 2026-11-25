import './ui/styles.css';
import { GameApp } from './ui/gameApp';

const appRoot = document.getElementById('app');
if (appRoot) {
  new GameApp(appRoot);
}
