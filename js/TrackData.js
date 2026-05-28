import { TRACK_CELLS } from './Track.js';

// Track 1: Classic Circuit (default from starter kit)
const TRACK_1_CELLS = TRACK_CELLS;

// Track 2: Desert Loop — larger oval
const TRACK_2_CELLS = [
	[  0, -4, 'track-corner',   0  ],
	[ -1, -4, 'track-straight', 22 ],
	[ -2, -4, 'track-straight', 22 ],
	[ -3, -4, 'track-corner',   16 ],
	[  0, -3, 'track-straight',  0 ],
	[ -3, -3, 'track-straight',  0 ],
	[  0, -2, 'track-straight',  0 ],
	[ -3, -2, 'track-straight',  0 ],
	[  0, -1, 'track-straight',  0 ],
	[ -3, -1, 'track-straight',  0 ],
	[  0,  0, 'track-finish',    0 ],
	[ -3,  0, 'track-straight',  0 ],
	[  0,  1, 'track-corner',   22 ],
	[ -1,  1, 'track-straight', 16 ],
	[ -2,  1, 'track-straight', 16 ],
	[ -3,  1, 'track-corner',   10 ],
];

// Track 3: Bandit Pass — complex layout with more corners
const TRACK_3_CELLS = [
	[  0,  0, 'track-finish',    0 ],
	[  0, -1, 'track-straight',  0 ],
	[  0, -2, 'track-straight',  0 ],
	[  0, -3, 'track-corner',    0 ],
	[ -1, -3, 'track-straight', 22 ],
	[ -2, -3, 'track-corner',   16 ],
	[ -2, -2, 'track-straight', 10 ],
	[ -2, -1, 'track-corner',   10 ],
	[ -3, -1, 'track-straight', 22 ],
	[ -4, -1, 'track-corner',   16 ],
	[ -4,  0, 'track-straight', 10 ],
	[ -4,  1, 'track-corner',   10 ],
	[ -3,  1, 'track-straight', 16 ],
	[ -2,  1, 'track-corner',   22 ],
	[ -2,  2, 'track-straight', 10 ],
	[ -2,  3, 'track-corner',   10 ],
	[ -1,  3, 'track-straight', 16 ],
	[  0,  3, 'track-corner',   22 ],
	[  0,  2, 'track-straight',  0 ],
	[  0,  1, 'track-straight',  0 ],
];

export const TRACKS = [
	{
		id: 0,
		name: 'Classic Circuit',
		description: 'The original track. Good for beginners.',
		theme: 'forest',
		cells: TRACK_1_CELLS,
		laps: 3,
		fogColor: 0xadb2ba,
		ambientColor: 0xc8d8e8,
		difficulty: 1,
	},
	{
		id: 1,
		name: 'Desert Loop',
		description: 'Wider oval for high-speed racing.',
		theme: 'tents',
		cells: TRACK_2_CELLS,
		laps: 3,
		fogColor: 0xd4b483,
		ambientColor: 0xe8d4b0,
		difficulty: 2,
	},
	{
		id: 2,
		name: 'Bandit Pass',
		description: 'Tight corners require precision.',
		theme: 'forest',
		cells: TRACK_3_CELLS,
		laps: 3,
		fogColor: 0x8a9aaa,
		ambientColor: 0xb0c0d0,
		difficulty: 3,
	},
];
