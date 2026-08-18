import { Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { BlocksService } from './blocks.service';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { GetUser } from 'src/common/decorators/get-user.decorator';

@ApiTags('Blocks')
@Controller('blocks')
export class BlocksController {
    constructor(private blocksService:BlocksService){}

    @Post(":userId")
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({summary:"Block a user"})
    blockUser(@GetUser("id") blockerId:string,@Param("userId") blcokedId : string){
        return this.blocksService.blockUser(blockerId,blcokedId)
    }

    @Delete(":userId")
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({summary:"Unblock a user"})
    unblockUser(@GetUser("id") blockerId:string,@Param("userId") blockedId:string){
        return this.blocksService.unblockUser(blockerId,blockedId)
    }

    @Get("")
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({summary:"Get blocked users"})
    getBlockedUsers(@GetUser("id") userId:string){
        return this.blocksService.getBlockedUsers(userId)
    }

    @Get(":userId")
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({summary:"Check if blocked"})
    isBlocked(@GetUser("id") userAId:string,@Param("userId") userBId:string){
        return this.blocksService.isBlocked(userAId,userBId)
    }
}
