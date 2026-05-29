import * as THREE from 'three';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { LightProbeGrid } from 'three/addons/lighting/LightProbeGrid.js';
import {
	createWorldSettings, createWorld, addBroadphaseLayer, addObjectLayer,
	enableCollision, registerAll, updateWorld, rigidBody, box, MotionType,
} from 'crashcat';

import { ColorMapGLTFLoader, ASSETS_BASE } from './Loader.js';
import { Vehicle, MAX_SPEED } from './Vehicle.js';
import { Camera } from './Camera.js';
import { Controls } from './Controls.js';
import { buildTrack, computeSpawnPosition, computeTrackBounds, extractWaypoints } from './Track.js';
import { buildWallColliders, createSphereBody } from './Physics.js';
import { SmokeTrails } from './Particles.js';
import { DriftMarks } from './DriftMarks.js';
import { GameAudio } from './Audio.js';
import { AIController } from './AIController.js';
import { WeaponSystem } from './Weapons.js';
import { RaceManager } from './RaceManager.js';
import { HUD } from './HUD.js';
import { UI } from './UI.js';
import { Progression, CAR_CATALOG } from './Progression.js';
import { TRACKS } from './TrackData.js';

const AI_DIFFICULTIES = [ 'easy', 'medium', 'medium', 'hard' ];
const AI_MODELS = [ 'vehicle-truck-green', 'vehicle-truck-purple', 'vehicle-truck-red', 'vehicle-truck-yellow' ];
const AI_CAR_IDS = [ 'truck-green', 'truck-purple', 'truck-red', 'truck-yellow' ];

const MODEL_NAMES = [
	'vehicle-truck-yellow', 'vehicle-truck-green', 'vehicle-truck-purple', 'vehicle-truck-red',
	'track-straight', 'track-corner', 'track-bump', 'track-finish',
	'decoration-empty', 'decoration-forest', 'decoration-tents',
];

function createPhysicsWorld() {

	const worldSettings = createWorldSettings();
	worldSettings.gravity = [ 0, - 9.81, 0 ];
	const BPL_MOVING = addBroadphaseLayer( worldSettings );
	const BPL_STATIC = addBroadphaseLayer( worldSettings );
	const OL_MOVING = addObjectLayer( worldSettings, BPL_MOVING );
	const OL_STATIC = addObjectLayer( worldSettings, BPL_STATIC );
	enableCollision( worldSettings, OL_MOVING, OL_STATIC );
	enableCollision( worldSettings, OL_MOVING, OL_MOVING );
	const world = createWorld( worldSettings );
	world._OL_MOVING = OL_MOVING;
	world._OL_STATIC = OL_STATIC;
	return world;

}

export class GameState {

	constructor() {

		this.renderer = null;
		this.scene = null;
		this.cam = null;
		this.audio = null;
		this.hud = null;
		this.ui = null;
		this.controls = null;
		this.timer = null;
		this.dirLight = null;
		this.hemiLight = null;

		// Per-race state
		this.world = null;
		this.raceActive = false;
		this.raceGroup = null;    // THREE.Group holding all race scene objects
		this.raceProbes = null;   // LightProbeGrid (added to scene, not raceGroup)
		this.player = null;
		this.aiVehicles = [];
		this.aiControllers = [];
		this.particles = null;
		this.driftMarks = null;
		this.weapons = null;
		this.raceManager = null;
		this._contactListener = null;
		this._raceKills = 0;
		this._selectedTrackIndex = 0;
		this._endRaceTimer = null;

		this._forward = new THREE.Vector3();
		this._camLead = new THREE.Vector3();

	}

