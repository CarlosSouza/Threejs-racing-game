import * as THREE from 'three';

const _tmp = new THREE.Vector3();

export class RaceManager {

	constructor( vehicles, waypoints, totalLaps ) {

		this.vehicles = vehicles;
		this.waypoints = waypoints;
		this.totalLaps = totalLaps;

		this.wpCount = waypoints.length;
		this.raceTime = 0;
		this.countdownTime = 3.0;
		this.started = false;
		this.finished = false;

		this.standings = vehicles.map( ( v, i ) => ( {
			vehicle: v,
			index: i,
			laps: 0,
			wpIndex: 0,
			lastWpIndex: 0,
			distanceAlong: 0,
			position: i + 1,
			finished: false,
			finishTime: null,
			kills: 0,
			bestLap: null,
			lapStart: null,
		} ) );

		this.finishOrder = [];
		this.onFinished = null;
		this.onCountdownTick = null;
		this.onLap = null;

	}

	start() {

		for ( const s of this.standings ) s.lapStart = 0;
		this.started = true;
		this.countdownTime = 0;

	}

	update( dt ) {

		if ( this.finished ) return;

		if ( ! this.started ) {

			const prev = Math.ceil( this.countdownTime );
			this.countdownTime -= dt;
			const curr = Math.ceil( this.countdownTime );

			if ( curr !== prev && this.onCountdownTick ) this.onCountdownTick( curr );

			if ( this.countdownTime <= 0 ) {

				this.start();

			}

			return;

		}

		this.raceTime += dt;

		for ( const s of this.standings ) {

			if ( s.finished ) continue;

			const pos = s.vehicle.spherePos;

			// Find nearest waypoint
			let best = s.wpIndex;
			let bestDist = Infinity;

			for ( let delta = - 1; delta <= 3; delta ++ ) {

				const idx = ( s.wpIndex + delta + this.wpCount ) % this.wpCount;
				const wp = this.waypoints[ idx ];
				_tmp.set( wp.x - pos.x, 0, wp.z - pos.z );
				const d = _tmp.lengthSq();
				if ( d < bestDist ) {

					bestDist = d;
					best = idx;

				}

			}

			// Detect waypoint advance and lap completion
			if ( best !== s.wpIndex ) {

				const oldIdx = s.wpIndex;
				s.wpIndex = best;

				// Lap: wrapped around from near end to near start
				if ( oldIdx > this.wpCount * 0.8 && best < this.wpCount * 0.2 ) {

					s.laps ++;
					const lapTime = this.raceTime - ( s.lapStart || 0 );
					s.lapStart = this.raceTime;
					if ( s.bestLap === null || lapTime < s.bestLap ) s.bestLap = lapTime;
					if ( this.onLap ) this.onLap( s.index, s.laps, lapTime );

					if ( s.laps >= this.totalLaps ) {

						s.finished = true;
						s.finishTime = this.raceTime;
						this.finishOrder.push( s.index );

						if ( this.onFinished ) this.onFinished( s.index, this.finishOrder.length - 1, s );

						if ( this.finishOrder.length === this.standings.length ) {

							this.finished = true;

						}

					}

				}

			}

			s.distanceAlong = s.laps * this.wpCount + s.wpIndex;

		}

		// Sort standings by distance
		const sorted = [ ...this.standings ].sort( ( a, b ) => b.distanceAlong - a.distanceAlong );
		for ( let i = 0; i < sorted.length; i ++ ) {

			sorted[ i ].position = i + 1;

		}

		// Update AI rubber-band info
		const leaderProgress = sorted[ 0 ].wpIndex;
		return leaderProgress;

	}

	getPlayerStanding() {

		return this.standings.find( s => s.vehicle.isPlayer );

	}

	getResults() {

		const sorted = [ ...this.standings ].sort( ( a, b ) => {

			if ( a.finished && ! b.finished ) return - 1;
			if ( ! a.finished && b.finished ) return 1;
			if ( a.finished && b.finished ) return a.finishTime - b.finishTime;
			return b.distanceAlong - a.distanceAlong;

		} );

		return sorted.map( ( s, i ) => ( {
			position: i,
			vehicle: s.vehicle,
			isPlayer: s.vehicle.isPlayer,
			finishTime: s.finishTime,
			laps: s.laps,
			kills: s.kills,
			bestLap: s.bestLap,
		} ) );

	}

	recordKill( killerVehicle ) {

		const s = this.standings.find( s => s.vehicle === killerVehicle );
		if ( s ) s.kills ++;

	}

}
