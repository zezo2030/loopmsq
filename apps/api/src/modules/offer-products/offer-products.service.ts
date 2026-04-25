import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  IsNull,
  LessThanOrEqual,
  MoreThanOrEqual,
  In,
} from 'typeorm';
import {
  OfferProduct,
  OfferCategory,
} from '../../database/entities/offer-product.entity';
import { Addon } from '../../database/entities/addon.entity';
import { CreateOfferProductDto } from './dto/create-offer-product.dto';
import { UpdateOfferProductDto } from './dto/update-offer-product.dto';

@Injectable()
export class OfferProductsService {
  private readonly logger = new Logger(OfferProductsService.name);

  constructor(
    @InjectRepository(OfferProduct)
    private readonly repo: Repository<OfferProduct>,
    @InjectRepository(Addon)
    private readonly addonRepo: Repository<Addon>,
  ) {}

  /**
   * Find all active offer products for a branch, grouped by category.
   * Only returns offers where isActive=true and within the startsAt..endsAt window.
   */
  async findActiveByBranch(branchId: string): Promise<{
    ticketOffers: OfferProduct[];
    hoursOffers: OfferProduct[];
  }> {
    const now = new Date();

    const offers = await this.repo.find({
      where: [
        // No date window
        { branchId, isActive: true, startsAt: IsNull(), endsAt: IsNull() },
        // Only startsAt in the past
        {
          branchId,
          isActive: true,
          startsAt: LessThanOrEqual(now),
          endsAt: IsNull(),
        },
        // Only endsAt in the future
        {
          branchId,
          isActive: true,
          startsAt: IsNull(),
          endsAt: MoreThanOrEqual(now),
        },
        // Full window
        {
          branchId,
          isActive: true,
          startsAt: LessThanOrEqual(now),
          endsAt: MoreThanOrEqual(now),
        },
      ],
      order: { createdAt: 'DESC' },
    });

    const hydratedOffers = await Promise.all(
      offers.map((offer) => this.hydrateOfferAddOns(offer)),
    );

    const ticketOffers = hydratedOffers.filter(
      (o) => o.offerCategory === OfferCategory.TICKET_BASED,
    );
    const hoursOffers = hydratedOffers.filter(
      (o) => o.offerCategory === OfferCategory.HOUR_BASED,
    );

    return { ticketOffers, hoursOffers };
  }

  async findById(id: string): Promise<OfferProduct> {
    const offer = await this.repo.findOne({ where: { id } });
    if (!offer) throw new NotFoundException('Offer not found');
    return this.hydrateOfferAddOns(offer);
  }

  private validateOfferProduct(dto: any): void {
    if (dto.offerCategory === OfferCategory.TICKET_BASED) {
      if (!dto.ticketConfig) {
        throw new BadRequestException(
          'ticketConfig is required for ticket_based offers',
        );
      }
      if (
        !dto.ticketConfig.paidTicketCount ||
        dto.ticketConfig.paidTicketCount < 1
      ) {
        throw new BadRequestException(
          'ticketConfig.paidTicketCount must be at least 1',
        );
      }
      if (dto.ticketConfig.freeTicketCount < 0) {
        throw new BadRequestException(
          'ticketConfig.freeTicketCount must be non-negative',
        );
      }
    }

    if (dto.offerCategory === OfferCategory.HOUR_BASED) {
      if (!dto.hoursConfig) {
        throw new BadRequestException(
          'hoursConfig is required for hour_based offers',
        );
      }
      if (!dto.hoursConfig.isOpenTime && !dto.hoursConfig.durationHours) {
        throw new BadRequestException(
          'hoursConfig.durationHours must be greater than 0',
        );
      }
      if (
        dto.hoursConfig.durationHours != null &&
        dto.hoursConfig.durationHours <= 0
      ) {
        throw new BadRequestException(
          'hoursConfig.durationHours must be greater than 0',
        );
      }
      if (
        dto.hoursConfig.bonusHours != null &&
        dto.hoursConfig.bonusHours < 0
      ) {
        throw new BadRequestException(
          'hoursConfig.bonusHours must be non-negative',
        );
      }
    }

    if (
      dto.startsAt &&
      dto.endsAt &&
      new Date(dto.startsAt) >= new Date(dto.endsAt)
    ) {
      throw new BadRequestException('startsAt must be before endsAt');
    }
  }