	async init() {

		// Renderer
		this.renderer = new THREE.WebGLRenderer( { antialias: true, outputBufferType: THREE.HalfFloatType } );
		this.renderer.setSize( window.innerWidth, window.innerHeight );
		this.renderer.setPixelRatio( window.devicePixelRatio );
		this.renderer.shadowMap.enabled = true;
		this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
		this.renderer.toneMappingExposure = 1.0;

		const bloomPass = new UnrealBloomPass( new THREE.Vector2( window.innerWidth, window.innerHeight ) );
		bloomPass.strength = 0.02;
		bloomPass.radius = 0.02;
		bloomPass.threshold = 0.5;
		this.renderer.setEffects( [ bloomPass ] );

		document.body.appendChild( this.renderer.domElement );
		window.addEventListener( 'resize', () => this.renderer.setSize( window.innerWidth, window.innerHeight ) );

		// Scene
		this.scene = new THREE.Scene();
		this.scene.background = new THREE.Color( 0xadb2ba );
		this.scene.fog = new THREE.Fog( 0xadb2ba, 30, 55 );

		this.dirLight = new THREE.DirectionalLight( 0xffffff, 3 );
		this.dirLight.position.set( 11.4, 15, - 5.3 );
		this.dirLight.castShadow = true;
		this.dirLight.shadow.mapSize.setScalar( 4096 );
		this.dirLight.shadow.camera.near = 0.5;
		this.dirLight.shadow.camera.far = 60;
		this.dirLight.shadow.radius = 4;
		this.scene.add( this.dirLight );

		this.hemiLight = new THREE.HemisphereLight( 0xc8d8e8, 0x7a8a5a, 2 );
		this.hemiLight.position.copy( this.dirLight.position );
		this.scene.add( this.hemiLight );

		// Core systems
		this.cam = new Camera();
		this.scene.add( this.cam.debug );
		this.controls = new Controls();
		this.timer = new THREE.Timer();
		this.hud = new HUD();
		this.audio = new GameAudio();
		this.audio.init( this.cam.camera );

		// UI screens
		this.ui = new UI( ( trackIdx, carId ) => this.startRace( trackIdx, carId ) );
		this.ui.showLoading( 'Initializing physics' );

		// Initialize physics WASM once
		registerAll();

		// Load 3D models
		this.ui.showLoading( 'Loading assets' );
		this.models = {};
		await this._loadModels();

		this.ui.hideLoading();
		this.ui.show( 'menu' );

		this._animate();

	}

	async _loadModels() {

		const loader = new ColorMapGLTFLoader();

		await Promise.all( MODEL_NAMES.map( name =>
			new Promise( ( resolve, reject ) => {

				loader.load( ASSETS_BASE + `models/${ name }.glb`, ( gltf ) => {

					const meshes = [];
					gltf.scene.traverse( child => {

						if ( child.isMesh ) {

							child.material.side = THREE.FrontSide;
							meshes.push( child );

						}

					} );

					if ( name.startsWith( 'vehicle-' ) ) gltf.scene.scale.setScalar( 0.5 );

					if ( meshes.length === 1 ) {

						meshes[ 0 ].removeFromParent();
						this.models[ name ] = meshes[ 0 ];

					} else {

						this.models[ name ] = gltf.scene;

					}

					resolve();

				}, undefined, reject );

			} )
		) );

	}

	_teardownRace() {

		if ( ! this.raceActive ) return;

		clearTimeout( this._endRaceTimer );
		this._endRaceTimer = null;

		// Drop reference to old physics world — GC handles cleanup
		this.world = null;

		// Remove all race scene objects via the container group
		if ( this.raceGroup ) {

			this.scene.remove( this.raceGroup );
			this.raceGroup = null;

		}

		if ( this.raceProbes ) {

			this.scene.remove( this.raceProbes );
			this.raceProbes = null;

		}

		if ( this.weapons ) {

			this.weapons.dispose();
			this.weapons = null;

		}

		this.player = null;
		this.aiVehicles = [];
		this.aiControllers = [];
		this.particles = null;
		this.driftMarks = null;
		this.raceManager = null;
		this._contactListener = null;
		this.raceActive = false;
		this._raceKills = 0;

	}

