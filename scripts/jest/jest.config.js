const { defaults } = require('jest-config');

module.exports = {
	...defaults,
	rootDir: process.cwd(),
	modulePathIgnorePatterns: ['<rootDir>/.history'],
	moduleDirectories: [
		// 对于 React ReactDOM
		'dist/node_modules',
		// 对于第三方依赖
		...defaults.moduleDirectories
	],
	testEnvironment: 'jsdom',
	// 添加Babel转换器配置
	transform: {
		'^.+\\.(js|jsx|ts|tsx)$': 'babel-jest'
	},
	// 指定Babel配置文件
	transformIgnorePatterns: [
		'node_modules/(?!(.*\\.mjs$))'
	]
};