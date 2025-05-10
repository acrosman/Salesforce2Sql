const knexMock = jest.fn().mockImplementation((config) => ({
  client: config.client,
  connection: config.connection,
  schema: {
    createTable: jest.fn().mockReturnThis(),
    dropTableIfExists: jest.fn().mockResolvedValue(true),
  },
  raw: jest.fn().mockResolvedValue([{ isUp: 1 }]),
}));

module.exports = knexMock;
