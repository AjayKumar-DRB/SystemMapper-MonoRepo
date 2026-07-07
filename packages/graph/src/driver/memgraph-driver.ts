import neo4j, { Driver, Session, ServerInfo } from 'neo4j-driver';

export class MemgraphDriver {
  private static instance: Driver | null = null;

  static initialize(
    uri: string = process.env.MEMGRAPH_URI || 'bolt://localhost:7687',
    username: string = process.env.MEMGRAPH_USERNAME || '',
    password: string = process.env.MEMGRAPH_PASSWORD || ''
  ): Driver {
    if (!this.instance) {
      this.instance = neo4j.driver(uri, neo4j.auth.basic(username, password), {
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