	async startRace( trackIndex, carId ) {

		this._teardownRace();
		this.ui.show( 'none' );
		this.hud.show();

		const trackDef = TRACKS[ trackIndex ] ?? TRACKS[ 0 ];
		this._selectedTrackIndex = trackIndex;
		const cells = trackDef.cells;

		// Track theme
		const fogColor = new THREE.Color( trackDef.fogColor || 0xadb2ba );
		this.scene.background = fogColor.clone();
		this.scene.fog.color.copy( fogColor );

		// A single group holds all race-specific scene objects
		this.raceGroup = new THREE.Group();
		this.scene.add( this.raceGroup );

		// New physics world for this race
		this.world = createPhysicsWorld();

		// Track bounds → resize shadow camera and fog
		const bounds = computeTrackBounds( cells );
		const hw = bounds.halfWidth;
		const hd = bounds.halfDepth;
		const groundSize = Math.max( hw, hd ) * 2 + 20;
		const shadowExtent = Math.max( hw, hd ) + 10;
		this.dirLight.shadow.camera.left = - shadowExtent;
		this.dirLight.shadow.camera.right = shadowExtent;
		this.dirLight.shadow.camera.top = shadowExtent;
		this.dirLight.shadow.camera.bottom = - shadowExtent;
		this.dirLight.shadow.camera.updateProjectionMatrix();
		this.scene.fog.near = groundSize * 0.4;
		this.scene.fog.far = groundSize * 0.8;

		// Build track into raceGroup
		buildTrack( this.raceGroup, this.models, cells );

		// Light probe grid — needs the real scene for baking, then we move it to raceGroup
		const probeH = 6;
		const probes = new LightProbeGrid(
			hw * 2, probeH, hd * 2,
			Math.max( 4, Math.round( hw / 4 ) ), 2, Math.max( 4, Math.round( hd / 4 ) ),
		);
		probes.position.set( bounds.centerX, probeH / 2, bounds.centerZ );
		this.scene.add( probes );
		probes.bake( this.renderer, this.scene, { cubemapSize: 32, near: 0.1, far: groundSize } );
		this.scene.remove( probes );
		this.raceGroup.add( probes );

		// Physics: walls + ground
		buildWallColliders( this.world, null, cells );

		const roadHalf = groundSize / 2;
		rigidBody.create( this.world, {
			shape: box.create( { halfExtents: [ roadHalf, 0.01, roadHalf ] } ),
			motionType: MotionType.STATIC,
			objectLayer: this.world._OL_STATIC,
			position: [ bounds.centerX, - 0.125, bounds.centerZ ],
			friction: 5.0,
			restitution: 0.0,
		} );

		// Spawn info
		const spawn = computeSpawnPosition( cells );
		const [ sx, sy, sz ] = spawn.position;
		const sa = spawn.angle;

		// Forward/side vectors from spawn angle
		const fwdX = Math.sin( sa ), fwdZ = Math.cos( sa );
		const sideX = fwdZ, sideZ = - fwdX;

		// Player stats
		const playerStats = Progression.getCarStats( carId );
		const playerCarDef = CAR_CATALOG.find( c => c.id === carId );
		const playerModelKey = playerCarDef?.model || 'vehicle-truck-yellow';

		// Build player
		this.player = this._buildVehicle( playerModelKey, sx, sy, sz, sa, playerStats );
		this.player.isPlayer = true;
		this.player.carId = playerModelKey;
		this.raceGroup.add( this.player.container );

		this.dirLight.target = this.player.container;

		// Build AI vehicles
		const AI_COUNT = 4;
		this.aiVehicles = [];

		for ( let i = 0; i < AI_COUNT; i ++ ) {

			const lane = ( i % 2 === 0 ? - 1 : 1 ) * 1.5;
			const row = Math.floor( i / 2 ) + 1;
			const ax = sx + sideX * lane - fwdX * row * 3;
			const az = sz + sideZ * lane - fwdZ * row * 3;

			const modelKey = AI_MODELS[ i % AI_MODELS.length ];
			const aiCarId = AI_CAR_IDS[ i % AI_CAR_IDS.length ];
			const aiStats = Progression.getCarStats( aiCarId );

			const ai = this._buildVehicle( modelKey, ax, sy, az, sa, aiStats );
			ai.isPlayer = false;
			ai.carId = modelKey;

			// Slight random speed variation per AI
			if ( ai.speedMultiplier ) ai.speedMultiplier *= 0.85 + Math.random() * 0.3;

			this.raceGroup.add( ai.container );
			this.aiVehicles.push( ai );

		}

		const allVehicles = [ this.player, ...this.aiVehicles ];

		// Weapon system
		const waypoints = extractWaypoints( cells );
		this.weapons = new WeaponSystem( this.raceGroup );
		this.weapons.initPickups( waypoints );
		this.weapons.onExplosion = ( pos ) => {

			if ( this.particles ) this.particles.emitExplosion( pos );
			if ( this.audio ) this.audio.playExplosion();

		};

		// AI controllers
		this.aiControllers = [];
		for ( let i = 0; i < this.aiVehicles.length; i ++ ) {

			const diff = AI_DIFFICULTIES[ i ] || 'medium';
			const ctrl = new AIController( this.aiVehicles[ i ], waypoints, diff );
			ctrl.wpIndex = ( i * Math.floor( waypoints.length / ( AI_COUNT + 1 ) ) ) % waypoints.length;
			this.aiControllers.push( ctrl );

		}

		// Race manager
		this.raceManager = new RaceManager( allVehicles, waypoints, trackDef.laps );
		this.raceManager.onCountdownTick = n => this.hud.showCountdown( n );
		this.raceManager.onLap = ( vIdx, lap ) => {

			if ( vIdx === 0 && lap < trackDef.laps ) {

				this.hud.showMessage( `LAP ${ lap } / ${ trackDef.laps }` );

			}

		};
		this.raceManager.onFinished = ( vIdx, finishPos ) => {

			if ( vIdx === 0 ) {

				const suffix = [ 'st', 'nd', 'rd', 'th', 'th' ][ Math.min( finishPos, 4 ) ];
				this.hud.showMessage( `${ finishPos + 1 }${ suffix } PLACE!`, 3000 );

			}

			if ( this.raceManager.finished && ! this._endRaceTimer ) {

				this._endRaceTimer = setTimeout( () => this._endRace(), 4000 );

			}

		};

		// Vehicle destruction callbacks
		for ( const v of allVehicles ) {

			v.onDestroyed = ( dead ) => {

				if ( this.particles ) this.particles.emitExplosion( dead.spherePos.clone() );
				if ( this.audio ) this.audio.playExplosion();

				// Credit kills
				const attackers = allVehicles.filter( x => x !== dead && ! x.isDestroyed );
				if ( attackers.length > 0 && this.raceManager ) {

					this.raceManager.recordKill( attackers[ 0 ] );
					if ( dead !== this.player && attackers[ 0 ] === this.player ) this._raceKills ++;

				}

			};

		}

		// Particles and drift marks — both use raceGroup as their scene
		this.particles = new SmokeTrails( this.raceGroup );
		this.driftMarks = new DriftMarks( this.raceGroup, 'race-' + trackIndex );

		// Contact listener for wall impact sounds
		const playerBody = this.player.rigidBody;
		this._contactListener = {
			onContactAdded: ( bodyA, bodyB ) => {

				if ( bodyA !== playerBody && bodyB !== playerBody ) return;
				this._forward.set( 0, 0, 1 ).applyQuaternion( this.player.container.quaternion );
				this._forward.y = 0;
				this._forward.normalize();
				const vel = Math.abs( this.player.modelVelocity.dot( this._forward ) );
				this.audio.playImpact( vel );

			},
		};

		// Start-of-race random weapons for AI
		for ( const v of this.aiVehicles ) {

			if ( Math.random() > 0.5 ) v.pickupWeapon( 'missile', 1 );

		}

		this.raceActive = true;
		this.hud.showCountdown( 3 );

	}

