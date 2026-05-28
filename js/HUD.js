import { formatTime } from './LapTimer.js';
import { MAX_SPEED } from './Vehicle.js';

const WEAPON_ICONS = {
	missile: '🚀',
	mine: '💣',
	oil: '🛢️',
	null: '',
};

const POSITION_SUFFIX = [ 'st', 'nd', 'rd', 'th', 'th' ];

export class HUD {

	constructor() {

		this._inject();

	}

	_inject() {

		const style = document.createElement( 'style' );
		style.textContent = `
			#hud {
				position: absolute;
				inset: 0;
				pointer-events: none;
				z-index: 20;
				font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
				color: #fff;
				text-shadow: 0 1px 4px rgba(0,0,0,0.8);
				display: none;
			}
			#hud.active { display: block; }
			#hud-top {
				position: absolute;
				top: 0; left: 0; right: 0;
				display: flex;
				justify-content: space-between;
				align-items: flex-start;
				padding: 14px 18px;
			}
			#hud-pos {
				font-size: 42px;
				font-weight: 900;
				line-height: 1;
			}
			#hud-pos sup { font-size: 20px; vertical-align: top; margin-top: 6px; }
			#hud-center {
				text-align: center;
			}
			#hud-lap { font-size: 14px; opacity: 0.8; letter-spacing: 0.1em; }
			#hud-time { font-size: 22px; font-weight: 700; font-variant-numeric: tabular-nums; }
			#hud-right { text-align: right; }
			#hud-bottom {
				position: absolute;
				bottom: 0; left: 0; right: 0;
				display: flex;
				justify-content: space-between;
				align-items: flex-end;
				padding: 14px 18px;
			}
			#hud-health-wrap {
				background: rgba(0,0,0,0.5);
				border-radius: 8px;
				padding: 8px 12px;
				backdrop-filter: blur(4px);
				min-width: 140px;
			}
			#hud-health-label { font-size: 11px; opacity: 0.7; letter-spacing: 0.1em; margin-bottom: 4px; }
			#hud-health-bar-bg {
				background: rgba(255,255,255,0.2);
				border-radius: 4px;
				height: 10px;
				overflow: hidden;
			}
			#hud-health-bar {
				height: 100%;
				border-radius: 4px;
				transition: width 0.2s, background-color 0.5s;
				background: #44ff44;
			}
			#hud-weapon-wrap {
				background: rgba(0,0,0,0.5);
				border-radius: 8px;
				padding: 8px 14px;
				backdrop-filter: blur(4px);
				text-align: center;
				min-width: 80px;
			}
			#hud-weapon-icon { font-size: 28px; line-height: 1; }
			#hud-weapon-ammo { font-size: 12px; opacity: 0.8; margin-top: 2px; }
			#hud-speed-wrap {
				position: absolute;
				bottom: 70px;
				left: 50%;
				transform: translateX(-50%);
				background: rgba(0,0,0,0.4);
				border-radius: 8px;
				padding: 6px 16px;
				backdrop-filter: blur(4px);
				text-align: center;
			}
			#hud-speed { font-size: 28px; font-weight: 700; font-variant-numeric: tabular-nums; }
			#hud-speed-label { font-size: 10px; opacity: 0.6; }
			#hud-countdown {
				position: absolute;
				inset: 0;
				display: flex;
				align-items: center;
				justify-content: center;
				font-size: 120px;
				font-weight: 900;
				pointer-events: none;
			}
			#hud-countdown.hidden { display: none; }
			#hud-message {
				position: absolute;
				top: 40%;
				left: 50%;
				transform: translateX(-50%);
				font-size: 36px;
				font-weight: 900;
				letter-spacing: 0.1em;
				text-align: center;
				pointer-events: none;
				opacity: 0;
				transition: opacity 0.3s;
			}
			#hud-message.show { opacity: 1; }
		`;
		document.head.appendChild( style );

		const hud = document.createElement( 'div' );
		hud.id = 'hud';
		hud.innerHTML = `
			<div id="hud-top">
				<div id="hud-pos">1<sup>st</sup></div>
				<div id="hud-center">
					<div id="hud-lap">LAP 1 / 3</div>
					<div id="hud-time">0:00.00</div>
				</div>
				<div id="hud-right"></div>
			</div>
			<div id="hud-bottom">
				<div id="hud-health-wrap">
					<div id="hud-health-label">HEALTH</div>
					<div id="hud-health-bar-bg"><div id="hud-health-bar" style="width:100%"></div></div>
				</div>
				<div id="hud-weapon-wrap">
					<div id="hud-weapon-icon">—</div>
					<div id="hud-weapon-ammo"></div>
				</div>
			</div>
			<div id="hud-speed-wrap">
				<div id="hud-speed">0</div>
				<div id="hud-speed-label">KM/H</div>
			</div>
			<div id="hud-countdown" class="hidden">3</div>
			<div id="hud-message"></div>
		`;
		document.body.appendChild( hud );

		this.el = hud;
		this.posEl = hud.querySelector( '#hud-pos' );
		this.lapEl = hud.querySelector( '#hud-lap' );
		this.timeEl = hud.querySelector( '#hud-time' );
		this.healthBar = hud.querySelector( '#hud-health-bar' );
		this.weaponIcon = hud.querySelector( '#hud-weapon-icon' );
		this.weaponAmmo = hud.querySelector( '#hud-weapon-ammo' );
		this.speedEl = hud.querySelector( '#hud-speed' );
		this.countdownEl = hud.querySelector( '#hud-countdown' );
		this.messageEl = hud.querySelector( '#hud-message' );
		this._msgTimeout = null;

	}

