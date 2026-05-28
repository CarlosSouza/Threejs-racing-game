import * as THREE from 'three';

const MISSILE_SPEED = 12;
const MISSILE_LIFE = 3.0;
const MISSILE_DAMAGE = 35;
const MINE_LIFE = 20.0;
const MINE_DAMAGE = 50;
const MINE_TRIGGER_RADIUS = 1.2;
const OIL_LIFE = 8.0;
const OIL_TRIGGER_RADIUS = 1.5;
const PICKUP_RADIUS = 1.8;
const PICKUP_RESPAWN = 10.0;
const HIT_RADIUS = 1.0;

const _forward = new THREE.Vector3();
const _diff = new THREE.Vector3();

const WEAPON_TYPES = [ 'missile', 'mine', 'oil' ];

function randomWeapon( tier ) {

	if ( tier === 0 ) return 'missile';
	return WEAPON_TYPES[ Math.floor( Math.random() * Math.min( WEAPON_TYPES.length, tier + 2 ) ) ];

}

// Spinning pickup cube geometry
function makePickupMesh() {

	const geo = new THREE.BoxGeometry( 0.8, 0.8, 0.8 );
	const mat = new THREE.MeshStandardMaterial( {
		color: 0xffdd00,
		emissive: 0xff8800,
		emissiveIntensity: 0.5,
		metalness: 0.5,
		roughness: 0.3,
	} );
	return new THREE.Mesh( geo, mat );

}

function makeMissileMesh() {

	const geo = new THREE.CylinderGeometry( 0.1, 0.1, 0.6, 6 );
	const mat = new THREE.MeshStandardMaterial( { color: 0xff4400, emissive: 0xff2200, emissiveIntensity: 0.8 } );
	const m = new THREE.Mesh( geo, mat );
	m.rotation.x = Math.PI / 2;
	return m;

}

function makeMineMesh() {

	const geo = new THREE.SphereGeometry( 0.3, 8, 6 );
	const mat = new THREE.MeshStandardMaterial( { color: 0x222222, metalness: 0.9 } );
	return new THREE.Mesh( geo, mat );

}

function makeOilMesh() {

	const geo = new THREE.CylinderGeometry( 0.6, 0.6, 0.05, 12 );
	const mat = new THREE.MeshStandardMaterial( { color: 0x111111, transparent: true, opacity: 0.7, roughness: 1 } );
	return new THREE.Mesh( geo, mat );

}

export class WeaponSystem {

	constructor( scene ) {

		this.scene = scene;
		this.projectiles = [];
		this.pickups = [];
		this.onExplosion = null; // fn(position)

	}

	initPickups( waypoints, count = 7 ) {

		const step = Math.max( 1, Math.floor( waypoints.length / count ) );

		for ( let i = 0; i < count; i ++ ) {

			const wp = waypoints[ ( i * step ) % waypoints.length ];
			const mesh = makePickupMesh();
			mesh.position.set( wp.x, 0.5, wp.z );
			mesh.castShadow = true;
			this.scene.add( mesh );

			this.pickups.push( {
				position: new THREE.Vector3( wp.x, 0, wp.z ),
				mesh,
				active: true,
				respawnTimer: 0,
			} );

		}

	}

