import { GameState } from './GameState.js';

const game = new GameState();
game.init().catch( err => {

	console.error( 'Failed to initialize game:', err );

	const msg = document.createElement( 'div' );
	msg.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:#000;color:#f55;font:bold 18px sans-serif;text-align:center;padding:32px;';
	msg.textContent = 'Failed to load game: ' + err.message;
	document.body.appendChild( msg );

} );
