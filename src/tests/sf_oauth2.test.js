const electron = require('electron');
const jsforce = require('jsforce');
const http = require('http');
const oauth = require('../sf_oauth2');
const config = require('../config');

describe('Salesforce OAuth2 Tests', () => {
  let serverHandler = null;

  beforeEach(() => {
    // Clear all mocks and reset handler
    jest.clearAllMocks();
    serverHandler = null;

    // Single stable mock for http.createServer for all tests
    jest.spyOn(http, 'createServer').mockImplementation((handler) => {
      // Capture the handler for tests to invoke
      serverHandler = handler;

      const server = {
        listen: (port, host, cb) => {
          let cBack = cb;
          if (typeof host === 'function') cBack = host;
          // simulate async listen
          process.nextTick(() => cBack && cBack());
        },
        address: () => ({ port: 51234 }),
        close: (cBack) => cBack && cBack(),
        on: jest.fn(),
      };
      return server;
    });

    // Ensure electron.shell.openExternal exists on the electron mock
    if (electron && electron.shell && !electron.shell.openExternal) {
      electron.shell.openExternal = jest.fn().mockResolvedValue(true);
    }
  });

  describe('isValidSalesforceUrl', () => {
    test('accepts valid Salesforce URLs', () => {
      const validUrls = [
        'https://login.salesforce.com/auth',
        'https://test.salesforce.com/services/oauth2/authorize',
        'https://myorg.my.salesforce.com/setup',
        'https://company.cloudforce.com/oauth',
      ];

      validUrls.forEach((url) => {
        expect(oauth.__get__('isValidSalesforceUrl')(url)).toBe(true);
      });
    });

    test('rejects invalid URLs', () => {
      const invalidUrls = [
        'http://login.salesforce.com',
        'https://fake-salesforce.com',
        'https://salesforce.com',
        'not-a-url',
      ];

      invalidUrls.forEach((url) => {
        expect(oauth.__get__('isValidSalesforceUrl')(url)).toBe(false);
      });
    });
  });

  describe('createLocalServer', () => {
    test('creates server and resolves with auth code', async () => {
      const mockJsfOauth = { redirectUri: 'https://localhost/completesetup' };
      const createLocalServer = oauth.__get__('createLocalServer');
      const serverPromise = createLocalServer(mockJsfOauth);

      // invoke captured handler to simulate incoming request
      expect(typeof serverHandler).toBe('function');
      serverHandler(
        { url: '/completesetup?code=test-auth-code', method: 'GET' },
        { writeHead: jest.fn(), end: jest.fn() },
      );

      const code = await serverPromise;
      expect(code).toBe('test-auth-code');
    });

    test('rejects when no auth code provided', async () => {
      const mockJsfOauth = { redirectUri: 'https://localhost/completesetup' };
      const createLocalServer = oauth.__get__('createLocalServer');
      const serverPromise = createLocalServer(mockJsfOauth);

      expect(typeof serverHandler).toBe('function');
      serverHandler(
        { url: '/completesetup', method: 'GET' },
        { writeHead: jest.fn(), end: jest.fn() },
      );

      await expect(serverPromise).rejects.toThrow('No authorization code received');
    });
  });

  describe('attemptLogin', () => {
    test('successful login flow', async () => {
      // Set credentials directly in config
      config.updateOAuthCredentials('test-client-id', 'test-client-secret');

      // start attemptLogin, which will call createLocalServer (handler captured)
      const promise = oauth.attemptLogin('https://login.salesforce.com');

      // simulate callback arriving after server listen
      process.nextTick(() => {
        expect(typeof serverHandler).toBe('function');
        serverHandler(
          { url: '/completesetup?code=test-auth-code', method: 'GET' },
          { writeHead: jest.fn(), end: jest.fn() },
        );
      });

      const result = await promise;

      expect(jsforce.OAuth2).toHaveBeenCalledWith({
        loginUrl: 'https://login.salesforce.com',
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        redirectUri: expect.stringContaining('localhost'),
      });

      expect(electron.shell.openExternal).toHaveBeenCalledWith(
        expect.stringContaining('https://login.salesforce.com'),
      );

      expect(result.conn).toBeDefined();
      expect(result.userInfo).toBeDefined();
    });

    test('fails with missing credentials', async () => {
      // Clear credentials directly in config
      config.updateOAuthCredentials('', '');

      await expect(oauth.attemptLogin('https://login.salesforce.com'))
        .rejects
        .toThrow('Missing OAuth credentials');
    });

    test('fails with invalid Salesforce URL', async () => {
      // Set credentials directly in config
      config.updateOAuthCredentials('test-client-id', 'test-client-secret');

      jsforce.OAuth2.mockImplementationOnce(() => ({
        getAuthorizationUrl: jest.fn().mockReturnValue('https://not-salesforce.com/auth'),
      }));

      await expect(oauth.attemptLogin('https://junk.salesforce.com'))
        .rejects
        .toThrow('Invalid Salesforce authentication URL');
    });
  });
});
