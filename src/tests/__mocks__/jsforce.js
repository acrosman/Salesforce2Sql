const jsforce = {
  Connection: jest.fn().mockImplementation(() => ({
    login: jest.fn().mockResolvedValue({ organizationId: 'testOrgId', id: 'testUserId' }),
    logout: Promise.resolve({}),
    sobject: jest.fn().mockReturnValue({
      describe: jest.fn().mockResolvedValue({}),
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue([]),
    }),
    describeGlobal: jest.fn().mockResolvedValue({ sobjects: [] }),
  })),
};

module.exports = jsforce;
