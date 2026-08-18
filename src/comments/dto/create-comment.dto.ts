import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateCommentDto {
  @ApiProperty({ example: 'Great photo! Love the colors.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  content: string;
}
