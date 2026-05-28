import * as THREE from 'three';
import { rigidBody } from 'crashcat';

const _tmpVec = new THREE.Vector3();
const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _zAxis = new THREE.Vector3();
const _newZ = new THREE.Vector3();
const _mat4 = new THREE.Matrix4();
const _quat = new THREE.Quaternion();
const _up = new THREE.Vector3( 0, 1, 0 );

const SPEED_SCALE = 12.5;
const LINEAR_DAMP = 0.1;
export const MAX_SPEED = 1.5;

function lerpAngle( a, b, t ) {

	let diff = b - a;
	while ( diff > Math.PI ) diff -= Math.PI * 2;
	while ( diff < -Math.PI ) diff += Math.PI * 2;
	return a + diff * t;

}

export class Vehicle {

	constructor() {

		this.linearSpeed = 0;
		this.angularSpeed = 0;
		this.acceleration = 0;

		this.spherePos = new THREE.Vector3( 3.5, 0.5, 5 );
		this.sphereVel = new THREE.Vector3();

		this.rigidBody = null;
		this.physicsWorld = null;

		this.modelVelocity = new THREE.Vector3();
		this.prevModelPos = new THREE.Vector3( 3.5, 0, 5 );

		this.container = new THREE.Group();
		this.bodyNode = null;
		this.wheels = [];
		this.wheelFL = null;
		this.wheelFR = null;
		this.wheelBL = null;
		this.wheelBR = null;

		this.inputX = 0;
		this.inputZ = 0;

		this.driftIntensity = 0;

		// Combat / health
		this.maxHealth = 100;
		this.health = 100;
		this.weapon = null;      // { type: 'missile'|'mine'|'oil', ammo: N }
		this.weaponCooldown = 0; // seconds

		this.isDestroyed = false;
		this.invincibleTimer = 0;
		this.respawnTimer = 0;
		this.flashTimer = 0;

		// Role
		this.isPlayer = false;
		this.carId = 'truck-yellow';
		this.spawnPosition = new THREE.Vector3( 3.5, 0.5, 5 );
		this.spawnAngle = 0;

		// Stat multipliers (set from car catalog + upgrades)
		this.speedMultiplier = 1.0;
		this.armorMultiplier = 1.0;
		this.weaponDamageMultiplier = 1.0;

		// Callbacks
		this.onDestroyed = null;  // fn(vehicle)
		this.onLapComplete = null;

		// Oil slick status
		this.isSlipping = false;
		this.slipTimer = 0;

	}

	get maxSpeed() {

		return MAX_SPEED * this.speedMultiplier;

	}

	get maxHealthActual() {

		return Math.round( this.maxHealth * this.armorMultiplier );

	}

	init( model ) {

		const vehicleModel = model.clone();
		this.container.add( vehicleModel );

		vehicleModel.traverse( ( child ) => {

			const name = child.name.toLowerCase();

			if ( name === 'body' ) {

				child.rotation.order = 'YXZ';
				this.bodyNode = child;

			} else if ( name.includes( 'wheel' ) ) {

				child.rotation.order = 'YXZ';
				this.wheels.push( child );

				if ( name.includes( 'front' ) && name.includes( 'left' ) ) this.wheelFL = child;
				if ( name.includes( 'front' ) && name.includes( 'right' ) ) this.wheelFR = child;
				if ( name.includes( 'back' ) && name.includes( 'left' ) ) this.wheelBL = child;
				if ( name.includes( 'back' ) && name.includes( 'right' ) ) this.wheelBR = child;

			}

			if ( child.isMesh ) {

				child.castShadow = true;
				child.receiveShadow = true;

			}

		} );

		return this.container;

	}

