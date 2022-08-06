import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { BedInformationRepository } from 'src/bed-information/repositories/bed-information.repository'
import { CategoryRepository } from 'src/category/category.repository';
import { NftRepository } from 'src/nfts/nfts.repository'
import { SpendingBalancesRepository } from 'src/spending_balances/spending_balances.repository'

import {TrackingModule} from "../tracking/tracking.module";
import { NftAttributesController } from './nft-attributes.controller'
import { NftAttributesRepository } from './nft-attributes.repository'
import { NftAttributesSevice } from './nft-attributes.service'

@Module({
  imports: [TypeOrmModule.forFeature([NftAttributesRepository, NftRepository, SpendingBalancesRepository,BedInformationRepository, CategoryRepository]), TrackingModule],
  controllers: [NftAttributesController],
  providers: [NftAttributesSevice],
  exports: [NftAttributesSevice],
})
export class NftAttributesModule {}
