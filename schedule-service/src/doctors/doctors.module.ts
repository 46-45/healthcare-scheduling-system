import { Module } from '@nestjs/common';
import { DoctorsService } from './doctors.service';
import { DoctorsResolver } from './doctors.resolver';
import { PrismaModule } from '../prisma/prisma.module';

/**
 * DoctorsModule provides GraphQL operations for doctor management.
 * Handles creation, retrieval, update, and deletion of doctor records.
 * 
 * */
@Module({
  imports: [PrismaModule],
  providers: [DoctorsService, DoctorsResolver],
  exports: [DoctorsService],
})
export class DoctorsModule {}
