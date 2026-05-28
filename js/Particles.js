import * as THREE from 'three';
import { ASSETS_BASE } from './Loader.js';

const POOL_SIZE = 1280;
const PARTICLES_PER_EMIT = 3;
const EMIT_JITTER = 0.15;
const BASE_SIZE = 1;
const MAX_LIFE = 2.5;
const INV_MAX_LIFE = 1 / MAX_LIFE;

const EXPLOSION_POOL_SIZE = 256;
const EXPLOSION_MAX_LIFE = 1.5;
const INV_EXPLOSION_LIFE = 1 / EXPLOSION_MAX_LIFE;

const _blPos = new THREE.Vector3();
const _brPos = new THREE.Vector3();

export class SmokeTrails {

	constructor( scene ) {

		const positions = new Float32Array( POOL_SIZE * 3 );
		const opacities = new Float32Array( POOL_SIZE );
		const sizes = new Float32Array( POOL_SIZE );

		const geometry = new THREE.BufferGeometry();

		const posAttr = new THREE.BufferAttribute( positions, 3 );
		posAttr.setUsage( THREE.DynamicDrawUsage );
		geometry.setAttribute( 'position', posAttr );

		const opacityAttr = new THREE.BufferAttribute( opacities, 1 );
		opacityAttr.setUsage( THREE.DynamicDrawUsage );
		geometry.setAttribute( 'aOpacity', opacityAttr );

		const sizeAttr = new THREE.BufferAttribute( sizes, 1 );
		sizeAttr.setUsage( THREE.DynamicDrawUsage );
		geometry.setAttribute( 'aSize', sizeAttr );

		const map = new THREE.TextureLoader().load( ASSETS_BASE + 'sprites/smoke.png' );

		const material = new THREE.PointsMaterial( {
			map,
			color: 0x5E5F6B,
			size: 1,
			sizeAttenuation: true,
			transparent: true,
			depthWrite: false,
		} );

		material.onBeforeCompile = ( shader ) => {

			shader.vertexShader = 'attribute float aSize;\nattribute float aOpacity;\nvarying float vOpacity;\n' + shader.vertexShader;
			shader.vertexShader = shader.vertexShader.replace(
				'void main() {',
				'void main() {\n\tvOpacity = aOpacity;'
			);
			shader.vertexShader = shader.vertexShader.replace(
				'gl_PointSize = size;',
				'gl_PointSize = size * aSize;'
			);

			shader.fragmentShader = 'varying float vOpacity;\n' + shader.fragmentShader;
			shader.fragmentShader = shader.fragmentShader.replace(
				'vec4 diffuseColor = vec4( diffuse, opacity );',
				'vec4 diffuseColor = vec4( diffuse, opacity * vOpacity );'
			);

		};

		const points = new THREE.Points( geometry, material );
		points.frustumCulled = false;
		scene.add( points );

		this.posAttr = posAttr;
		this.opacityAttr = opacityAttr;
		this.sizeAttr = sizeAttr;
		this.positions = positions;
		this.opacities = opacities;
		this.sizes = sizes;

		this.particles = [];

		for ( let i = 0; i < POOL_SIZE; i ++ ) {

			this.particles.push( {
				life: 0,
				velocity: new THREE.Vector3(),
				initialSize: 0,
			} );

		}

		this.emitIndex = 0;

		// Explosion particle pool
		this._buildExplosionPool( scene );

	}

	_buildExplosionPool( scene ) {

		const positions = new Float32Array( EXPLOSION_POOL_SIZE * 3 );
		const opacities = new Float32Array( EXPLOSION_POOL_SIZE );
		const sizes = new Float32Array( EXPLOSION_POOL_SIZE );

		const geometry = new THREE.BufferGeometry();

		const posAttr = new THREE.BufferAttribute( positions, 3 );
		posAttr.setUsage( THREE.DynamicDrawUsage );
		geometry.setAttribute( 'position', posAttr );

		const opacityAttr = new THREE.BufferAttribute( opacities, 1 );
		opacityAttr.setUsage( THREE.DynamicDrawUsage );
		geometry.setAttribute( 'aOpacity', opacityAttr );

		const sizeAttr = new THREE.BufferAttribute( sizes, 1 );
		sizeAttr.setUsage( THREE.DynamicDrawUsage );
		geometry.setAttribute( 'aSize', sizeAttr );

		const material = new THREE.PointsMaterial( {
			color: 0xff6600,
			size: 1.5,
			sizeAttenuation: true,
			transparent: true,
			depthWrite: false,
		} );

		material.onBeforeCompile = ( shader ) => {

			shader.vertexShader = 'attribute float aSize;\nattribute float aOpacity;\nvarying float vOpacity;\n' + shader.vertexShader;
			shader.vertexShader = shader.vertexShader.replace(
				'void main() {',
				'void main() {\n\tvOpacity = aOpacity;'
			);
			shader.vertexShader = shader.vertexShader.replace(
				'gl_PointSize = size;',
				'gl_PointSize = size * aSize;'
			);

			shader.fragmentShader = 'varying float vOpacity;\n' + shader.fragmentShader;
			shader.fragmentShader = shader.fragmentShader.replace(
				'vec4 diffuseColor = vec4( diffuse, opacity );',
				'vec4 diffuseColor = vec4( diffuse, opacity * vOpacity );'
			);

		};

		const points = new THREE.Points( geometry, material );
		points.frustumCulled = false;
		scene.add( points );

		this._expPosAttr = posAttr;
		this._expOpacAttr = opacityAttr;
		this._expSizeAttr = sizeAttr;
		this._expPositions = positions;
		this._expOpacities = opacities;
		this._expSizes = sizes;

		this._expParticles = [];
		for ( let i = 0; i < EXPLOSION_POOL_SIZE; i ++ ) {

			this._expParticles.push( {
				life: 0,
				velocity: new THREE.Vector3(),
			} );

		}

		this._expEmitIdx = 0;
		this._expAlive = 0;

	}

