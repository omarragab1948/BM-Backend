import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class SendMessageDto {
  @ApiProperty({ example: 'target_user_id_uuid' })
  @IsNotEmpty()
  @IsString()
  recipientId: string;

  @ApiProperty({ example: 'Hey, how are you doing?' })
  @IsNotEmpty()
  @IsString()
  content: string;

  @ApiPropertyOptional({ type: 'string', format: 'binary', description: 'Optional media file attachment' })
  @IsOptional()
  media?: any;
}
