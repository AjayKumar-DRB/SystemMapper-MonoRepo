import { Session, ManagedTransaction } from 'neo4j-driver';
import { MemgraphDriver } from '../driver/memgraph-driver';
import { CypherBuilder } from '../cypher/cypher.builder';

export abstract class BaseGraphRepository {
  protected async runWrite(query: string, params?: Record<string, unknown>): Promise<void> {
    const session = await MemgraphDriver.getSession();
    try {
      await session.executeWrite((tx: ManagedTransaction) => tx.run(query, params));
    } finally {
      await session.close();
    }
  }

  protected async runQuery<T>(query: string, params?: Record<string, unknown>): Promise<T[]> {
    const session = await MemgraphDriver.getSession();
    try {
      const result = await session.executeRead((tx: ManagedTransaction) => tx.run(query, params));
      return result.records.map((record: any) => record.toObject() as T);
    } finally {
      await session.close();
    }
  }

  protected async mergeNode(label: string, properties: Record<string, any>): Promise<void> {
    const builder = new CypherBuilder()
      .merge(label, 'n', `nodeId: $props.nodeId`)
      .set('n += $props');

    const { query, params } = builder.withParams({ props: properties }).build();
    await this.runWrite(query, params);
  }

  protected async createRelationship(
    sourceId: string,
    targetId: string,
    type: string,
    props: Record<string, any> = {},
  ): Promise<void> {
    const builder = new CypherBuilder()
      .match('Node', 's', 'nodeId: $sourceId')
      .match('Node', 't', 'nodeId: $targetId')
      .mergeRelationship('s', 't', type)
      .set('r += $props');

    const { query, params } = builder.withParams({ sourceId, targetId, props }).build();
    await this.runWrite(query, params);
  }
}
