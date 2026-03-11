const config = {
  oauth: {
    clientId: process.env.SALESFORCE_CLIENT_ID || '',
    clientSecret: process.env.SALESFORCE_CLIENT_SECRET || '',
    scopes: ['api', 'id', 'web', 'refresh_token'],
  },
  updateOAuthCredentials(clientId, clientSecret) {
    this.oauth.clientId = clientId;
    this.oauth.clientSecret = clientSecret;
  },
};

module.exports = config;
