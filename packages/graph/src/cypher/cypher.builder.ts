export class CypherBuilder {
  private queryParts: string[] = [];
  private params: Record<string, unknown> = {};

  match(label: string, alias: string, properties?: string): this {
    const propsString = properties ? ` {${properties}}` : '';
    this.queryParts.push(`MATCH (${alias}:${label}${propsString})`);
    return this;
  }

  optionalMatch(label: string, alias: string, properties?: string): this {
    const propsString = properties ? ` {${properties}}` : '';
    this.queryParts.push(`OPTIONAL MATCH (${alias}:${label}${propsString})`);
    return this;
  }

  where(condition: string): this {
    this.queryParts.push(`WHERE ${condition}`);
    return this;
  }

  merge(label: string, alias: string, matchProps: string): this {
    this.queryParts.push(`MERGE (${alias}:${label} {${matchProps}})`);
    return this;
  }

  onCreateSet(setAssignments: string): this {
    this.queryParts.push(`ON CREATE SET ${setAssignments}`);
    return this;
  }

  onMatchSet(setAssignments: string): this {
    this.queryParts.push(`ON MATCH SET ${setAssignments}`);
    return this;
  }

  set(setAssignments: string): this {
    this.queryParts.push(`SET ${setAssignments}`);
    return this;
  }

  createRelationship(sourceAlias: string, targetAlias: string, type: string, props?: string): this {
    const propsString = props ? ` {${props}}` : '';
    this.queryParts.push(`CREATE (${sourceAlias})-[:${type}${propsString}]->(${targetAlias})`);
    return this;
  }

  mergeRelationship(
    sourceAlias: string,
    targetAlias: string,
    type: string,
    matchProps?: string,
  ): this {
    const propsString = matchProps ? ` {${matchProps}}` : '';
    this.queryParts.push(`MERGE (${sourceAlias})-[r:${type}${propsString}]->(${targetAlias})`);
    return this;
  }

  delete(alias: string, detach = true): this {
    this.queryParts.push(`${detach ? 'DETACH ' : ''}DELETE ${alias}`);
    return this;
  }

  returnFields(fields: string): this {
    this.queryParts.push(`RETURN ${fields}`);
    return this;
  }

  orderBy(field: string, direction: 'ASC' | 'DESC' = 'ASC'): this {
    this.queryParts.push(`ORDER BY ${field} ${direction}`);
    return this;
  }

  limit(count: number): this {
    this.queryParts.push(`LIMIT ${count}`);
    return this;
  }

  withParams(params: Record<string, unknown>): this {
    this.params = { ...this.params, ...params };
    return this;
  }

  build(): { query: string; params: Record<string, unknown> } {
    return {
      query: this.queryParts.join('\n'),
      params: this.params,
    };
  }
}
