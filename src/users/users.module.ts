import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';
import { BlocksModule } from '../blocks/blocks.module';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [CloudinaryModule, BlocksModule, EventsModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
