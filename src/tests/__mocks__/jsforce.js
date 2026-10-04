const jsforce = {
  Connection: jest.fn().mockImplementation(() => ({
    login: jest.fn().mockResolvedValue({ organizationId: 'testOrgId', id: 'testUserId' }),
    logout: jest.fn().mockResolvedValue({}),
    on: jest.fn(),
    sobject: jest.fn().mockReturnValue({
      describe: jest.fn().mockResolvedValue({}),
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue([]),
    }),
    describeGlobal: jest.fn().mockResolvedValue({ sobjects: [] }),
    authorize: jest.fn().mockResolvedValue({ id: 'test-user-id', organizationId: 'test-org-id' }),
    identity: jest.fn().mockResolvedValue({ username: 'oauth.user@example.com' }),
  })),
  OAuth2: jest.fn().mockImplementation(() => ({
    getAuthorizationUrl: jest.fn().mockReturnValue('https://login.salesforce.com/auth'),
  })),
};

module.exports = jsforce;