	fire( fromVehicle, type ) {

		_forward.set( 0, 0, 1 ).applyQuaternion( fromVehicle.container.quaternion );
		const pos = fromVehicle.spherePos.clone();
		pos.addScaledVector( _forward, 1.2 );
		pos.y += 0.2;

		if ( type === 'missile' ) {

			const mesh = makeMissileMesh();
			mesh.position.copy( pos );
			mesh.quaternion.copy( fromVehicle.container.quaternion );
			this.scene.add( mesh );

			this.projectiles.push( {
				type: 'missile',
				mesh,
				position: pos.clone(),
				velocity: _forward.clone().multiplyScalar( MISSILE_SPEED ),
				life: MISSILE_LIFE,
				owner: fromVehicle,
				damage: MISSILE_DAMAGE * fromVehicle.weaponDamageMultiplier,
			} );

		} else if ( type === 'mine' ) {

			const behindPos = fromVehicle.spherePos.clone();
			behindPos.addScaledVector( _forward, - 1.2 );
			behindPos.y = 0.3;

			const mesh = makeMineMesh();
			mesh.position.copy( behindPos );
			this.scene.add( mesh );

			this.projectiles.push( {
				type: 'mine',
				mesh,
				position: behindPos.clone(),
				velocity: new THREE.Vector3(),
				life: MINE_LIFE,
				owner: fromVehicle,
				damage: MINE_DAMAGE * fromVehicle.weaponDamageMultiplier,
			} );

		} else if ( type === 'oil' ) {

			const behindPos = fromVehicle.spherePos.clone();
			behindPos.addScaledVector( _forward, - 1.0 );
			behindPos.y = 0.05;

			const mesh = makeOilMesh();
			mesh.position.copy( behindPos );
			this.scene.add( mesh );

			this.projectiles.push( {
				type: 'oil',
				mesh,
				position: behindPos.clone(),
				velocity: new THREE.Vector3(),
				life: OIL_LIFE,
				owner: fromVehicle,
				damage: 0,
			} );

		}

	}

	update( dt, vehicles ) {

		// Update projectiles
		for ( let i = this.projectiles.length - 1; i >= 0; i -- ) {

			const p = this.projectiles[ i ];
			p.life -= dt;

			if ( p.life <= 0 ) {

				this.scene.remove( p.mesh );
				this.projectiles.splice( i, 1 );
				continue;

			}

			if ( p.type === 'missile' ) {

				p.position.addScaledVector( p.velocity, dt );
				p.mesh.position.copy( p.position );

			}

			const triggerR = p.type === 'mine' ? MINE_TRIGGER_RADIUS : p.type === 'oil' ? OIL_TRIGGER_RADIUS : HIT_RADIUS;

			for ( const v of vehicles ) {

				if ( v === p.owner || v.isDestroyed ) continue;

				_diff.subVectors( v.spherePos, p.position );
				const dist = _diff.length();

				if ( dist < triggerR ) {

					if ( p.type === 'oil' ) {

						v.applyOilSlick();

					} else {

						v.takeDamage( p.damage );
						if ( this.onExplosion ) this.onExplosion( p.position.clone() );

					}

					this.scene.remove( p.mesh );
					this.projectiles.splice( i, 1 );
					break;

				}

			}

		}

		// Rotate pickups and check vehicle proximity
		for ( const pickup of this.pickups ) {

			if ( ! pickup.active ) {

				pickup.respawnTimer -= dt;
				if ( pickup.respawnTimer <= 0 ) {

					pickup.active = true;
					pickup.mesh.visible = true;

				}

				continue;

			}

			pickup.mesh.rotation.y += dt * 1.5;
			pickup.mesh.position.y = 0.5 + Math.sin( Date.now() * 0.002 ) * 0.1;

			for ( const v of vehicles ) {

				if ( v.isDestroyed ) continue;

				_diff.subVectors( v.spherePos, pickup.position );
				_diff.y = 0;
				if ( _diff.length() < PICKUP_RADIUS ) {

					const tier = v.weaponDamageMultiplier > 1.5 ? 2 : v.weaponDamageMultiplier > 1.0 ? 1 : 0;
					const type = randomWeapon( tier );
					const ammo = type === 'missile' ? 2 : 1;
					v.pickupWeapon( type, ammo );

					pickup.active = false;
					pickup.mesh.visible = false;
					pickup.respawnTimer = PICKUP_RESPAWN;
					break;

				}

			}

		}

	}

	dispose() {

		for ( const p of this.projectiles ) this.scene.remove( p.mesh );
		for ( const pk of this.pickups ) this.scene.remove( pk.mesh );
		this.projectiles = [];
		this.pickups = [];

	}

}
