import { Progression, CAR_CATALOG, UPGRADE_COSTS, getUpgradeLabel, getUpgradeCost } from './Progression.js';
import { TRACKS } from './TrackData.js';
import { formatTime } from './LapTimer.js';

export class UI {

	constructor( onStartRace ) {

		this.onStartRace = onStartRace;
		this._inject();
		this._screens = {
			menu: document.getElementById( 'screen-menu' ),
			garage: document.getElementById( 'screen-garage' ),
			results: document.getElementById( 'screen-results' ),
			loading: document.getElementById( 'screen-loading' ),
		};

	}

	show( name ) {

		for ( const [ key, el ] of Object.entries( this._screens ) ) {

			el.style.display = key === name ? 'flex' : 'none';

		}

		if ( name === 'menu' ) this._renderMenu();
		if ( name === 'garage' ) this._renderGarage();

	}

	showLoading( msg ) {

		document.getElementById( 'screen-loading' ).style.display = 'flex';
		document.getElementById( 'loading-msg' ).textContent = msg || 'Loading…';

	}

	hideLoading() {

		document.getElementById( 'screen-loading' ).style.display = 'none';

	}

	showResults( results, trackIndex ) {

		const d = Progression.load();
		const rec = d.trackRecords[ trackIndex ];
		const playerResult = results.find( r => r.isPlayer );
		const credits = playerResult ? ( [ 1500, 900, 500, 250, 100 ][ playerResult.position ] || 100 ) + ( playerResult.kills || 0 ) * 200 : 0;

		const el = document.getElementById( 'screen-results' );
		el.style.display = 'flex';

		const list = results.map( ( r, i ) => {

			const suffix = [ 'st', 'nd', 'rd', 'th', 'th' ][ Math.min( i, 4 ) ];
			const name = CAR_CATALOG.find( c => c.model === r.vehicle.carId )?.name || r.vehicle.carId;
			const you = r.isPlayer ? ' <span class="you">(YOU)</span>' : '';
			return `<div class="result-row ${ r.isPlayer ? 'player' : '' }">
				<span class="result-pos">${ i + 1 }${ suffix }</span>
				<span class="result-name">${ name }${ you }</span>
				<span class="result-time">${ r.finishTime ? formatTime( r.finishTime ) : '—' }</span>
			</div>`;

		} ).join( '' );

		document.getElementById( 'results-list' ).innerHTML = list;
		document.getElementById( 'results-credits' ).textContent = `+${ credits } credits`;
		document.getElementById( 'results-total' ).textContent = `Total: ${ d.credits } credits`;

	}

	_renderMenu() {

		const d = Progression.load();
		document.getElementById( 'menu-credits' ).textContent = d.credits + ' credits';

		// Track buttons
		const trackList = document.getElementById( 'menu-track-list' );
		trackList.innerHTML = '';

		TRACKS.forEach( ( t, i ) => {

			const btn = document.createElement( 'button' );
			btn.className = 'track-btn' + ( d.selectedTrack === i ? ' selected' : '' );
			const rec = d.trackRecords[ i ];
			const best = rec?.bestLap ? formatTime( rec.bestLap ) : '—';
			btn.innerHTML = `<strong>${ t.name }</strong><br><small>${ t.description }</small><br><small>Best: ${ best }</small>`;
			btn.onclick = () => {

				Progression.selectTrack( i );
				this._renderMenu();

			};
			trackList.appendChild( btn );

		} );

	}

	_renderGarage() {

		const d = Progression.load();
		document.getElementById( 'garage-credits' ).textContent = d.credits + ' credits';

		const carList = document.getElementById( 'garage-car-list' );
		carList.innerHTML = '';

		for ( const car of CAR_CATALOG ) {

			const owned = d.cars[ car.id ]?.owned;
			const selected = d.selectedCar === car.id;
			const card = document.createElement( 'div' );
			card.className = 'car-card' + ( selected ? ' selected' : '' ) + ( ! owned ? ' locked' : '' );

			const ups = d.upgrades[ car.id ] || { engine: 0, armor: 0, weapon: 0 };

			card.innerHTML = `
				<div class="car-name">${ car.name }</div>
				<div class="car-desc">${ car.description }</div>
				<div class="car-stats">
					<div class="stat-bar"><span>Speed</span><meter min="0" max="10" value="${ Math.round( car.baseSpeed * 6 + ups.engine * 1 ) }"></meter></div>
					<div class="stat-bar"><span>Armor</span><meter min="0" max="10" value="${ Math.round( car.baseArmor * 6 + ups.armor * 1 ) }"></meter></div>
					<div class="stat-bar"><span>Weapon</span><meter min="0" max="10" value="${ Math.round( 3 + ups.weapon * 2 ) }"></meter></div>
				</div>
				${ ! owned
					? `<button class="btn-buy" data-car="${ car.id }">Buy ${ car.price } ⬡</button>`
					: selected
						? '<div class="car-badge">SELECTED</div>'
						: `<button class="btn-select" data-car="${ car.id }">Select</button>` }
				${ owned ? this._upgradeButtons( car.id, ups, d.credits ) : '' }
			`;

			carList.appendChild( card );

		}

		// Bind events
		document.querySelectorAll( '.btn-buy' ).forEach( btn => {

			btn.onclick = () => {

				const result = Progression.buyCar( btn.dataset.car );
				if ( ! result.ok ) this._flash( 'Not enough credits!' );
				else {

					Progression.selectCar( btn.dataset.car );
					this._renderGarage();

				}

			};

		} );

		document.querySelectorAll( '.btn-select' ).forEach( btn => {

			btn.onclick = () => {

				Progression.selectCar( btn.dataset.car );
				this._renderGarage();

			};

		} );

		document.querySelectorAll( '.btn-upgrade' ).forEach( btn => {

			btn.onclick = () => {

				const result = Progression.buyUpgrade( btn.dataset.car, btn.dataset.slot );
				if ( ! result.ok ) this._flash( 'Not enough credits!' );
				else this._renderGarage();

			};

		} );

	}

