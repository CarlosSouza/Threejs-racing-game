const SAVE_KEY = 'rnr.save';
const SAVE_VERSION = 1;

export const CAR_CATALOG = [
	{
		id: 'truck-yellow',
		name: 'Desert Fox',
		model: 'vehicle-truck-yellow',
		price: 0,
		baseSpeed: 1.0,
		baseArmor: 1.0,
		description: 'Balanced starter truck',
	},
	{
		id: 'truck-green',
		name: 'Iron Rhino',
		model: 'vehicle-truck-green',
		price: 1200,
		baseSpeed: 0.85,
		baseArmor: 1.4,
		description: 'Heavy armor, slower speed',
	},
	{
		id: 'truck-purple',
		name: 'Phantom',
		model: 'vehicle-truck-purple',
		price: 2000,
		baseSpeed: 1.2,
		baseArmor: 0.8,
		description: 'Fast but fragile',
	},
	{
		id: 'truck-red',
		name: 'Warlord',
		model: 'vehicle-truck-red',
		price: 3500,
		baseSpeed: 1.1,
		baseArmor: 1.15,
		description: 'Well-rounded powerhouse',
	},
];

export const UPGRADE_COSTS = {
	engine: [ 400, 900, 1800 ],
	armor:  [ 300, 700, 1400 ],
	weapon: [ 500, 1100, 2200 ],
};

const UPGRADE_LABELS = {
	engine: 'Engine',
	armor: 'Armor',
	weapon: 'Weapons',
};

function defaultSave() {

	const cars = {};
	const upgrades = {};

	for ( const car of CAR_CATALOG ) {

		cars[ car.id ] = { owned: car.price === 0, wins: 0 };
		upgrades[ car.id ] = { engine: 0, armor: 0, weapon: 0 };

	}

	return {
		version: SAVE_VERSION,
		credits: 500,
		selectedCar: 'truck-yellow',
		selectedTrack: 0,
		cars,
		upgrades,
		trackRecords: {
			0: { bestLap: null, wins: 0 },
			1: { bestLap: null, wins: 0 },
			2: { bestLap: null, wins: 0 },
		},
	};

}

let _cache = null;

export const Progression = {

	load() {

		if ( _cache ) return _cache;

		try {

			const raw = localStorage.getItem( SAVE_KEY );
			if ( raw ) {

				const data = JSON.parse( raw );
				if ( data && data.version === SAVE_VERSION ) {

					_cache = data;
					return _cache;

				}

			}

		} catch {}

		_cache = defaultSave();
		this.save();
		return _cache;

	},

	save() {

		try {

			localStorage.setItem( SAVE_KEY, JSON.stringify( _cache ) );

		} catch {}

	},

	get() {

		return this.load();

	},

	addCredits( amount ) {

		const d = this.load();
		d.credits += amount;
		this.save();

	},

	spendCredits( amount ) {

		const d = this.load();
		if ( d.credits < amount ) return false;
		d.credits -= amount;
		this.save();
		return true;

	},

	buyCar( carId ) {

		const d = this.load();
		if ( d.cars[ carId ].owned ) return { ok: false, error: 'Already owned' };

		const car = CAR_CATALOG.find( c => c.id === carId );
		if ( ! car ) return { ok: false, error: 'Unknown car' };

		if ( d.credits < car.price ) return { ok: false, error: 'Not enough credits' };

		d.credits -= car.price;
		d.cars[ carId ].owned = true;
		this.save();
		return { ok: true };

	},

	buyUpgrade( carId, slot ) {

		const d = this.load();
		if ( ! d.cars[ carId ] || ! d.cars[ carId ].owned ) return { ok: false, error: 'Car not owned' };

		const currentLevel = d.upgrades[ carId ][ slot ];
		if ( currentLevel >= 3 ) return { ok: false, error: 'Max level reached' };

		const cost = UPGRADE_COSTS[ slot ][ currentLevel ];
		if ( d.credits < cost ) return { ok: false, error: 'Not enough credits' };

		d.credits -= cost;
		d.upgrades[ carId ][ slot ] = currentLevel + 1;
		this.save();
		return { ok: true };

	},

	selectCar( carId ) {

		const d = this.load();
		if ( ! d.cars[ carId ]?.owned ) return false;
		d.selectedCar = carId;
		this.save();
		return true;

	},

	selectTrack( trackIndex ) {

		const d = this.load();
		d.selectedTrack = trackIndex;
		this.save();

	},

	getCarStats( carId ) {

		const d = this.load();
		const car = CAR_CATALOG.find( c => c.id === carId );
		if ( ! car ) return null;

		const ups = d.upgrades[ carId ];
		const speedMultiplier = car.baseSpeed * ( 1 + ups.engine * 0.1 );
		const armorMultiplier = car.baseArmor * ( 1 + ups.armor * 0.25 );
		const weaponDamageMult = 1 + ups.weapon * 0.4;
		const weaponTier = ups.weapon;

		return { speedMultiplier, armorMultiplier, weaponDamageMult, weaponTier };

	},

	recordRaceResult( trackIndex, position, lapTime, kills ) {

		const d = this.load();
		const rewards = [ 1500, 900, 500, 250, 100 ];
		const credits = ( rewards[ position ] ?? 100 ) + kills * 200;

		d.credits += credits;
		const car = d.selectedCar;
		if ( position === 0 ) d.cars[ car ].wins = ( d.cars[ car ].wins || 0 ) + 1;

		const rec = d.trackRecords[ trackIndex ] || { bestLap: null, wins: 0 };
		if ( position === 0 ) rec.wins = ( rec.wins || 0 ) + 1;
		if ( lapTime !== null && ( rec.bestLap === null || lapTime < rec.bestLap ) ) rec.bestLap = lapTime;
		d.trackRecords[ trackIndex ] = rec;

		this.save();
		return { credits, position };

	},

	reset() {

		_cache = null;
		localStorage.removeItem( SAVE_KEY );

	},

};

export function getUpgradeLabel( slot, level ) {

	const label = UPGRADE_LABELS[ slot ] || slot;
	const stars = '★'.repeat( level ) + '☆'.repeat( 3 - level );
	return `${ label } ${ stars }`;

}

export function getUpgradeCost( slot, currentLevel ) {

	if ( currentLevel >= 3 ) return null;
	return UPGRADE_COSTS[ slot ][ currentLevel ];

}
