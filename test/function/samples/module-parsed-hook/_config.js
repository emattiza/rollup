const assert = require('assert');
const path = require('path');

const parsedModules = [];

const ID_MAIN = path.join(__dirname, 'main.js');
const ID_DEP = path.join(__dirname, 'dep.js');

module.exports = {
	description: 'calls the moduleParsedHook once a module is parsed',
	options: {
		plugins: {
			name: 'test-plugin',
			moduleParsed(moduleInfo) {
				parsedModules.push(moduleInfo);
			},
			buildEnd() {
				assert.deepStrictEqual(JSON.parse(JSON.stringify(parsedModules)), [
					{
						ast: {
							type: 'Program',
							start: 0,
							end: 34,
							body: [
								{
									type: 'ExportNamedDeclaration',
									start: 0,
									end: 33,
									declaration: null,
									specifiers: [
										{
											type: 'ExportSpecifier',
											start: 9,
											end: 14,
											local: { type: 'Identifier', start: 9, end: 14, name: 'value' },
											exported: { type: 'Identifier', start: 9, end: 14, name: 'value' }
										}
									],
									source: {
										type: 'Literal',
										start: 22,
										end: 32,
										value: './dep.js',
										raw: "'./dep.js'"
									}
								}
							],
							sourceType: 'module'
						},
						code: "export { value } from './dep.js';\n",
						dynamicallyImportedIds: [],
						dynamicImporters: [],
						hasModuleSideEffects: true,
						id: ID_MAIN,
						implicitlyLoadedAfterOneOf: [],
						implicitlyLoadedBefore: [],
						importedIds: [ID_DEP],
						importers: [],
						isEntry: true,
						isExternal: false,
						isIncluded: false,
						meta: {},
						syntheticNamedExports: false
					},
					{
						ast: {
							type: 'Program',
							start: 0,
							end: 25,
							body: [
								{
									type: 'ExportNamedDeclaration',
									start: 0,
									end: 24,
									declaration: {
										type: 'VariableDeclaration',
										start: 7,
										end: 24,
										declarations: [
											{
												type: 'VariableDeclarator',
												start: 13,
												end: 23,
												id: { type: 'Identifier', start: 13, end: 18, name: 'value' },
												init: { type: 'Literal', start: 21, end: 23, value: 42, raw: '42' }
											}
										],
										kind: 'const'
									},
									specifiers: [],
									source: null
								}
							],
							sourceType: 'module'
						},
						code: 'export const value = 42;\n',
						dynamicallyImportedIds: [],
						dynamicImporters: [],
						hasModuleSideEffects: true,
						id: ID_DEP,
						implicitlyLoadedAfterOneOf: [],
						implicitlyLoadedBefore: [],
						importedIds: [],
						importers: [ID_MAIN],
						isEntry: false,
						isExternal: false,
						isIncluded: true,
						meta: {},
						syntheticNamedExports: false
					}
				]);
			}
		}
	}
};
