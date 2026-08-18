import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('Media Content Sharing Social Network API')
    .setDescription(
      'REST API backend built with NestJS, PostgreSQL, Prisma, Cloudinary, and Swagger for a media content sharing social network platform.',
    )
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        description: 'Enter your JWT access token',
        in: 'header',
      },
      'bearer',
    )
    .addTag('Auth', 'User authentication and Google OAuth2')
    .addTag('Users', 'User accounts, profile management & search')
    .addTag('Follows', 'Subscription management and follow request approvals')
    .addTag('Posts', 'Media posts creation, activity feed, and viewing')
    .addTag('Likes', 'Post likes management')
    .addTag('Comments', 'Post comments management')
    .addTag('Blocks', 'Blocks management')
    .addTag('Stories', '24-hour media stories and view tracking')
    .addTag('Chat', 'Direct messaging and real-time chat conversations')
    .addTag('Notifications', 'In-app and real-time WebSockets notifications')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);
  logger.log(`Server is running on: http://localhost:${port}/api`);
  logger.log(`Swagger documentation is available at: http://localhost:${port}/api/docs`);
}
bootstrap();
