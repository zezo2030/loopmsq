import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards, UploadedFile, UseInterceptors, Query, ForbiddenException } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { HomeAdminService } from './home-admin.service';
import { Roles, UserRole } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../../database/entities/user.entity';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../common/guards/roles.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import * as fs from 'fs';

@ApiTags('admin/offers')
@Controller('admin/offers')
export class OfferAdminController {
  constructor(private readonly svc: HomeAdminService) {}

  @Get()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.STAFF, UserRole.BRANCH_MANAGER)
  @ApiBearerAuth()
  list(@Query('branchId') branchId?: string, @CurrentUser() me?: User) {
    // Branch manager can only list their branch
    if (me?.roles?.includes(UserRole.BRANCH_MANAGER)) {
      const enforcedBranchId = me.branchId;
      if (!enforcedBranchId) throw new ForbiddenException('No branch assigned');
      return this.svc.listOffers({ branchId: enforcedBranchId });
    }
    return this.svc.listOffers(branchId ? { branchId } : undefined);
  }

  @Post()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.BRANCH_MANAGER)
  @ApiBearerAuth()
  create(@Body() body: any, @CurrentUser() me: User) {
    if (me?.roles?.includes(UserRole.BRANCH_MANAGER)) {
      if (!me.branchId) throw new ForbiddenException('No branch assigned');
      if (body.branchId && body.branchId !== me.branchId) {
        throw new ForbiddenException('Not allowed for other branches');
      }
      body.branchId = me.branchId;
    }
    return this.svc.createOffer(body);
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
          const uploadsRoot = uploadsRootCandidates.find((p) => {
            try { return !!p && fs.existsSync(p); } catch { return false; }
          }) || uploadsRootCandidates[0];
          const target = join(uploadsRoot, 'offers');
          try { fs.mkdirSync(target, { recursive: true }); } catch {}
          cb(null, target);
        },
        filename: (req, file, cb) => {
          const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, `offer-${unique}${extname(file.originalname)}`);
        },
      }),
    }),
  )
  uploadOfferImage(@UploadedFile() file: Express.Multer.File) {
    return { imageUrl: `/uploads/offers/${file.filename}` };
  }

  @Patch(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.BRANCH_MANAGER)
  @ApiBearerAuth()
  update(@Param('id') id: string, @Body() body: any, @CurrentUser() me: User) {
    if (me?.roles?.includes(UserRole.BRANCH_MANAGER)) {
      if (!me.branchId) throw new ForbiddenException('No branch assigned');
      if (body.branchId && body.branchId !== me.branchId) {
        throw new ForbiddenException('Not allowed for other branches');
      }
      body.branchId = me.branchId;
    }
    return this.svc.updateOffer(id, body);
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.BRANCH_MANAGER)
  @ApiBearerAuth()
  remove(@Param('id') id: string) { return this.svc.deleteOffer(id); }
}


