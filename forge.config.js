// eslint-disable-next-line import/no-extraneous-dependencies
const { utils: { fromBuildIdentifier } } = require('@electron-forge/core');

module.exports = {
  buildIdentifier: process.env.IS_BETA ? 'beta' : 'prod',
  packagerConfig: {
    appBundleId: fromBuildIdentifier({ beta: 'com.beta.acrosman.Salesforce2Sql', prod: 'com.Salesforce2Sql' }),
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        exe: 'salesforce2Sql.exe',
        name: 'salesforce2Sql',
        authors: 'Aaron Crosman',
      },
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin', 'linux'],
    },
    {
      name: '@electron-forge/maker-rpm',
      config: {},
    },
    {
      name: '@electron-forge/maker-dmg',
      config: {
        format: 'ULFO',
        overwrite: true,
      },
    },
  ],
  plugins: [],
  publishers: [
    {
      name: '@electron-forge/publisher-github',
      config: {
        repository: {
          owner: 'acrosman',
          name: 'Salesforce2Sql',
        },
        prerelease: false,
        draft: true,
      },
    },
  ],
};
