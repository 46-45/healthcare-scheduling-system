import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { SchedulesService } from './schedules.service';
import { SchedulesResolver } from './schedules.resolver';
import { PrismaModule } from '../prisma/prisma.module';

/**
 * SchedulesModule
 * 
 * Provides schedule management functionality with queue integration
 * for email notifications.
 * */
@Module({
  imports: [
    PrismaModule,
    // Import Bull queue for email notifications
    BullModule.registerQueue({
      name: 'notification',
    }),
  ],
  providers: [SchedulesService, SchedulesResolver],
  exports: [SchedulesService],
})
export class SchedulesModule {}
