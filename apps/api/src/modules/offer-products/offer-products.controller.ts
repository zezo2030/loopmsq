import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { OfferProductsService } from './offer-products.service';
import { CreateOfferProductDto } from './dto/create-offer-product.dto';
import { UpdateOfferProductDto } from './dto/update-offer-product.dto';
import { OfferCategory } from '../../database/entities/offer-product.entity';

@ApiTags('offer-products')
@Controller()
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
export class OfferProductsController {
  constructor(private readonly service: OfferProductsService) {}

  @Get('branches/:branchId/offer-products')
  @ApiOperation({ summary: 'List active offer products for a branch' })
  @ApiResponse({ status: 200, description: 'Offers retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Branch not found' })
  async getBranchOfferProducts(
    @Param('branchId', ParseUUIDPipe) branchId: string,
  ) {
    return this.service.findActiveByBranch(branchId);
  }

  @Get('admin/offer-products')
  @ApiOperation({ summary: 'List all offer products (admin)' })
  @ApiResponse({ status: 200, description: 'Offers retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getAdminOfferProducts(
    @Query('branchId') branchId?: string,
    @Query('category') category?: OfferCategory,
    @Query('isActive') isActive?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const result = await this.service.findAll({
      branchId,
      offerCategory: category,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
    return {
      offers: result.items,
      total: result.total,
      page: result.page,
      limit: result.limit,
    };
  }

  @Post('admin/offer-products')
  @ApiOperation({ summary: 'Create a new offer product (admin)' })
  @ApiResponse({ status: 201, description: 'Offer created successfully' })
  @ApiResponse({ status: 400, description: 'Validation failure' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async createAdminOfferProduct(@Body() dto: CreateOfferProductDto) {
    return this.service.create(dto);
  }

  @Patch('admin/offer-products/:id')
  @ApiOperation({ summary: 'Update an offer product (admin)' })
  @ApiResponse({ status: 200, description: 'Offer updated successfully' })
  @ApiResponse({ status: 400, description: 'Validation failure' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Offer not found' })
  async updateAdminOfferProduct(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOfferProductDto,
  ) {
    return this.service.update(id, dto);
  }

  @Delete('admin/offer-products/:id')
  @ApiOperation({ summary: 'Soft-delete an offer product (admin)' })
  @ApiResponse({ status: 200, description: 'Offer deactivated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Offer not found' })
  async deleteAdminOfferProduct(@Param('id', ParseUUIDPipe) id: string) {
    await this.service.softDelete(id);
    return {
      success: true,
      message: 'Offer deactivated. Existing purchases remain valid.',
    };
  }
}
