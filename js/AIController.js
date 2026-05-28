import * as THREE from 'three';

const _toTarget = new THREE.Vector3();
const _forward = new THREE.Vector3();
const _toVehicle = new THREE.Vector3();

const WAYPOINT_REACH_RADIUS = 3.5;
const STEER_GAIN = 3.0;
const LOOK_AHEAD = 2;

export class AIController {

	constructor( vehicle, waypoints, difficulty ) {

		this.vehicle = vehicle;
		this.waypoints = waypoints;
		this.difficulty = difficulty || 'medium';
		this.wpIndex = 0;

		this.stuckTimer = 0;
		this.stuckCheckTimer = 0;
		this.prevPos = vehicle.spherePos.clone();
		this.reverseTimer = 0;

		this.fireTimer = this._nextFireDelay();
		this.leaderProgress = 0;

	}

	_nextFireDelay() {

		const base = { easy: 8, medium: 5, hard: 3 }[ this.difficulty ] || 5;
		return base + Math.random() * base;

	}

	update( dt, allVehicles, weaponSystem ) {

		const vehicle = this.vehicle;
		if ( vehicle.isDestroyed ) return;

		const pos = vehicle.spherePos;

		// Find nearest waypoint ahead
		if ( this.waypoints.length === 0 ) return;

		// Check waypoint advance
		const target = this.waypoints[ this.wpIndex ];
		const dx = pos.x - target.x;
		const dz = pos.z - target.z;
		const distSq = dx * dx + dz * dz;

		if ( distSq < WAYPOINT_REACH_RADIUS * WAYPOINT_REACH_RADIUS ) {

			this.wpIndex = ( this.wpIndex + LOOK_AHEAD ) % this.waypoints.length;

		}

		// Compute steering toward target waypoint
		const nextTarget = this.waypoints[ this.wpIndex ];
		_toTarget.set( nextTarget.x - pos.x, 0, nextTarget.z - pos.z ).normalize();
		_forward.set( 0, 0, 1 ).applyQuaternion( vehicle.container.quaternion );

		const cross = _forward.x * _toTarget.z - _forward.z * _toTarget.x;
		let steer = THREE.MathUtils.clamp( - cross * STEER_GAIN, - 1, 1 );

		// Rubber-band throttle based on gap to leader
		const myProgress = this.wpIndex;
		const leaderDiff = this.leaderProgress - myProgress;
		const diffScale = { easy: 0.5, medium: 0.25, hard: 0.1 }[ this.difficulty ] || 0.25;
		const baseThrottle = { easy: 0.75, medium: 0.9, hard: 1.0 }[ this.difficulty ] || 0.9;
		let throttle = THREE.MathUtils.clamp( baseThrottle + leaderDiff * diffScale, 0.3, 1.15 );

		// Stuck detection
		this.stuckCheckTimer += dt;
		if ( this.stuckCheckTimer > 2.0 ) {

			this.stuckCheckTimer = 0;
			const moved = pos.distanceTo( this.prevPos );
			if ( moved < 0.5 && vehicle.linearSpeed > 0.01 ) {

				this.stuckTimer += 1;

			} else {

				this.stuckTimer = 0;

			}

			this.prevPos.copy( pos );

		}

		// Reverse if stuck
		if ( this.reverseTimer > 0 ) {

			this.reverseTimer -= dt;
			throttle = - 0.5;
			steer = - steer;

		} else if ( this.stuckTimer > 1 ) {

			this.reverseTimer = 1.5;
			this.stuckTimer = 0;

		}

		// Weapon firing
		if ( this.difficulty !== 'easy' && vehicle.canFire() ) {

			this.fireTimer -= dt;
			if ( this.fireTimer <= 0 ) {

				// Find nearest vehicle to fire at
				let nearest = null;
				let nearestDist = 20;

				for ( const other of allVehicles ) {

					if ( other === vehicle || other.isDestroyed ) continue;

					_toVehicle.subVectors( other.spherePos, pos );
					const dist = _toVehicle.length();
					if ( dist < nearestDist ) {

						// Check if roughly in front
						_toVehicle.divideScalar( dist );
						const dot = _forward.dot( _toVehicle );
						if ( dot > 0.5 ) {

							nearest = other;
							nearestDist = dist;

						}

					}

				}

				if ( nearest !== null && weaponSystem ) {

					const type = vehicle.consumeAmmo();
					if ( type ) weaponSystem.fire( vehicle, type );

				}

				this.fireTimer = this._nextFireDelay();

			}

		}

		vehicle.update( dt, { x: steer, z: throttle, touchActive: false, fire: false } );

	}

}
