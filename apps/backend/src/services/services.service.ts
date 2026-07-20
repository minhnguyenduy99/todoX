import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { toServiceDto } from '../common/mappers';
import type {
  CreateServiceDto,
  ServiceDto,
  UpdateServiceDto,
} from '@todo-platform/shared-types';

@Injectable()
export class ServicesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<ServiceDto[]> {
    const services = await this.prisma.service.findMany({
      orderBy: { keyName: 'asc' },
    });
    return services.map(toServiceDto);
  }

  async findOne(id: string): Promise<ServiceDto> {
    const service = await this.prisma.service.findUnique({ where: { id } });
    if (!service) throw new NotFoundException(`Service ${id} not found`);
    return toServiceDto(service);
  }

  async create(dto: CreateServiceDto): Promise<ServiceDto> {
    const existing = await this.prisma.service.findUnique({
      where: { keyName: dto.keyName },
    });
    if (existing) {
      throw new ConflictException(`Service with keyName '${dto.keyName}' already exists`);
    }

    const service = await this.prisma.service.create({
      data: {
        keyName: dto.keyName,
        displayName: dto.displayName,
      },
    });
    return toServiceDto(service);
  }

  async update(id: string, dto: UpdateServiceDto): Promise<ServiceDto> {
    await this.ensureExists(id);

    const service = await this.prisma.service.update({
      where: { id },
      data: {
        displayName: dto.displayName,
      },
    });
    return toServiceDto(service);
  }

  async remove(id: string): Promise<void> {
    await this.ensureExists(id);
    await this.prisma.service.delete({ where: { id } });
  }

  private async ensureExists(id: string): Promise<void> {
    const service = await this.prisma.service.findUnique({ where: { id } });
    if (!service) throw new NotFoundException(`Service ${id} not found`);
  }
}