  async create(dto: CreateOfferProductDto): Promise<OfferProduct> {
    this.validateOfferProduct(dto);
    const includedAddOns = await this.normalizeOfferAddOns(
      dto.branchId,
      dto.includedAddOns,
    );
    const ticketConfig = dto.ticketConfig
      ? {
          ...dto.ticketConfig,
          totalGeneratedCount:
            (dto.ticketConfig.paidTicketCount || 0) +
            (dto.ticketConfig.freeTicketCount || 0),
        }
      : undefined;
    const offer = this.repo.create({
      ...dto,
      includedAddOns,
      ticketConfig,
    } as Partial<OfferProduct>);
    return this.hydrateOfferAddOns(await this.repo.save(offer));
  }

  async update(id: string, dto: UpdateOfferProductDto): Promise<OfferProduct> {
    const offer = await this.findById(id);
    const merged = { ...offer, ...dto };
    this.validateOfferProduct(merged);
    const includedAddOns =
      dto.includedAddOns !== undefined
        ? await this.normalizeOfferAddOns(
            dto.branchId || offer.branchId,
            dto.includedAddOns,
          )
        : offer.includedAddOns;
    const ticketConfig = dto.ticketConfig
      ? {
          ...dto.ticketConfig,
          totalGeneratedCount:
            (dto.ticketConfig.paidTicketCount || 0) +
            (dto.ticketConfig.freeTicketCount || 0),
        }
      : undefined;
    Object.assign(offer, { ...dto, includedAddOns, ticketConfig });
    return this.hydrateOfferAddOns(await this.repo.save(offer));
  }

  async softDelete(id: string): Promise<OfferProduct> {
    const offer = await this.findById(id);
    offer.isActive = false;
    return this.repo.save(offer);
  }

  async findAll(params: {
    branchId?: string;
    offerCategory?: OfferCategory;
    isActive?: boolean;
    page?: number;
    limit?: number;
  }): Promise<{
    items: OfferProduct[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { branchId, offerCategory, isActive, page = 1, limit = 20 } = params;
    const qb = this.repo.createQueryBuilder('offer');

    if (branchId) qb.andWhere('offer.branchId = :branchId', { branchId });
    if (offerCategory)
      qb.andWhere('offer.offerCategory = :offerCategory', { offerCategory });
    if (isActive !== undefined)
      qb.andWhere('offer.isActive = :isActive', { isActive });

    qb.orderBy('offer.createdAt', 'DESC');

    const [items, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      items: await Promise.all(
        items.map((item) => this.hydrateOfferAddOns(item)),
      ),
      total,
      page,
      limit,
    };
  }

  private async normalizeOfferAddOns(
    branchId: string,
    includedAddOns?: OfferProduct['includedAddOns'],
  ) {
    if (!includedAddOns?.length) {
      return [];
    }

    const addonIds = includedAddOns
      .map((item) => item.addonId)
      .filter(
        (value): value is string =>
          typeof value === 'string' && value.length > 0,
      );

    const addons = addonIds.length
      ? await this.addonRepo.find({
          where: [
            { branchId, isActive: true, id: In(addonIds), category: 'offer' },
            {
              branchId: IsNull(),
              isActive: true,
              id: In(addonIds),
              category: 'offer',
            },
          ],
        })
      : [];
    const addonsMap = new Map(addons.map((addon) => [addon.id, addon]));

    return includedAddOns.map((item) => {
      const addonId = item.addonId;
      if (!addonId) {
        return item;
      }

      const addon = addonsMap.get(addonId);
      if (!addon) {
        throw new BadRequestException(`Addon not found in branch: ${addonId}`);
      }

      return {
        addonId,
        name: addon.name,
        price: Number(addon.price),
        quantity: item.quantity,
      };
    });
  }

  private async hydrateOfferAddOns(offer: OfferProduct): Promise<OfferProduct> {
    if (!offer.includedAddOns?.length) {
      return offer;
    }

    const addonIds = offer.includedAddOns
      .map((item) => item.addonId)
      .filter(
        (value): value is string =>
          typeof value === 'string' && value.length > 0,
      );

    if (!addonIds.length) {
      return offer;
    }

    const addons = await this.addonRepo.find({
      where: { id: In(addonIds), category: 'offer' },
    });
    const addonsMap = new Map(addons.map((addon) => [addon.id, addon]));

    offer.includedAddOns = offer.includedAddOns
      .map((item) => {
        const addon = item.addonId ? addonsMap.get(item.addonId) : undefined;
        return {
          addonId: item.addonId,
          name: addon?.name || item.name,
          price: addon ? Number(addon.price) : Number(item.price || 0),
          quantity: item.quantity,
        };
      })
      .filter((item) => !!item.name);

    return offer;
  }
}
