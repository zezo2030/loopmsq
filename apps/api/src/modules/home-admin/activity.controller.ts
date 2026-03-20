import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiConsumes,
} from '@nestjs/swagger';
import { HomeAdminService } from './home-admin.service';
import { Roles, UserRole } from '../../common/decorators/roles.decorator';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../common/guards/roles.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import * as fs from 'fs';
import { CloudinaryService } from '../../utils/cloudinary.service';

@ApiTags('admin/activities')
@Controller('admin/activities')
export class ActivityAdminController {
  constructor(
    private readonly svc: HomeAdminService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  @Get()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  list() {
    return this.svc.listActivities();
  }

  @Post()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  create(@Body() body: any) {
    return this.svc.createActivity(body);
  }

  @Post('upload')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const uploadsRootCandidates = [
            process.env.UPLOAD_DEST,
            join(__dirname, '..', '..', '..', 'uploads'),
            join(__dirname, '..', 'uploads'),
          ].filter(Boolean) as string[];
          const uploadsRoot =
            uploadsRootCandidates.find((p) => {
              try {
                return !!p && fs.existsSync(p);
              } catch {
                return false;
              }
            }) || uploadsRootCandidates[0];
          const target = join(uploadsRoot, 'activities');
          try {
            fs.mkdirSync(target, { recursive: true });
          } catch {}
          cb(null, target);
        },
        filename: (req, file, cb) => {
          const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, `activity-${unique}${extname(file.originalname)}`);
        },
      }),
    }),
  )
  uploadActivityImage(@UploadedFile() file: Express.Multer.File) {
    return { imageUrl: `/uploads/activities/${file.filename}` };
  }

  @Post('upload-video')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Upload video file to Cloudinary' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async uploadVideo(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Video file is required');
    }

    // Validate file type
    if (!file.mimetype.startsWith('video/')) {
      throw new BadRequestException('File must be a video');
    }

    // Validate file size (max 100MB)
    const maxSize = 100 * 1024 * 1024; // 100MB
    if (file.size > maxSize) {
      throw new BadRequestException('Video file size must be less than 100MB');
    }

    const { videoUrl, coverUrl } = await this.cloudinaryService.uploadVideo(
      file,
      'activities/videos',
    );
    return { videoUrl, coverUrl };
  }

  @Post('upload-video-cover')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Upload video cover image to Cloudinary' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async uploadVideoCover(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Cover image file is required');
    }

    // Validate file type
    if (!file.mimetype.startsWith('image/')) {
      throw new BadRequestException('File must be an image');
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      throw new BadRequestException(
        'Cover image file size must be less than 10MB',
      );
    }

    const coverUrl = await this.cloudinaryService.uploadImage(
      file,
      'activities/video-covers',
    );
    return { coverUrl };
  }

  @Patch(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  update(@Param('id') id: string, @Body() body: any) {
    return this.svc.updateActivity(id, body);
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  remove(@Param('id') id: string) {
    return this.svc.deleteActivity(id);
  }
}
