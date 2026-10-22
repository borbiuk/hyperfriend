const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

const rootDir = path.join(__dirname, '..');
const srcDir = path.join(rootDir, 'src');

module.exports = {
	entry: {
		background: path.join(srcDir, 'background', 'background.ts'),
		content: path.join(srcDir, 'content', 'content.ts'),
		options: path.join(srcDir, 'options', 'options.tsx'),
	},
	output: {
		path: path.join(rootDir, 'dist'),
		// Manifests reference exact file names, so no hashes are used
		filename: '[name].js',
		clean: true,
	},
	optimization: {
		// Every entry is a single self-contained file (no vendor chunks, no runtime chunk)
		splitChunks: false,
		runtimeChunk: false,
	},
	cache: {
		type: 'filesystem',
		buildDependencies: {
			config: [__filename],
		},
		cacheDirectory: path.join(rootDir, 'node_modules', '.cache', 'webpack'),
	},
	module: {
		rules: [
			{
				test: /\.tsx?$/,
				exclude: /node_modules/,
				use: [
					{
						loader: 'ts-loader',
						options: {
							// Type checking is done by `tsc --noEmit` (npm run typecheck)
							transpileOnly: true,
							compilerOptions: {
								noEmit: false,
							},
						},
					},
				],
			},
			{
				// CSS from src and from node_modules (Primer ships CSS)
				test: /\.css$/i,
				use: ['style-loader', 'css-loader'],
			},
		],
	},
	resolve: {
		extensions: ['.ts', '.tsx', '.js', '.json'],
		alias: {
			'@shared': path.join(srcDir, 'shared'),
		},
	},
	plugins: [
		new CopyPlugin({
			patterns: [
				{
					from: '.',
					to: './',
					context: path.join(rootDir, 'public'),
					globOptions: {
						ignore: [
							'**/.DS_Store',
							// Manifests are copied as manifest.json by the per-target configs
							'**/manifest.json',
							'**/manifest.firefox.json',
						],
					},
				},
			],
		}),
	],
	// Browser extension specific settings
	target: ['web', 'es2021'],
};
