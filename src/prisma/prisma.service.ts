import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    try {
      await this.$connect();
    } catch (error) {
      console.warn('Prisma connection postponed: Ensure PostgreSQL server is running at localhost:5432 when querying database endpoints.');
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