	emitExplosion( position ) {

		const count = 60;

		for ( let i = 0; i < count; i ++ ) {

			const idx = this._expEmitIdx;
			this._expEmitIdx = ( idx + 1 ) % EXPLOSION_POOL_SIZE;

			const p = this._expParticles[ idx ];
			const pi = idx * 3;

			this._expPositions[ pi ] = position.x + ( Math.random() - 0.5 ) * 0.5;
			this._expPositions[ pi + 1 ] = position.y + 0.3;
			this._expPositions[ pi + 2 ] = position.z + ( Math.random() - 0.5 ) * 0.5;

			const speed = 1.5 + Math.random() * 3.0;
			const angle = Math.random() * Math.PI * 2;
			const up = 0.5 + Math.random() * 2.0;

			p.velocity.set(
				Math.cos( angle ) * speed,
				up,
				Math.sin( angle ) * speed
			);

			p.life = EXPLOSION_MAX_LIFE;
			this._expSizes[ idx ] = 0.8 + Math.random() * 1.2;
			this._expOpacities[ idx ] = 1.0;

		}

		this._expAlive = count;

	}

	update( dt, vehicle ) {

		const shouldEmit = vehicle.driftIntensity > 0.7;
		let aliveCount = 0;

		if ( shouldEmit ) {

			const roadY = vehicle.container.position.y + 0.05;
			const bl = vehicle.wheelBL ? vehicle.wheelBL.getWorldPosition( _blPos ) : null;
			const br = vehicle.wheelBR ? vehicle.wheelBR.getWorldPosition( _brPos ) : null;

			for ( let i = 0; i < PARTICLES_PER_EMIT; i ++ ) {

				if ( bl ) this.emitAt( bl.x, roadY, bl.z );
				if ( br ) this.emitAt( br.x, roadY, br.z );

			}

		}

		const damping = 1 - dt;

		for ( let i = 0; i < POOL_SIZE; i ++ ) {

			const p = this.particles[ i ];
			if ( p.life <= 0 ) continue;

			p.life -= dt;

			if ( p.life <= 0 ) {

				this.opacities[ i ] = 0;
				aliveCount ++;
				continue;

			}

			const t = 1 - p.life * INV_MAX_LIFE;

			p.velocity.multiplyScalar( damping );

			const posIdx = i * 3;
			this.positions[ posIdx ] += p.velocity.x * dt;
			this.positions[ posIdx + 1 ] += p.velocity.y * dt;
			this.positions[ posIdx + 2 ] += p.velocity.z * dt;

			this.opacities[ i ] = ( 1 - t ) * 0.25;
			this.sizes[ i ] = p.initialSize * ( 0.5 + t * 2.5 );

			aliveCount ++;

		}

		if ( shouldEmit || aliveCount > 0 ) {

			this.posAttr.needsUpdate = true;
			this.opacityAttr.needsUpdate = true;
			this.sizeAttr.needsUpdate = true;

		}

		// Update explosion particles
		let expAlive = 0;

		for ( let i = 0; i < EXPLOSION_POOL_SIZE; i ++ ) {

			const p = this._expParticles[ i ];
			if ( p.life <= 0 ) continue;

			p.life -= dt;

			if ( p.life <= 0 ) {

				this._expOpacities[ i ] = 0;
				expAlive ++;
				continue;

			}

			const t = 1 - p.life * INV_EXPLOSION_LIFE;
			p.velocity.y -= dt * 4.0;

			const pi = i * 3;
			this._expPositions[ pi ] += p.velocity.x * dt;
			this._expPositions[ pi + 1 ] += p.velocity.y * dt;
			this._expPositions[ pi + 2 ] += p.velocity.z * dt;

			this._expOpacities[ i ] = Math.max( 0, 1 - t * t );
			expAlive ++;

		}

		if ( expAlive > 0 ) {

			this._expPosAttr.needsUpdate = true;
			this._expOpacAttr.needsUpdate = true;
			this._expSizeAttr.needsUpdate = true;

		}

	}

	emitAt( x, y, z ) {

		const i = this.emitIndex;
		this.emitIndex = ( i + 1 ) % POOL_SIZE;

		const p = this.particles[ i ];

		const posIdx = i * 3;
		this.positions[ posIdx ] = x + ( Math.random() - 0.5 ) * EMIT_JITTER;
		this.positions[ posIdx + 1 ] = y + Math.random() * EMIT_JITTER;
		this.positions[ posIdx + 2 ] = z + ( Math.random() - 0.5 ) * EMIT_JITTER;

		p.initialSize = BASE_SIZE * ( 0.5 + Math.random() * 0.5 );

		p.velocity.set(
			( Math.random() - 0.5 ) * 0.2,
			0.5 + Math.random() * 0.5,
			( Math.random() - 0.5 ) * 0.2
		);

		p.life = MAX_LIFE;

	}

}