	_buildVehicle( modelKey, x, y, z, angle, stats ) {

		const body = createSphereBody( this.world, [ x, y, z ] );

		const v = new Vehicle();
		v.rigidBody = body;
		v.physicsWorld = this.world;
		v.spherePos.set( x, y, z );
		v.prevModelPos.set( x, 0, z );
		v.container.rotation.y = angle;
		v.container.quaternion.setFromEuler( v.container.rotation );
		v.spawnPosition.set( x, y, z );
		v.spawnAngle = angle;

		if ( stats ) {

			v.speedMultiplier = stats.speedMultiplier;
			v.armorMultiplier = stats.armorMultiplier;
			v.weaponDamageMultiplier = stats.weaponDamageMultiplier;

		}

		v.health = v.maxHealthActual;
		v.init( this.models[ modelKey ] );

		return v;

	}

	_endRace() {

		if ( ! this.raceManager ) return;

		const results = this.raceManager.getResults();
		const playerResult = results.find( r => r.isPlayer );
		const position = playerResult?.position ?? ( results.length - 1 );

		Progression.recordRaceResult(
			this._selectedTrackIndex,
			position,
			playerResult?.bestLap ?? null,
			this._raceKills
		);

		this.hud.hide();
		this.ui.showResults( results, this._selectedTrackIndex );

		this._teardownRace();

		// Restore default scene colors
		const c = new THREE.Color( 0xadb2ba );
		this.scene.background = c.clone();
		this.scene.fog.color.copy( c );
		this.scene.fog.near = 30;
		this.scene.fog.far = 55;

	}

