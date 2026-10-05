// All external dependencies are mocked: electron and jsforce use the manual
// mocks in src/tests/__mocks__, and http is auto-mocked so no real server
// starts. Each test drives the captured request handler directly.
jest.mock('electron');
jest.mock('jsforce');
jest.mock('http');

const electron = require('electron');
const jsforce = require('jsforce');
const http = require('http');
const oauth = require('../sf_oauth');

const REDIRECT_URI = 'http://localhost:3835/callback';
const MY_DOMAIN = 'https://myorg.my.salesforce.com';

describe('Salesforce OAuth2 Tests', () => {
  let serverHandler = null;
  let serverEvents = {};
  let mockServer = null;

  const mockResponse = () => ({ writeHead: jest.fn(), end: jest.fn() });

  // Simulates the browser being redirected back to the local callback server.
  const sendCallback = (path) => {
    const res = mockResponse();
    serverHandler({ url: path, method: 'GET' }, res);
    return res;
  };

  // Builds a jsforce.OAuth2 stand-in that includes its params in the auth URL.
  const mockOAuth2 = () => jsforce.OAuth2.mockImplementation((oauthConfig) => ({
    getAuthorizationUrl: jest.fn((params) => {
      const query = new URLSearchParams({ ...params, redirect_uri: oauthConfig.redirectUri });
      return `${oauthConfig.loginUrl}/services/oauth2/authorize?${query}`;
    }),
  }));

  // Returns the state value that attemptLogin sent to Salesforce.
  const lastState = () => {
    const oauthInstance = jsforce.OAuth2.mock.results.slice(-1)[0].value;
    return oauthInstance.getAuthorizationUrl.mock.calls[0][0].state;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    serverHandler = null;
    serverEvents = {};

    http.createServer.mockImplementation((handler) => {
      serverHandler = handler;
      mockServer = {
        listen: jest.fn(),
        close: jest.fn(),
        on: jest.fn((name, cb) => { serverEvents[name] = cb; }),
      };
      return mockServer;
    });

    oauth.setCredentials('test-client-id', 'test-client-secret');
    oauth.setCallbackPort(3835);
    mockOAuth2();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('buildRedirectUri', () => {
    test('builds the exact callback URL for a port', () => {
      expect(oauth.buildRedirectUri(3835)).toBe(REDIRECT_URI);
      expect(oauth.buildRedirectUri(4000)).toBe('http://localhost:4000/callback');
    });
  });

  describe('normalizeCallbackPort', () => {
    test('accepts valid ports and falls back to the default otherwise', () => {
      expect(oauth.normalizeCallbackPort('4100')).toBe(4100);
      expect(oauth.normalizeCallbackPort(65535)).toBe(65535);
      [undefined, '', 'abc', 0, -1, 70000].forEach((port) => {
        expect(oauth.normalizeCallbackPort(port)).toBe(oauth.DEFAULT_CALLBACK_PORT);
      });
    });
  });

  describe('isValidSalesforceUrl', () => {
    test('accepts valid Salesforce URLs', () => {
      const validUrls = [
        'https://myorg.my.salesforce.com/setup',
        'https://myorg.my.salesforce.com/services/oauth2/authorize',
        'https://myorg--dev.sandbox.my.salesforce.com/services/oauth2/authorize',
      ];

      validUrls.forEach((url) => {
        expect(oauth.__get__('isValidSalesforceUrl')(url)).toBe(true);
      });
    });

    test('rejects invalid URLs', () => {
      const invalidUrls = [
        'http://myorg.my.salesforce.com',
        // External Client Apps can't use the generic login or test domains.
        'https://login.salesforce.com/services/oauth2/authorize',
        'https://test.salesforce.com/services/oauth2/authorize',
        'https://fake-salesforce.com',
        'https://salesforce.com',
        'https://myorg.my.salesforce.com.evil.com',
        // cloudforce.com domains are retired by Salesforce.
        'https://login.cloudforce.com',
        'https://company.cloudforce.com/oauth',
        'not-a-url',
      ];

      invalidUrls.forEach((url) => {
        expect(oauth.__get__('isValidSalesforceUrl')(url)).toBe(false);
      });
    });
  });

  describe('createLocalServer', () => {
    const createLocalServer = () => oauth.__get__('createLocalServer');

    test('listens on the loopback address and resolves with the auth code', async () => {
      const serverPromise = createLocalServer()(3835, 'expected-state');
      expect(mockServer.listen).toHaveBeenCalledWith(3835, '127.0.0.1');

      const res = sendCallback('/callback?code=test-auth-code&state=expected-state');

      await expect(serverPromise).resolves.toBe('test-auth-code');
      expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
      expect(mockServer.close).toHaveBeenCalled();
    });

    test('responds 404 to other paths without settling', async () => {
      const serverPromise = createLocalServer()(3835, 'expected-state');

      const res = sendCallback('/favicon.ico');
      expect(res.writeHead).toHaveBeenCalledWith(404, expect.any(Object));
      expect(mockServer.close).not.toHaveBeenCalled();

      // Finish the login so nothing is left pending.
      sendCallback('/callback?code=later-code&state=expected-state');
      await expect(serverPromise).resolves.toBe('later-code');
    });

    test('rejects when the state does not match', async () => {
      const serverPromise = createLocalServer()(3835, 'expected-state');

      const res = sendCallback('/callback?code=test-auth-code&state=forged-state');

      await expect(serverPromise).rejects.toThrow('state mismatch');
      expect(res.writeHead).toHaveBeenCalledWith(400, expect.any(Object));
      expect(mockServer.close).toHaveBeenCalled();
    });

    test('rejects when Salesforce returns an error', async () => {
      const serverPromise = createLocalServer()(3835, 'expected-state');

      const res = sendCallback('/callback?error=access_denied&error_description=end-user+denied+authorization&state=expected-state');

      await expect(serverPromise).rejects.toThrow('OAuth login failed: end-user denied authorization');
      expect(res.writeHead).toHaveBeenCalledWith(400, { 'Content-Type': 'text/plain' });
      expect(mockServer.close).toHaveBeenCalled();
    });

    test('rejects when no auth code is provided', async () => {
      const serverPromise = createLocalServer()(3835, 'expected-state');

      sendCallback('/callback?state=expected-state');

      await expect(serverPromise).rejects.toThrow('No authorization code received');
      expect(mockServer.close).toHaveBeenCalled();
    });

    test('rejects and closes the server on timeout', async () => {
      jest.useFakeTimers();
      const serverPromise = createLocalServer()(3835, 'expected-state', 1000);

      jest.advanceTimersByTime(1000);

      await expect(serverPromise).rejects.toThrow('timed out');
      expect(mockServer.close).toHaveBeenCalled();
    });

    test('rejects with a helpful message when the port is in use', async () => {
      const serverPromise = createLocalServer()(3835, 'expected-state');

      const err = new Error('listen EADDRINUSE');
      err.code = 'EADDRINUSE';
      serverEvents.error(err);

      await expect(serverPromise).rejects.toThrow('OAuth callback port 3835 is already in use');
    });

    test('rejects on other server errors', async () => {
      const serverPromise = createLocalServer()(3835, 'expected-state');

      serverEvents.error(new Error('boom'));

      await expect(serverPromise).rejects.toThrow('OAuth callback server error: boom');
    });

    test('a new login attempt cancels the previous one', async () => {
      const firstPromise = createLocalServer()(3835, 'first-state');
      const firstServer = mockServer;

      const secondPromise = createLocalServer()(3835, 'second-state');

      await expect(firstPromise).rejects.toThrow('new login attempt');
      expect(firstServer.close).toHaveBeenCalled();

      sendCallback('/callback?code=second-code&state=second-state');
      await expect(secondPromise).resolves.toBe('second-code');
    });
  });

  describe('attemptLogin', () => {
    test('successful login flow uses PKCE, state, and a matching redirect URI', async () => {
      const promise = oauth.attemptLogin(MY_DOMAIN);

      sendCallback(`/callback?code=test-auth-code&state=${lastState()}`);
      const result = await promise;

      expect(jsforce.OAuth2).toHaveBeenCalledWith({
        loginUrl: MY_DOMAIN,
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        redirectUri: REDIRECT_URI,
        useVerifier: true,
      });

      // The URL opened in the browser must carry the same redirect URI that is
      // used at token exchange, or Salesforce rejects the callback.
      const authUrl = new URL(electron.shell.openExternal.mock.calls[0][0]);
      expect(authUrl.hostname).toBe('myorg.my.salesforce.com');
      expect(authUrl.searchParams.get('redirect_uri')).toBe(REDIRECT_URI);
      expect(authUrl.searchParams.get('scope')).toBe('api id refresh_token');
      expect(authUrl.searchParams.get('state')).toMatch(/^[0-9a-f]{32}$/);

      expect(result.conn.authorize).toHaveBeenCalledWith('test-auth-code');
      expect(result.userInfo).toEqual(expect.objectContaining({
        organizationId: 'test-org-id',
        username: 'oauth.user@example.com',
      }));
      expect(result.oauth2Config).toEqual({
        loginUrl: MY_DOMAIN,
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        redirectUri: REDIRECT_URI,
      });
    });

    test('uses the configured callback port', async () => {
      oauth.setCallbackPort(4000);
      const promise = oauth.attemptLogin(MY_DOMAIN);

      expect(mockServer.listen).toHaveBeenCalledWith(4000, '127.0.0.1');
      sendCallback(`/callback?code=test-auth-code&state=${lastState()}`);
      const result = await promise;

      expect(result.oauth2Config.redirectUri).toBe('http://localhost:4000/callback');
    });

    test('a failed identity lookup does not fail the login', async () => {
      jsforce.Connection.mockImplementationOnce(() => ({
        authorize: jest.fn().mockResolvedValue({ id: 'uid', organizationId: 'oid' }),
        identity: jest.fn().mockRejectedValue(new Error('Bad_OAuth_Token')),
      }));
      const promise = oauth.attemptLogin(MY_DOMAIN);

      sendCallback(`/callback?code=test-auth-code&state=${lastState()}`);
      const result = await promise;

      expect(result.userInfo.username).toBe('');
    });

    test('fails when the browser cannot be opened', async () => {
      electron.shell.openExternal.mockRejectedValueOnce(new Error('No browser available'));

      await expect(oauth.attemptLogin(MY_DOMAIN))
        .rejects
        .toThrow('No browser available');
      expect(mockServer.close).toHaveBeenCalled();
    });

    test('fails with missing credentials', async () => {
      oauth.setCredentials('', '');

      await expect(oauth.attemptLogin(MY_DOMAIN))
        .rejects
        .toThrow('Missing OAuth credentials');
      expect(http.createServer).not.toHaveBeenCalled();
    });

    test('fails with invalid Salesforce URL without starting a server', async () => {
      await expect(oauth.attemptLogin('https://not-salesforce.com'))
        .rejects
        .toThrow('Invalid Salesforce authentication URL');
      expect(http.createServer).not.toHaveBeenCalled();
    });

    test('rejects the generic login URL because OAuth needs My Domain', async () => {
      await expect(oauth.attemptLogin('https://login.salesforce.com'))
        .rejects
        .toThrow('OAuth requires your My Domain URL');
      expect(http.createServer).not.toHaveBeenCalled();
    });
  });
});
