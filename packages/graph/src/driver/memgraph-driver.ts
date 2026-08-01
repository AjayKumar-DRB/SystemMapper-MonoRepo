import neo4j, { Driver, Session, ServerInfo } from 'neo4j-driver';

export class MemgraphDriver {
  private static instance: Driver | null = null;

  static initialize(
    uri?: string,
    username?: string,
    password?: string,
  ): Driver {
    if (!this.instance) {
      const host = process.env.MEMGRAPH_HOST || 'localhost';
      const port = process.env.MEMGRAPH_PORT || '7687';
      const connectionUri =
        uri || process.env.MEMGRAPH_URI || `bolt://${host}:${port}`;
      const user = username ?? process.env.MEMGRAPH_USERNAME ?? '';
      const pass = password ?? process.env.MEMGRAPH_PASSWORD ?? '';

      this.instance = neo4j.driver(connectionUri, neo4j.auth.basic(user, pass), {
        maxConnectionPoolSize: 50,
        connectionAcquisitionTimeout: 30000,
        connectionTimeout: 5000,
        maxTransactionRetryTime: 15000,
      });
    }
    return this.instance;
  }

  static getDriver(): Driver {
    if (!this.instance) {
      return this.initialize();
    }
    return this.instance;
  }

  static async getSession(): Promise<Session> {
    const driver = this.getDriver();
    return driver.session();
  }

  static async verifyConnectivity(): Promise<ServerInfo> {
    const driver = this.getDriver();
    return await driver.getServerInfo();
  }

  static async closeDriver(): Promise<void> {
    if (this.instance) {
      await this.instance.close();
      this.instance = null;
    }
  }
}
