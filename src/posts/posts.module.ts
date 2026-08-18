import { Module } from '@nestjs/common';
import { PostsService } from './posts.service';
import { PostsController } from './posts.controller';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';
import { BlocksModule } from '../blocks/blocks.module';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [CloudinaryModule, BlocksModule, EventsModule],
  controllers: [PostsController],
  providers: [PostsService],
  exports: [PostsService],
})
export class PostsModule {}