	update( dt, controlsInput ) {

		// Decrement timers
		if ( this.invincibleTimer > 0 ) this.invincibleTimer -= dt;
		if ( this.weaponCooldown > 0 ) this.weaponCooldown -= dt;
		if ( this.flashTimer > 0 ) {

			this.flashTimer -= dt;
			this._applyFlash();

		}

		// Oil slip: override input
		if ( this.isSlipping ) {

			this.slipTimer -= dt;
			if ( this.slipTimer <= 0 ) this.isSlipping = false;
			else controlsInput = { x: controlsInput.x + ( Math.random() - 0.5 ) * 2, z: controlsInput.z };

		}

		if ( this.isDestroyed ) {

			this.respawnTimer -= dt;
			if ( this.respawnTimer <= 0 ) this._doRespawn();
			return;

		}

		this.inputX = controlsInput.x;
		this.inputZ = controlsInput.z;

		const ms = this.maxSpeed;

		if ( controlsInput.touchActive && ( this.inputX !== 0 || this.inputZ !== 0 ) ) {

			const targetAngle = Math.atan2( this.inputX, this.inputZ );
			_quat.setFromAxisAngle( _up, targetAngle );
			this.container.quaternion.slerp( _quat, 1 - Math.exp( - 3 * dt ) );

			_forward.set( 0, 0, 1 ).applyQuaternion( this.container.quaternion );
			const cross = _forward.x * this.inputZ - _forward.z * this.inputX;
			this.inputX = THREE.MathUtils.clamp( - cross * 2, - 1, 1 );

			this.linearSpeed = THREE.MathUtils.lerp( this.linearSpeed, ms, dt * 1.5 );

		} else {

			let direction = Math.sign( this.linearSpeed );
			if ( direction === 0 ) direction = Math.abs( this.inputZ ) > 0.1 ? Math.sign( this.inputZ ) : 1;

			const steeringGrip = THREE.MathUtils.clamp( Math.abs( this.linearSpeed ), 0.2, 1.0 );

			const targetAngular = - this.inputX * steeringGrip * 4 * direction;
			this.angularSpeed = THREE.MathUtils.lerp( this.angularSpeed, targetAngular, dt * 4 );

			this.container.rotateY( this.angularSpeed * dt );

			const targetSpeed = this.inputZ;

			if ( targetSpeed < 0 && this.linearSpeed > 0.01 ) {

				this.linearSpeed = THREE.MathUtils.lerp( this.linearSpeed, 0.0, dt * 8 );

			} else if ( targetSpeed < 0 ) {

				this.linearSpeed = THREE.MathUtils.lerp( this.linearSpeed, targetSpeed / 2, dt * 2 );

			} else {

				this.linearSpeed = THREE.MathUtils.lerp( this.linearSpeed, targetSpeed * ms, dt * 1.5 );

			}

		}

		_tmpVec.set( 0, 1, 0 ).applyQuaternion( this.container.quaternion );

		if ( _tmpVec.y > 0.5 ) {

			const targetQuat = this.alignWithY( this.container.quaternion, _up );
			this.container.quaternion.slerp( targetQuat, 0.2 );

		}

		this.linearSpeed *= Math.max( 0, 1 - LINEAR_DAMP * dt );

		if ( this.rigidBody ) {

			_forward.set( 0, 0, 1 ).applyQuaternion( this.container.quaternion );
			_forward.y = 0;
			_forward.normalize();

			_right.set( 1, 0, 0 ).applyQuaternion( this.container.quaternion );
			_right.y = 0;
			_right.normalize();

			const angvel = this.rigidBody.motionProperties.angularVelocity;
			const drive = this.linearSpeed * 100 * dt;

			rigidBody.setAngularVelocity( this.physicsWorld, this.rigidBody, [
				angvel[ 0 ] + _right.x * drive,
				angvel[ 1 ],
				angvel[ 2 ] + _right.z * drive
			] );

			const pos = this.rigidBody.position;
			this.spherePos.set( pos[ 0 ], pos[ 1 ], pos[ 2 ] );

			const vel = this.rigidBody.motionProperties.linearVelocity;
			this.sphereVel.set( vel[ 0 ], vel[ 1 ], vel[ 2 ] );

		}

		this.acceleration = THREE.MathUtils.lerp(
			this.acceleration,
			this.linearSpeed + ( 0.25 * this.linearSpeed * Math.abs( this.linearSpeed ) ),
			dt
		);

		if ( this.spherePos.y < - 10 ) {

			this._doRespawn();

		}

		this.container.position.set(
			this.spherePos.x,
			this.spherePos.y - 0.5,
			this.spherePos.z
		);

		if ( dt > 0 ) {

			this.modelVelocity.subVectors( this.container.position, this.prevModelPos ).divideScalar( dt );
			this.prevModelPos.copy( this.container.position );

		}

		this.updateBody( dt );
		this.updateWheels( dt );

		this.driftIntensity = Math.abs( this.linearSpeed - this.acceleration ) +
			( this.bodyNode ? Math.abs( this.bodyNode.rotation.z ) * 2 : 0 );

	}