	_upgradeButtons( carId, ups, credits ) {

		return [ 'engine', 'armor', 'weapon' ].map( slot => {

			const level = ups[ slot ];
			const cost = getUpgradeCost( slot, level );
			const label = getUpgradeLabel( slot, level );
			const disabled = cost === null || credits < cost ? 'disabled' : '';
			const costText = cost !== null ? `${ cost } ⬡` : 'MAX';
			return `<button class="btn-upgrade" data-car="${ carId }" data-slot="${ slot }" ${ disabled }>
				${ label } · ${ costText }
			</button>`;

		} ).join( '' );

	}

	_flash( msg ) {

		const el = document.getElementById( 'garage-flash' );
		if ( ! el ) return;
		el.textContent = msg;
		el.classList.add( 'show' );
		clearTimeout( this._flashTimeout );
		this._flashTimeout = setTimeout( () => el.classList.remove( 'show' ), 2000 );

	}

	_inject() {

		const style = document.createElement( 'style' );
		style.textContent = `
			.screen {
				position: absolute;
				inset: 0;
				display: none;
				flex-direction: column;
				align-items: center;
				justify-content: center;
				background: rgba(10,14,20,0.92);
				color: #fff;
				font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
				z-index: 100;
				overflow-y: auto;
			}
			.screen h1 {
				font-size: clamp(32px, 6vw, 72px);
				margin: 0 0 8px;
				letter-spacing: 0.05em;
				color: #ffcc00;
				text-shadow: 0 0 30px rgba(255,200,0,0.5);
			}
			.screen h2 { font-size: 22px; margin: 0 0 24px; opacity: 0.7; font-weight: 400; }
			.btn {
				padding: 14px 32px;
				font-size: 18px;
				font-weight: 700;
				border: none;
				border-radius: 10px;
				cursor: pointer;
				letter-spacing: 0.05em;
				transition: transform 0.1s, box-shadow 0.1s;
			}
			.btn:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0,0,0,0.4); }
			.btn:active { transform: translateY(0); }
			.btn-primary { background: #ffcc00; color: #111; }
			.btn-secondary { background: rgba(255,255,255,0.12); color: #fff; border: 1px solid rgba(255,255,255,0.2); }
			.btn-danger { background: #cc2200; color: #fff; }
			#screen-loading { background: #0a0e14; }
			#screen-loading p { font-size: 22px; opacity: 0.8; }
			.loading-dots::after {
				content: '...';
				animation: dots 1.5s steps(4, end) infinite;
			}
			@keyframes dots { 0%, 20% { content: ''; } 40% { content: '.'; } 60% { content: '..'; } 80%, 100% { content: '...'; } }
			/* Menu */
			#menu-credits { font-size: 20px; color: #ffcc00; margin-bottom: 24px; }
			#menu-track-list { display: flex; gap: 12px; flex-wrap: wrap; justify-content: center; margin-bottom: 24px; }
			.track-btn {
				background: rgba(255,255,255,0.08);
				border: 2px solid rgba(255,255,255,0.15);
				border-radius: 12px;
				color: #fff;
				padding: 14px 18px;
				min-width: 160px;
				cursor: pointer;
				font-size: 14px;
				line-height: 1.5;
				text-align: left;
				transition: border-color 0.2s;
			}
			.track-btn.selected { border-color: #ffcc00; background: rgba(255,200,0,0.1); }
			.track-btn:hover { border-color: rgba(255,255,255,0.4); }
			/* Garage */
			#garage-car-list { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; max-width: 900px; width: 100%; padding: 0 16px; margin-bottom: 16px; }
			.car-card { background: rgba(255,255,255,0.07); border: 2px solid rgba(255,255,255,0.15); border-radius: 14px; padding: 16px; transition: border-color 0.2s; }
			.car-card.selected { border-color: #ffcc00; }
			.car-card.locked { opacity: 0.6; }
			.car-name { font-size: 18px; font-weight: 700; margin-bottom: 4px; }
			.car-desc { font-size: 12px; opacity: 0.6; margin-bottom: 10px; }
			.car-stats { margin-bottom: 12px; }
			.stat-bar { display: flex; align-items: center; gap: 8px; font-size: 12px; margin-bottom: 4px; }
			.stat-bar span { width: 50px; opacity: 0.7; }
			.stat-bar meter { flex: 1; }
			.car-badge { display: inline-block; background: #ffcc00; color: #111; font-size: 11px; font-weight: 700; border-radius: 4px; padding: 2px 8px; letter-spacing: 0.1em; }
			.btn-buy, .btn-select { display: block; width: 100%; padding: 8px; font-size: 13px; font-weight: 700; border: none; border-radius: 8px; cursor: pointer; margin-bottom: 8px; }
			.btn-buy { background: #ffcc00; color: #111; }
			.btn-select { background: rgba(255,255,255,0.15); color: #fff; }
			.btn-upgrade { display: block; width: 100%; padding: 6px 8px; font-size: 11px; border: 1px solid rgba(255,255,255,0.2); border-radius: 6px; cursor: pointer; background: rgba(255,255,255,0.07); color: #fff; margin-top: 4px; text-align: left; }
			.btn-upgrade:disabled { opacity: 0.35; cursor: not-allowed; }
			#garage-flash { position: fixed; top: 20px; left: 50%; transform: translateX(-50%); background: #cc2200; color: #fff; padding: 10px 20px; border-radius: 8px; font-size: 14px; font-weight: 700; opacity: 0; transition: opacity 0.3s; pointer-events: none; z-index: 200; }
			#garage-flash.show { opacity: 1; }
			/* Results */
			#results-list { width: 100%; max-width: 500px; margin: 16px 0; }
			.result-row { display: flex; gap: 16px; align-items: center; padding: 10px 16px; border-bottom: 1px solid rgba(255,255,255,0.1); }
			.result-row.player { background: rgba(255,200,0,0.1); border-radius: 8px; }
			.result-pos { font-size: 22px; font-weight: 900; width: 40px; }
			.result-name { flex: 1; font-size: 16px; }
			.you { color: #ffcc00; font-size: 12px; }
			.result-time { font-variant-numeric: tabular-nums; opacity: 0.8; }
			#results-credits { font-size: 26px; font-weight: 700; color: #ffcc00; margin: 16px 0 4px; }
			#results-total { font-size: 14px; opacity: 0.7; margin-bottom: 20px; }
			.results-buttons { display: flex; gap: 12px; }
		`;
		document.head.appendChild( style );

		// Loading screen
		this._createDiv( 'screen-loading', 'screen', `
			<h1>⚡ CHROME RACERS ⚡</h1>
			<p id="loading-msg" class="loading-dots">Loading</p>
		` );

		// Menu screen
		this._createDiv( 'screen-menu', 'screen', `
			<h1>⚡ CHROME RACERS ⚡</h1>
			<h2>Rock &amp; Roll Racing</h2>
			<div id="menu-credits">0 credits</div>
			<div id="menu-track-list"></div>
			<div style="display:flex;gap:12px;">
				<button class="btn btn-primary" id="menu-start">RACE!</button>
				<button class="btn btn-secondary" id="menu-garage">Garage</button>
			</div>
		` );

		// Garage screen
		this._createDiv( 'screen-garage', 'screen', `
			<h1>GARAGE</h1>
			<div id="garage-credits" style="color:#ffcc00;font-size:18px;margin-bottom:16px;">0 credits</div>
			<div id="garage-car-list"></div>
			<div id="garage-flash"></div>
			<div style="display:flex;gap:12px;margin-top:8px;">
				<button class="btn btn-primary" id="garage-race">RACE!</button>
				<button class="btn btn-secondary" id="garage-back">Back</button>
			</div>
		` );

		// Results screen
		this._createDiv( 'screen-results', 'screen', `
			<h1>RESULTS</h1>
			<div id="results-list"></div>
			<div id="results-credits">+0 credits</div>
			<div id="results-total"></div>
			<div class="results-buttons">
				<button class="btn btn-primary" id="results-again">Race Again</button>
				<button class="btn btn-secondary" id="results-garage">Garage</button>
				<button class="btn btn-secondary" id="results-menu">Menu</button>
			</div>
		` );

		// Wire up buttons
		document.getElementById( 'menu-start' ).onclick = () => this._requestRace();
		document.getElementById( 'menu-garage' ).onclick = () => this.show( 'garage' );
		document.getElementById( 'garage-race' ).onclick = () => this._requestRace();
		document.getElementById( 'garage-back' ).onclick = () => this.show( 'menu' );
		document.getElementById( 'results-again' ).onclick = () => this._requestRace();
		document.getElementById( 'results-garage' ).onclick = () => this.show( 'garage' );
		document.getElementById( 'results-menu' ).onclick = () => this.show( 'menu' );

	}

	_requestRace() {

		const d = Progression.load();
		if ( this.onStartRace ) this.onStartRace( d.selectedTrack, d.selectedCar );

	}

	_createDiv( id, className, innerHTML ) {

		const div = document.createElement( 'div' );
		div.id = id;
		div.className = className;
		div.innerHTML = innerHTML;
		document.body.appendChild( div );
		return div;

	}

}
