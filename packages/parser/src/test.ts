import { LanguageRegistry } from './registry/language.registry';
import { Language } from '@systemmapper/types';

const dummyCode = `
import { DatabaseService } from './db.service';
import * as express from 'express';

export class UserService {
  constructor(private db: DatabaseService) {}

  public async getUser(id: string): Promise<any> {
    return this.db.findUser(id);
  }

  private validateUser(user: any): boolean {
    return !!user;
  }
}

export function generateToken(user: any): string {
  return "token";
}
`;

async function run() {
  const registry = new LanguageRegistry();
  const parser = registry.getParser(Language.TYPESCRIPT);

  if (!parser) {
    console.error('TypeScript parser not found!');
    process.exit(1);
  }

  console.log('--- Parsing Dummy Code ---');
  const result = parser.parse('src/user.service.ts', dummyCode);
  
  console.log(JSON.stringify(result, null, 2));
}

run().catch(console.error);