	_animate() {

		requestAnimationFrame( () => this._animate() );

		this.timer.update();
		const dt = Math.min( this.timer.getDelta(), 1 / 30 );

		if ( ! this.raceActive ) {

			this.renderer.render( this.scene, this.cam.camera );
			return;

		}

		const input = this.controls.update();

		// Fire weapon on keypress
		if ( input.fire && this.player && this.player.canFire() ) {

			const type = this.player.consumeAmmo();
			if ( type && this.weapons ) {

				this.weapons.fire( this.player, type );
				this.audio.playWeaponFire();

			}

		}

		updateWorld( this.world, this._contactListener, dt );

		const allVehicles = [ this.player, ...this.aiVehicles ];

		if ( ! this.raceManager.started ) {

			// Tick countdown timer
			this.raceManager.update( dt );

			// Keep vehicles still during countdown
			const idle = { x: 0, z: 0, touchActive: false, fire: false };
			this.player.update( dt, idle );
			for ( const v of this.aiVehicles ) v.update( dt, idle );

		} else {

			this.player.update( dt, input );

			const leaderProgress = this.raceManager.update( dt );

			for ( let i = 0; i < this.aiControllers.length; i ++ ) {

				const ctrl = this.aiControllers[ i ];
				ctrl.leaderProgress = leaderProgress ?? 0;
				ctrl.update( dt, allVehicles, this.weapons );

			}

			this.weapons.update( dt, allVehicles );
			this.raceManager.update( 0 ); // second pass for current-frame HUD accuracy

		}

		// Move directional light with player
		this.dirLight.position.set(
			this.player.spherePos.x + 11.4,
			15,
			this.player.spherePos.z - 5.3
		);

		// Camera
		const mv = this.player.modelVelocity;
		this._camLead.set( 0, 0, 1 ).applyQuaternion( this.player.container.quaternion )
			.multiplyScalar( Math.sqrt( mv.x * mv.x + mv.z * mv.z ) );
		this.cam.update( dt, this.player.spherePos, this._camLead );

		this.particles.update( dt, this.player );
		this.driftMarks.update( dt, this.player );

		this.audio.update( dt, this.player.linearSpeed / MAX_SPEED, input.z, this.player.driftIntensity );

		this.hud.update( this.player, this.raceManager );

		this.renderer.render( this.scene, this.cam.camera );

	}

}
