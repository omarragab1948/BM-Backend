import { Module } from "@nestjs/common";
import { BlocksService } from "./blocks.service";
import { BlocksController } from "./blocks.controller";
import { EventsModule } from "../events/events.module";

@Module({
  imports: [EventsModule],
  providers: [BlocksService],
  controllers: [BlocksController],
  exports: [BlocksService],
})
export class BlocksModule {}
