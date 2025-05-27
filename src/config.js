const config = {
  oauth: {
    clientId: process.env.SALESFORCE_CLIENT_ID || '',
    clientSecret: process.env.SALESFORCE_CLIENT_SECRET || '',
    scopes: ['api', 'id', 'web', 'refresh_token'],
  },
};

module.exports = config;
