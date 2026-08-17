const { getConfig, resolveDbHost } = require('../services/db/database');

describe('conexao postgres', () => {
  it('traduz localhost e ::1 para IPv4', () => {
    expect(resolveDbHost('localhost')).toBe('127.0.0.1');
    expect(resolveDbHost('::1')).toBe('127.0.0.1');
    expect(resolveDbHost('db.interno')).toBe('db.interno');
  });

  it('forca family 4 quando o host e loopback IPv4', () => {
    const previousHost = process.env.DB_HOST;
    process.env.DB_HOST = 'localhost';

    try {
      const config = getConfig();
      expect(config.host).toBe('127.0.0.1');
      expect(config.family).toBe(4);
    } finally {
      if (previousHost === undefined) {
        delete process.env.DB_HOST;
      } else {
        process.env.DB_HOST = previousHost;
      }
    }
  });
});