	show() { this.el.classList.add( 'active' ); }
	hide() { this.el.classList.remove( 'active' ); }

	showCountdown( n ) {

		this.countdownEl.classList.remove( 'hidden' );
		this.countdownEl.textContent = n > 0 ? n : 'GO!';
		clearTimeout( this._cdTimeout );
		this._cdTimeout = setTimeout( () => {
			if ( n <= 0 ) this.countdownEl.classList.add( 'hidden' );
		}, n > 0 ? 800 : 600 );

	}

	showMessage( text, duration = 2000 ) {

		this.messageEl.textContent = text;
		this.messageEl.classList.add( 'show' );
		clearTimeout( this._msgTimeout );
		this._msgTimeout = setTimeout( () => this.messageEl.classList.remove( 'show' ), duration );

	}

	update( vehicle, raceManager ) {

		if ( ! vehicle || ! raceManager ) return;

		// Position
		const standing = raceManager.getPlayerStanding();
		if ( standing ) {

			const pos = standing.position;
			const suffix = POSITION_SUFFIX[ Math.min( pos - 1, 4 ) ];
			this.posEl.innerHTML = `${ pos }<sup>${ suffix }</sup>`;

			// Lap
			const laps = Math.min( standing.laps + 1, raceManager.totalLaps );
			this.lapEl.textContent = `LAP ${ laps } / ${ raceManager.totalLaps }`;

		}

		// Time
		this.timeEl.textContent = formatTime( raceManager.raceTime );

		// Health
		const hp = vehicle.health / vehicle.maxHealthActual;
		const pct = Math.max( 0, Math.round( hp * 100 ) );
		this.healthBar.style.width = pct + '%';
		const hue = Math.round( hp * 120 );
		this.healthBar.style.backgroundColor = `hsl(${ hue }, 80%, 45%)`;

		// Weapon
		if ( vehicle.weapon ) {

			this.weaponIcon.textContent = WEAPON_ICONS[ vehicle.weapon.type ] || '?';
			this.weaponAmmo.textContent = 'x' + vehicle.weapon.ammo;

		} else {

			this.weaponIcon.textContent = '—';
			this.weaponAmmo.textContent = '';

		}

		// Speed
		const kmh = Math.round( Math.abs( vehicle.linearSpeed / MAX_SPEED ) * 240 );
		this.speedEl.textContent = kmh;

	}

}