	takeDamage( amount ) {

		if ( this.isDestroyed || this.invincibleTimer > 0 ) return;

		const actual = amount / this.armorMultiplier;
		this.health = Math.max( 0, this.health - actual );
		this.flashTimer = 0.3;

		if ( this.health <= 0 ) {

			this.health = 0;
			this.isDestroyed = true;
			this.respawnTimer = 3.0;
			this.container.visible = false;
			if ( this.onDestroyed ) this.onDestroyed( this );

		}

	}

	pickupWeapon( type, ammo ) {

		this.weapon = { type, ammo };
		this.weaponCooldown = 0;

	}

	canFire() {

		return this.weapon !== null && this.weapon.ammo > 0 && this.weaponCooldown <= 0 && ! this.isDestroyed;

	}

	consumeAmmo() {

		if ( ! this.weapon ) return null;
		const type = this.weapon.type;
		this.weapon.ammo --;
		if ( this.weapon.ammo <= 0 ) this.weapon = null;
		this.weaponCooldown = 1.5;
		return type;

	}

	applyOilSlick() {

		this.isSlipping = true;
		this.slipTimer = 3.0;

	}

	_doRespawn() {

		const pos = this.spawnPosition;

		if ( this.rigidBody ) {

			rigidBody.setPosition( this.physicsWorld, this.rigidBody, [ pos.x, pos.y, pos.z ], false );
			rigidBody.setLinearVelocity( this.physicsWorld, this.rigidBody, [ 0, 0, 0 ] );
			rigidBody.setAngularVelocity( this.physicsWorld, this.rigidBody, [ 0, 0, 0 ] );

		}

		this.spherePos.copy( pos );
		this.sphereVel.set( 0, 0, 0 );
		this.linearSpeed = 0;
		this.angularSpeed = 0;
		this.acceleration = 0;
		this.container.rotation.set( 0, this.spawnAngle, 0 );
		this.container.quaternion.setFromEuler( this.container.rotation );

		this.health = this.maxHealthActual * 0.6;
		this.isDestroyed = false;
		this.invincibleTimer = 3.0;
		this.respawnTimer = 0;
		this.container.visible = true;
		this.isSlipping = false;

	}

	_applyFlash() {

		const on = Math.floor( this.flashTimer * 20 ) % 2 === 0;
		this.container.traverse( ( child ) => {

			if ( child.isMesh ) child.visible = on;

		} );

	}

	alignWithY( quaternion, newY ) {

		_zAxis.set( 0, 0, 1 ).applyQuaternion( quaternion );
		const xAxis = _tmpVec.crossVectors( _zAxis, newY ).negate().normalize();
		_newZ.crossVectors( xAxis, newY ).normalize();

		_mat4.makeBasis( xAxis, newY, _newZ );
		return _quat.setFromRotationMatrix( _mat4 );

	}

	updateBody( dt ) {

		if ( ! this.bodyNode ) return;

		this.bodyNode.rotation.x = lerpAngle(
			this.bodyNode.rotation.x,
			-( this.linearSpeed - this.acceleration ) / 6,
			dt * 10
		);

		this.bodyNode.rotation.z = lerpAngle(
			this.bodyNode.rotation.z,
			-( this.inputX / 5 ) * this.linearSpeed,
			dt * 5
		);

		this.bodyNode.position.y = THREE.MathUtils.lerp( this.bodyNode.position.y, 0.3, dt * 5 );

	}

	updateWheels( dt ) {

		for ( const wheel of this.wheels ) {

			wheel.rotation.x += this.acceleration;

		}

		if ( this.wheelFL ) {

			this.wheelFL.rotation.y = lerpAngle( this.wheelFL.rotation.y, -this.inputX / 1.5, dt * 10 );

		}

		if ( this.wheelFR ) {

			this.wheelFR.rotation.y = lerpAngle( this.wheelFR.rotation.y, -this.inputX / 1.5, dt * 10 );

		}

	}

}
