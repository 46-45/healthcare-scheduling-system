import { Module } from '@nestjs/common';
import { CustomersService } from './customers.service';
import { CustomersResolver } from './customers.resolver';
import { PrismaModule } from '../prisma/prisma.module';

/**
 * CustomersModule provides GraphQL operations for customer management.
 * Handles creation, retrieval, update, and deletion of customer records.
 * 
 * */
@Module({
  imports: [PrismaModule],
  providers: [CustomersService, CustomersResolver],
  exports: [CustomersService],
})
export class CustomersModule {}
